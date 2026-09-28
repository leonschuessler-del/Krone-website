import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getFullVenueSpaceIds } from "@/domain/selection";
import { createTestDb, type Database } from "@/server/db/client";
import { availabilityBlocks, bookingItems, bookings, emailLog } from "@/server/db/schema";
import { getDemoScenario, seedDatabase } from "@/server/db/seed";
import { checkAvailability } from "@/server/services/availability-service";
import { BookingError, createBooking, getPublicBooking, type BookingSubmission } from "@/server/services/booking-service";
import { getHandoverOptions } from "@/server/services/handover-service";
import { confirmDemoPayment, createPaymentSession } from "@/server/services/payment-service";
import { calculatePrice } from "@/server/services/pricing-service";
import { listSpaces } from "@/server/services/space-service";
import { zonedDateTimeToUtc } from "@/domain/time";

let db: Database;
let close: () => Promise<void>;
const scenario = getDemoScenario();

beforeAll(async () => {
  ({ db, close } = await createTestDb({ seed: true }));
});
afterAll(async () => close());

const contact = {
  firstName: "Erika",
  lastName: "Mustermann",
  company: null,
  email: "erika@example.org",
  phone: "+49 6028 123456",
  street: "Musterweg",
  houseNumber: "1",
  postalCode: "63849",
  city: "Leidersbach",
  country: "Deutschland",
  billing: null,
};

async function submission(spaceIds: string[], date: string, start: string, end: string, kind: "booking" | "inquiry" = "booking"): Promise<BookingSubmission> {
  const s = zonedDateTimeToUtc(date, start);
  let e = zonedDateTimeToUtc(date, end);
  if (e <= s) e += 86_400_000;
  const options = await getHandoverOptions(db, s, e);
  return {
    kind,
    spaceIds,
    schedule: { rentalMode: "hourly", date, startTime: start, endTime: end },
    extras: [],
    event: { eventType: "birthday", guestCount: 60, notes: null },
    contact,
    handoverAt: options.handover.at(-1)?.value ?? null,
    returnAt: options.return[0]?.value ?? null,
    acceptedTerms: ["house_rules", "rental_terms", "cancellation", "deposit", "handover", "privacy"],
  };
}

describe("multi-space availability against the database", () => {
  it("Test 59: Restaurant + Bühne + Wintergarten on the demo date → 2 von 3 verfügbar, Wintergarten blockiert", async () => {
    const res = await checkAvailability(db, {
      spaceIds: ["restaurant", "stage", "winter-garden"],
      rentalMode: "hourly",
      date: scenario.winterGardenBookedDate,
      startTime: "16:00",
      endTime: "23:00",
      alternatives: 3,
    });
    expect(res.bookingAllowed).toBe(false);
    expect(res.summary.message).toBe("2 von 3 Bereichen verfügbar.");
    expect(res.blockedSpaces.map((b) => b.spaceId)).toEqual(["winter-garden"]);
    expect(res.blockedSpaces[0]!.reason).toBe("Wintergarten ist in diesem Zeitraum nicht verfügbar.");
    expect(res.alternatives.length).toBeGreaterThan(0);
  });

  it("Test 104: Restaurant + Bühne on the same date → bookable", async () => {
    const res = await checkAvailability(db, {
      spaceIds: ["restaurant", "stage"],
      rentalMode: "hourly",
      date: scenario.winterGardenBookedDate,
      startTime: "16:00",
      endTime: "23:00",
    });
    expect(res.bookingAllowed).toBe(true);
    expect(res.summary.message).toBe("Alle ausgewählten Bereiche sind verfügbar.");
  });

  it("Test 61: full venue on the demo date names the blocked space", async () => {
    const spaces = await listSpaces(db);
    const full = getFullVenueSpaceIds(spaces);
    const res = await checkAvailability(db, { spaceIds: full, rentalMode: "hourly", date: scenario.winterGardenBookedDate, startTime: "16:00", endTime: "23:00" });
    expect(res.bookingAllowed).toBe(false);
    expect(res.blockedSpaces.map((b) => b.spaceId)).toEqual(["winter-garden"]);
    expect(res.availableSpaceIds).toHaveLength(full.length - 1);
  });

  it("day overview returns common free windows", async () => {
    const res = await checkAvailability(db, { spaceIds: ["restaurant", "side-room"], rentalMode: "hourly", date: scenario.restaurantEveningDate });
    expect(res.requested.hasTimeRange).toBe(false);
    expect(res.spaces.find((s) => s.spaceId === "restaurant")?.status).toBe("partially_available");
    expect(res.commonFreeIntervals.length).toBeGreaterThan(0);
  });
});

