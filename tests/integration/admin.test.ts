import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { SignJWT } from "jose";
import { addDays } from "@/domain/time";
import { createTestDb, type Database } from "@/server/db/client";
import { auditLog, availabilityBlocks, bookings, emailLog } from "@/server/db/schema";
import { getDemoScenario } from "@/server/db/seed";
import { safeAdminRedirect, signSession, verifySessionToken } from "@/server/auth/session";
import { authenticateAdmin } from "@/server/auth/admin-login";
import { hashPassword } from "@/server/auth/password";
import { adminUsers } from "@/server/db/schema";
import {
  AdminError,
  createManualBlocks,
  deactivateBlock,
  getAdminBookingDetail,
  getCalendarData,
  listAdminBookings,
  manualBlockInterval,
  updateBookingByAdmin,
} from "@/server/services/admin-service";
import { updateSpaceByAdmin } from "@/server/services/admin-catalog-service";
import { checkAvailability } from "@/server/services/availability-service";
import { createBooking, type BookingSubmission } from "@/server/services/booking-service";

process.env.AUTH_SECRET = "integration-test-secret-with-enough-length-0123456789";

let db: Database;
let close: () => Promise<void>;
const scenario = getDemoScenario();
/** A Friday ~4 weeks ahead without demo blocks (the kitchen maintenance is one week later). */
const freeFriday = addDays(scenario.restaurantEveningDate, 7);
const ACTOR = "admin@test.local";

beforeAll(async () => {
  ({ db, close } = await createTestDb({ seed: true }));
});
afterAll(async () => close());

const contact = {
  firstName: "Max",
  lastName: "Admin-Test",
  company: null,
  email: "max@example.org",
  phone: "+49 6028 999999",
  street: "Testweg",
  houseNumber: "2",
  postalCode: "63849",
  city: "Leidersbach",
  country: "Deutschland",
  billing: null,
};

function inquiry(spaceIds: string[], date: string, start: string, end: string): BookingSubmission {
  return {
    kind: "inquiry",
    spaceIds,
    schedule: { rentalMode: "hourly", date, startTime: start, endTime: end },
    extras: [],
    event: { eventType: "birthday", guestCount: 40, notes: null },
    contact,
    handoverAt: null,
    returnAt: null,
    acceptedTerms: ["privacy"],
  };
}

async function bookingId(number: string): Promise<string> {
  const [b] = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.bookingNumber, number));
  return b!.id;
}

async function available(spaceIds: string[], date: string, start: string, end: string) {
  return checkAvailability(db, { spaceIds, rentalMode: "hourly", date, startTime: start, endTime: end });
}

describe("admin session tokens", () => {
  it("signs and verifies a session", async () => {
    const token = await signSession({ sub: "11111111-1111-4111-8111-111111111111", email: "a@b.de", role: "owner" });
    const payload = await verifySessionToken(token);
    expect(payload).toEqual({ sub: "11111111-1111-4111-8111-111111111111", email: "a@b.de", role: "owner" });
  });

  it("rejects tampered, expired and foreign tokens", async () => {
    const token = await signSession({ sub: "u1", email: "a@b.de", role: "owner" });
    const [h, p, s] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p!, "base64url").toString()), role: "owner", email: "evil@b.de" })).toString("base64url");
    expect(await verifySessionToken(`${h}.${forged}.${s}`)).toBeNull();
    expect(await verifySessionToken(token, { now: Date.now() + 9 * 3_600_000 })).toBeNull(); // 8 h expiry
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
    const other = await new SignJWT({ email: "a@b.de", role: "owner" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setIssuer("zur-krone")
      .setAudience("krone-admin")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("a-completely-different-secret-value-xyz"));
    expect(await verifySessionToken(other)).toBeNull();
  });

  it("only allows admin paths as login redirect target", () => {
    expect(safeAdminRedirect("/admin/buchungen?filter=neu")).toBe("/admin/buchungen?filter=neu");
    expect(safeAdminRedirect("https://evil.example")).toBe("/admin");
    expect(safeAdminRedirect("//evil.example/admin")).toBe("/admin");
    expect(safeAdminRedirect("/admin/login")).toBe("/admin");
    expect(safeAdminRedirect(undefined)).toBe("/admin");
  });

  it("authenticates admins by scrypt hash and records the last login", async () => {
    await db.insert(adminUsers).values({ email: "chef@test.local", passwordHash: await hashPassword("richtiges-passwort"), role: "owner" });
    expect(await authenticateAdmin(db, "chef@test.local", "falsches-passwort")).toBeNull();
    expect(await authenticateAdmin(db, "unbekannt@test.local", "richtiges-passwort")).toBeNull();
    const ok = await authenticateAdmin(db, " Chef@Test.local ", "richtiges-passwort");
    expect(ok?.email).toBe("chef@test.local");
    expect(ok).not.toHaveProperty("passwordHash");
    const [row] = await db.select().from(adminUsers).where(eq(adminUsers.email, "chef@test.local"));
    expect(row!.lastLoginAt).toBeInstanceOf(Date);
  });
});

