import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getFullVenueSpaceIds } from "@/domain/selection";
import { createTestDb, type Database } from "@/server/db/client";
import { availabilityBlocks, bookingItems, bookings, emailLog } from "@/server/db/schema";
import { getDemoScenario, seedDatabase } from "@/server/db/seed";
import { checkAvailability } from "@/server/services/availability-service";
import { BookingError, createBooking, getPublicBooking, type BookingSubmission } from "@/server/services/booking-service";
import { getHandoverOptions } from "@/server/services/handover-service";
import { updateBookingByAdmin } from "@/server/services/admin-service";
import { calculatePrice } from "@/server/services/pricing-service";
import { listSpaces } from "@/server/services/space-service";
import { addDays, zonedDateTimeToUtc } from "@/domain/time";

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

// every booking is a request the operator confirms (bookingMode "inquiry" on all rooms)
async function submission(spaceIds: string[], date: string, start: string, end: string, kind: "booking" | "inquiry" = "inquiry"): Promise<BookingSubmission> {
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
  it("Test 60: Restaurant + Bühne + Biergarten (all free) → request with three items, held for the operator, accepted → booked", async () => {
    const date = scenario.winterGardenBookedDate;
    const input = await submission(["restaurant", "stage", "beer-garden"], date, "15:00", "23:00");
    const quote = await calculatePrice(db, { ...input.schedule, spaceIds: input.spaceIds });
    // price sheet: Restaurant 1.300 + Bühne 200 + Biergarten 300 (net) – flat per booking
    expect(quote.rentalSubtotal).toBe(180000);
    expect(quote.vat.amount).toBe(Math.round((quote.total ?? 0) * 0.19));
    expect(quote.bookingMode).toBe("inquiry");

    const created = await createBooking(db, input);
    expect(created.bookingNumber).toMatch(/^KA-\d{4}-/);
    expect(created.status).toBe("inquiry");
    expect(created.paymentRequired).toBe(false);

    const [booking] = await db.select().from(bookings).where(eq(bookings.bookingNumber, created.bookingNumber));
    const items = await db.select().from(bookingItems).where(eq(bookingItems.bookingId, booking!.id));
    expect(items.map((i) => i.spaceId).sort()).toEqual(["beer-garden", "restaurant", "stage"]);

    // the request holds the rooms (7 days) until the operator decides
    const holds = await db.select().from(availabilityBlocks).where(eq(availabilityBlocks.bookingId, booking!.id));
    expect(holds).toHaveLength(3);
    expect(holds.every((h) => h.type === "reserved" && h.expiresAt)).toBe(true);

    // operator accepts → booked, no expiry, acceptance mail
    const r = await updateBookingByAdmin(db, booking!.id, { status: "confirmed" }, "test@krone");
    expect(r.emailSent).toBe("request_accepted");
    const view = await getPublicBooking(db, created.bookingNumber, created.accessToken);
    expect(view?.booking.status).toBe("confirmed");
    const blocks = await db.select().from(availabilityBlocks).where(eq(availabilityBlocks.bookingId, booking!.id));
    expect(blocks.every((b) => b.type === "booked" && b.expiresAt === null)).toBe(true);

    const mails = await db.select().from(emailLog).where(eq(emailLog.bookingId, booking!.id));
    expect(mails.map((m) => m.template)).toEqual(expect.arrayContaining(["inquiry_received", "operator_new_request", "request_accepted"]));
    expect(mails.every((m) => m.status === "preview")).toBe(true);
  });

  it("declining a request sends the reason and frees the rooms", async () => {
    const input = await submission(["restaurant", "side-room"], scenario.stageMaintenanceDate, "18:00", "23:00");
    const created = await createBooking(db, input);
    const [booking] = await db.select().from(bookings).where(eq(bookings.bookingNumber, created.bookingNumber));
    const r = await updateBookingByAdmin(db, booking!.id, { status: "cancelled", declineReason: "capacity", declineNote: "Am Samstag darauf wäre das Haus frei." }, "test@krone");
    expect(r.emailSent).toBe("request_declined");
    const mail = (await db.select().from(emailLog).where(eq(emailLog.bookingId, booking!.id))).find((m) => m.template === "request_declined");
    expect(mail?.text).toContain("Gästezahl");
    expect(mail?.text).toContain("Samstag darauf");
    const active = await db.select().from(availabilityBlocks).where(eq(availabilityBlocks.bookingId, booking!.id));
    expect(active.every((b) => !b.active)).toBe(true);
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
    const a = await submission(["restaurant", "side-room"], date, "10:00", "13:00");
    const b = await submission(["restaurant", "side-room"], date, "11:00", "14:00");
    const results = await Promise.allSettled([createBooking(db, a), createBooking(db, b)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(BookingError);
  });

  it("a blocked space is rejected with a clear message while the others stay bookable", async () => {
    const input = await submission(["restaurant", "winter-garden"], scenario.winterGardenBookedDate, "10:00", "12:00");
    await expect(createBooking(db, input)).rejects.toMatchObject({ code: "NOT_AVAILABLE", message: expect.stringContaining("Wintergarten") });
  });

  it("a room without the Restaurant is rejected – the Restaurant is always part of a booking", async () => {
    const input = await submission(["stage"], scenario.restaurantEveningDate, "10:00", "14:00");
    await expect(createBooking(db, input)).rejects.toMatchObject({ code: "INVALID_SELECTION", message: expect.stringContaining("Restaurant") });
  });

  it("inquiries get their own number and hold the rooms for the operator", async () => {
    // a day without restaurant blocks (handover/return slots widen the occupation into the evening)
    const input = await submission(["restaurant", "stage"], scenario.oldTavernReservedDate, "10:00", "14:00", "inquiry");
    input.acceptedTerms = ["privacy"];
    const created = await createBooking(db, input);
    expect(created.bookingNumber).toMatch(/^KA-/);
    expect(created.status).toBe("inquiry");
    const [booking] = await db.select().from(bookings).where(eq(bookings.bookingNumber, created.bookingNumber));
    const blocks = await db.select().from(availabilityBlocks).where(eq(availabilityBlocks.bookingId, booking!.id));
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.type === "reserved" && b.expiresAt !== null)).toBe(true);
  });

  it("requires accepted terms and rejects tampered selections", async () => {
    const input = await submission(["restaurant"], scenario.oldTavernReservedDate, "10:00", "14:00");
    await expect(createBooking(db, { ...input, acceptedTerms: [] })).rejects.toMatchObject({ code: "TERMS_REQUIRED" });
    await expect(createBooking(db, { ...input, spaceIds: ["restaurant", "does-not-exist"] })).rejects.toMatchObject({ code: "INVALID_SELECTION" });
  });

  it("wrong access token does not reveal a booking", async () => {
    const input = await submission(["restaurant"], addDays(scenario.oldTavernReservedDate, 1), "10:00", "14:00");
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