describe("booking creation", () => {
  it("Test 60: Restaurant + Bühne + Biergarten (all free) → exactly three BookingItems, demo payment confirms", async () => {
    const date = scenario.winterGardenBookedDate;
    const input = await submission(["restaurant", "stage", "beer-garden"], date, "15:00", "23:00");
    const quote = await calculatePrice(db, { ...input.schedule, spaceIds: input.spaceIds });
    expect(quote.appliedBundle?.id).toBe("demo-bundle-restaurant-stage-beer-garden");

    const created = await createBooking(db, input);
    expect(created.bookingNumber).toMatch(/^KR-\d{4}-/);
    expect(created.status).toBe("pending");
    expect(created.paymentRequired).toBe(true);

    const [booking] = await db.select().from(bookings).where(eq(bookings.bookingNumber, created.bookingNumber));
    const items = await db.select().from(bookingItems).where(eq(bookingItems.bookingId, booking!.id));
    expect(items.map((i) => i.spaceId).sort()).toEqual(["beer-garden", "restaurant", "stage"]);

    const holds = await db.select().from(availabilityBlocks).where(eq(availabilityBlocks.bookingId, booking!.id));
    expect(holds).toHaveLength(3);
    expect(holds.every((h) => h.type === "reserved" && h.expiresAt)).toBe(true);

    const session = await createPaymentSession(db, created.bookingNumber, created.accessToken);
    expect(session.provider).toBe("demo");
    await confirmDemoPayment(db, created.bookingNumber, created.accessToken, "succeeded");

    const view = await getPublicBooking(db, created.bookingNumber, created.accessToken);
    expect(view?.booking.status).toBe("confirmed");
    expect(view?.booking.paymentStatus).toBe("deposit_paid");
    const blocks = await db.select().from(availabilityBlocks).where(eq(availabilityBlocks.bookingId, booking!.id));
    expect(blocks.every((b) => b.type === "booked" && b.expiresAt === null)).toBe(true);

    const mails = await db.select().from(emailLog).where(eq(emailLog.bookingId, booking!.id));
    expect(mails.length).toBeGreaterThanOrEqual(3);
    expect(mails.every((m) => m.status === "preview")).toBe(true);
  });

  it("rejects a second booking of the same space and time (no double booking)", async () => {
    const date = scenario.winterGardenBookedDate;
    const input = await submission(["restaurant"], date, "16:00", "20:00");
    await expect(createBooking(db, input)).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
  });

  it("the database constraint itself prevents overlapping active blocks", async () => {
    const start = new Date(zonedDateTimeToUtc(scenario.oldTavernReservedDate, "12:00"));
    const end = new Date(zonedDateTimeToUtc(scenario.oldTavernReservedDate, "14:00"));
    await expect(db.insert(availabilityBlocks).values({ spaceId: "old-tavern", startAt: start, endAt: end, type: "blocked" })).rejects.toThrow();
  });

  it("concurrent bookings for the same slot: exactly one wins", async () => {
    const date = scenario.stageMaintenanceDate;
    const a = await submission(["side-room"], date, "10:00", "13:00");
    const b = await submission(["side-room"], date, "11:00", "14:00");
    const results = await Promise.allSettled([createBooking(db, a), createBooking(db, b)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(BookingError);
  });

  it("a blocked space is rejected with a clear message while the others stay bookable", async () => {
    const input = await submission(["restaurant", "winter-garden"], scenario.winterGardenBookedDate, "10:00", "12:00");
    await expect(createBooking(db, input)).rejects.toMatchObject({ code: "NOT_AVAILABLE", message: expect.stringContaining("Wintergarten") });
  });

  it("inquiries get their own number and do not block availability", async () => {
    const input = await submission(["restaurant", "stage"], scenario.restaurantEveningDate, "10:00", "14:00", "inquiry");
    input.acceptedTerms = ["privacy"];
    const created = await createBooking(db, input);
    expect(created.bookingNumber).toMatch(/^KA-/);
    expect(created.status).toBe("inquiry");
    const [booking] = await db.select().from(bookings).where(eq(bookings.bookingNumber, created.bookingNumber));
    const blocks = await db.select().from(availabilityBlocks).where(eq(availabilityBlocks.bookingId, booking!.id));
    expect(blocks).toHaveLength(0);
  });

  it("requires accepted terms and rejects tampered selections", async () => {
    const input = await submission(["restaurant"], scenario.oldTavernReservedDate, "10:00", "14:00");
    await expect(createBooking(db, { ...input, acceptedTerms: [] })).rejects.toMatchObject({ code: "TERMS_REQUIRED" });
    await expect(createBooking(db, { ...input, spaceIds: ["restaurant", "hotel"] })).rejects.toMatchObject({ code: "INVALID_SELECTION" });
  });

  it("wrong access token does not reveal a booking", async () => {
    const input = await submission(["kitchen"], scenario.oldTavernReservedDate, "10:00", "14:00");
    const created = await createBooking(db, input);
    expect(await getPublicBooking(db, created.bookingNumber, "x".repeat(32))).toBeNull();
  });

  it("seeding the demo data twice does not duplicate demo blocks", async () => {
    const demoBlocks = async () => (await db.select().from(availabilityBlocks).where(eq(availabilityBlocks.isDemo, true))).length;
    const before = await demoBlocks();
    expect(before).toBeGreaterThan(0);
    await seedDatabase(db, { demo: true });
    expect(await demoBlocks()).toBe(before);
  });
});