describe("booking status changes by the admin", () => {
  let id: string;
  let number: string;

  beforeAll(async () => {
    const created = await createBooking(db, inquiry(["side-room"], freeFriday, "10:00", "14:00"));
    number = created.bookingNumber;
    id = await bookingId(number);
  });

  it("an open inquiry does not block the space", async () => {
    expect((await available(["side-room"], freeFriday, "10:00", "14:00")).bookingAllowed).toBe(true);
    const list = await listAdminBookings(db, { filter: "neu", q: number });
    expect(list.items.map((i) => i.bookingNumber)).toEqual([number]);
    expect(list.counts.anfrage).toBeGreaterThanOrEqual(1);
  });

  it("rejects forbidden transitions (inquiry → completed)", async () => {
    await expect(updateBookingByAdmin(db, id, { status: "completed" }, ACTOR)).rejects.toMatchObject({ code: "INVALID_TRANSITION", status: 422 });
    const [b] = await db.select().from(bookings).where(eq(bookings.id, id));
    expect(b!.status).toBe("inquiry");
  });

  it("inquiry → confirmed creates booked availability blocks and sends the confirmation", async () => {
    const result = await updateBookingByAdmin(db, id, { status: "confirmed" }, ACTOR);
    expect(result).toMatchObject({ status: "confirmed", blocksCreated: 1, emailSent: "booking_confirmed" });

    const blocks = await db.select().from(availabilityBlocks).where(and(eq(availabilityBlocks.bookingId, id), eq(availabilityBlocks.active, true)));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ spaceId: "side-room", type: "booked", expiresAt: null });

    const [b] = await db.select().from(bookings).where(eq(bookings.id, id));
    expect(b!.status).toBe("confirmed");
    expect(b!.reviewedAt).toBeInstanceOf(Date);

    const res = await available(["side-room", "stage"], freeFriday, "11:00", "14:00");
    expect(res.bookingAllowed).toBe(false);
    expect(res.blockedSpaces.map((s) => s.spaceId)).toEqual(["side-room"]);

    const mails = await db.select().from(emailLog).where(and(eq(emailLog.bookingId, id), eq(emailLog.template, "booking_confirmed")));
    expect(mails).toHaveLength(1);
    const audit = await db.select().from(auditLog).where(and(eq(auditLog.entityId, id), eq(auditLog.action, "booking.status")));
    expect(audit[0]).toMatchObject({ actor: ACTOR, data: { from: "inquiry", to: "confirmed", blocksCreated: 1 } });
  });

  it("confirmed cannot go back to inquiry or reserved", async () => {
    await expect(updateBookingByAdmin(db, id, { status: "inquiry" }, ACTOR)).rejects.toBeInstanceOf(AdminError);
    await expect(updateBookingByAdmin(db, id, { status: "reserved" }, ACTOR)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("booking blocks cannot be lifted as manual blocks", async () => {
    const [block] = await db.select().from(availabilityBlocks).where(eq(availabilityBlocks.bookingId, id));
    await expect(deactivateBlock(db, block!.id, ACTOR)).rejects.toMatchObject({ code: "BOOKING_BLOCK" });
  });

  it("stores payment status, notes and review flag", async () => {
    const r = await updateBookingByAdmin(db, id, { paymentStatus: "paid", adminNotes: "  Überweisung eingegangen  ", markReviewed: false, notifyCustomer: false }, ACTOR);
    expect(r.changes.sort()).toEqual(["adminNotes", "paymentStatus", "reviewed"]);
    const detail = await getAdminBookingDetail(db, id);
    expect(detail!.booking).toMatchObject({ paymentStatus: "paid", adminNotes: "Überweisung eingegangen", reviewedAt: null });
    expect(detail!.booking).not.toHaveProperty("accessTokenHash");
    expect((await listAdminBookings(db, { filter: "bezahlt", q: number })).items).toHaveLength(1);
  });

  it("confirmed → cancelled frees the space; cancelled is final", async () => {
    const r = await updateBookingByAdmin(db, id, { status: "cancelled" }, ACTOR);
    expect(r.emailSent).toBe("booking_cancelled");
    const active = await db.select().from(availabilityBlocks).where(and(eq(availabilityBlocks.bookingId, id), eq(availabilityBlocks.active, true)));
    expect(active).toHaveLength(0);
    expect((await available(["side-room"], freeFriday, "10:00", "14:00")).bookingAllowed).toBe(true);
    await expect(updateBookingByAdmin(db, id, { status: "confirmed" }, ACTOR)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("inquiry → reserved is refused when the time was taken in the meantime", async () => {
    const created = await createBooking(db, inquiry(["stage", "old-tavern"], freeFriday, "15:00", "18:00"));
    const inquiryId = await bookingId(created.bookingNumber);
    await createManualBlocks(db, { spaceIds: ["stage"], date: freeFriday, startTime: "16:00", endTime: "17:00", type: "blocked", reason: "Eigenveranstaltung" }, ACTOR);

    const err = await updateBookingByAdmin(db, inquiryId, { status: "reserved" }, ACTOR).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdminError);
    expect(err).toMatchObject({ code: "SLOT_TAKEN", status: 409 });
    expect((err as Error).message).toContain("Zeitraum inzwischen belegt");
    expect((err as Error).message).toContain("Bühne");

    // nothing half-done: status unchanged, no blocks for the other space either
    const [b] = await db.select().from(bookings).where(eq(bookings.id, inquiryId));
    expect(b!.status).toBe("inquiry");
    expect(await db.select().from(availabilityBlocks).where(eq(availabilityBlocks.bookingId, inquiryId))).toHaveLength(0);
  });
});

describe("manual blocks (Sperrzeiten)", () => {
  const day = addDays(freeFriday, 1); // Saturday

  it("computes local (Europe/Berlin) intervals incl. overnight and multi-day ranges", () => {
    const overnight = manualBlockInterval({ date: "2026-07-04", startTime: "18:00", endTime: "02:00" });
    expect(new Date(overnight.start).toISOString()).toBe("2026-07-04T16:00:00.000Z");
    expect(new Date(overnight.end).toISOString()).toBe("2026-07-05T00:00:00.000Z");
    const multi = manualBlockInterval({ date: "2026-12-24", endDate: "2026-12-26", startTime: "00:00", endTime: "24:00" });
    expect(new Date(multi.start).toISOString()).toBe("2026-12-23T23:00:00.000Z");
    expect(new Date(multi.end).toISOString()).toBe("2026-12-26T23:00:00.000Z");
    expect(() => manualBlockInterval({ date: "2026-12-24", endDate: "2026-12-20", startTime: "00:00", endTime: "24:00" })).toThrow(AdminError);
  });

  let blockId: string;

  it("a manual block makes checkAvailability report the space as unavailable", async () => {
    expect((await available(["winter-garden", "restaurant"], day, "12:00", "16:00")).bookingAllowed).toBe(true);
    const res = await createManualBlocks(db, { spaceIds: ["winter-garden"], date: day, startTime: "10:00", endTime: "20:00", type: "maintenance", reason: "Glasreinigung" }, ACTOR);
    expect(res.created).toHaveLength(1);
    blockId = res.created[0]!.id;

    const check = await available(["winter-garden", "restaurant"], day, "12:00", "16:00");
    expect(check.bookingAllowed).toBe(false);
    expect(check.blockedSpaces.map((b) => b.spaceId)).toEqual(["winter-garden"]);
    expect(check.availableSpaceIds).toEqual(["restaurant"]);

    const cal = await getCalendarData(db, addDays(day, -5), 7);
    const bar = cal.bars.find((b) => b.id === blockId);
    expect(bar).toMatchObject({ spaceId: "winter-garden", type: "maintenance", manual: true, reason: "Glasreinigung" });
  });

  it("an overlapping manual block is rejected, naming the space, and nothing is written", async () => {
    const err = await createManualBlocks(
      db,
      { spaceIds: ["restaurant", "winter-garden"], date: day, startTime: "19:00", endTime: "22:00", type: "blocked", reason: "Überschneidung" },
      ACTOR,
    ).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "SLOT_TAKEN", status: 409 });
    expect((err as Error).message).toContain("Wintergarten");
    const restaurantBlocks = await db
      .select()
      .from(availabilityBlocks)
      .where(and(eq(availabilityBlocks.spaceId, "restaurant"), eq(availabilityBlocks.reason, "Überschneidung")));
    expect(restaurantBlocks).toHaveLength(0);
  });

  it("the database constraint itself rejects an overlapping active block (23P01)", async () => {
    const start = new Date(manualBlockInterval({ date: day, startTime: "11:00", endTime: "12:00" }).start);
    const end = new Date(manualBlockInterval({ date: day, startTime: "11:00", endTime: "12:00" }).end);
    await expect(db.insert(availabilityBlocks).values({ spaceId: "winter-garden", startAt: start, endAt: end, type: "blocked" })).rejects.toThrow();
  });

  it("lifting the block makes the space available again", async () => {
    await deactivateBlock(db, blockId, ACTOR);
    expect((await available(["winter-garden"], day, "12:00", "16:00")).bookingAllowed).toBe(true);
    await expect(deactivateBlock(db, "not-a-uuid", ACTOR)).rejects.toMatchObject({ status: 404 });
  });
});

describe("space master data", () => {
  it("updates prices (cents, null = unknown), features and map overrides", async () => {
    const result = await updateSpaceByAdmin(
      db,
      "side-room",
      { basePrice: 7500, deposit: null, features: ["Beamer", "Beamer", " Leinwand "], needsVerification: ["areaSqm"], polygonOverride: [[1, 2], [30, 2], [30, 40]], labelPositionOverride: { x: 10, y: 10 } },
      ACTOR,
    );
    expect(result!.space).toMatchObject({ basePrice: 7500, deposit: null, needsVerification: ["areaSqm"], labelPositionOverride: { x: 10, y: 10 } });
    expect(result!.features.map((f) => f.label)).toEqual(["Beamer", "Leinwand"]);
    await expect(updateSpaceByAdmin(db, "side-room", { minimumDurationMinutes: 240, maximumDurationMinutes: 60 }, ACTOR)).rejects.toMatchObject({ status: 422 });
    await expect(updateSpaceByAdmin(db, "does-not-exist", { name: "X" }, ACTOR)).rejects.toMatchObject({ status: 404 });
  });
});
