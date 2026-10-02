import { count, eq, sql } from "drizzle-orm";
import { hotelRoomSeeds, roomTypeSeeds } from "@/content/hotel";
import { spaceSeeds } from "@/content/spaces";
import { defaultSettings, demoSettings } from "@/content/settings";
import { extraSeeds } from "@/content/extras";
import { demoBlockSpecs } from "@/content/demo-scenario";
import { addDays, todayLocal, zonedToUtc, type LocalDate } from "@/domain/time";
import { hashPassword } from "@/server/auth/password";
import type { Database } from "./client";
import * as t from "./schema";

/**
 * Seeding.
 *
 * BASE SEED (always, idempotent): spaces with all unknown facts = NULL,
 * extras WITHOUT prices (not confirmed), settings with placeholders.
 *
 * DEMO SEED (DEMO_MODE only)  ── DEMO / SEED ONLY ──
 *  - demo prices (flagged is_demo) so the pricing engine can be tried out
 *  - demo availability blocks relative to the seed date, reproducing the
 *    multi-space test scenario (Wintergarten booked while Restaurant and
 *    Bühne are free) – see getDemoScenario()
 *  - demo handover/return slots
 */

export { getDemoScenario, type DemoScenario } from "@/content/demo-scenario";

async function seedBase(db: Database): Promise<void> {
  for (const s of spaceSeeds) {
    const { features: _features, ...rest } = s;
    // prices, seats and combination rules come from the operator's price sheet → keep them current
    const priced = {
      basePrice: rest.basePrice,
      priceModel: rest.priceModel,
      capacitySeated: rest.capacitySeated,
      cleaningFee: rest.cleaningFee,
      requires: rest.requires,
      availableForStandaloneRental: rest.availableForStandaloneRental,
      bookingMode: rest.bookingMode,
      bookable: rest.bookable,
      includedInFullVenue: rest.includedInFullVenue,
      needsVerification: rest.needsVerification,
    };
    await db
      .insert(t.spaces)
      .values({ ...rest, weeklyHours: null })
      .onConflictDoUpdate({ target: t.spaces.id, set: priced });
  }
  for (const e of extraSeeds) {
    await db
      .insert(t.extras)
      .values({ ...e, confirmed: true, isDemo: false })
      .onConflictDoUpdate({ target: t.extras.id, set: { name: e.name, description: e.description, priceModel: e.priceModel, unitPrice: e.unitPrice, confirmed: true, isDemo: false } });
  }
  for (const [key, value] of Object.entries(defaultSettings)) {
    await db.insert(t.settings).values({ key, value }).onConflictDoNothing();
  }
  // hotel: room types and rooms (prices from the operator; apartment on request)
  for (const r of roomTypeSeeds) {
    const row = { name: r.name, description: r.description, maxGuests: r.maxGuests, basePricePerNight: r.basePricePerNight, inventoryGroup: r.inventoryGroup, sortOrder: r.sortOrder, active: true };
    await db.insert(t.roomTypes).values({ id: r.id, ...row }).onConflictDoUpdate({ target: t.roomTypes.id, set: row });
  }
  for (const room of hotelRoomSeeds) {
    await db.insert(t.hotelRooms).values({ ...room, active: true }).onConflictDoNothing();
  }
}

async function seedAdmin(db: Database): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const [{ n }] = (await db.select({ n: count() }).from(t.adminUsers)) as [{ n: number }];
  if (Number(n) > 0) return;
  if (email && password) {
    await db.insert(t.adminUsers).values({ email, name: "Administrator", passwordHash: await hashPassword(password), role: "owner" });
    console.info(`[seed] Admin-Zugang angelegt: ${email}`);
    return;
  }
  if (process.env.NODE_ENV === "test") return;
  // No credentials configured: create a local admin with a random password,
  // printed ONCE to the server console (never stored in plain text).
  const { randomBytes } = await import("node:crypto");
  const generated = randomBytes(12).toString("base64url");
  const fallbackEmail = email ?? "admin@krone.local";
  await db.insert(t.adminUsers).values({ email: fallbackEmail, name: "Administrator", passwordHash: await hashPassword(generated), role: "owner" });
  console.info(
    `\n[seed] ────────────────────────────────────────────────\n` +
      `[seed] Admin-Zugang (einmalig angezeigt – bitte notieren):\n` +
      `[seed]   E-Mail:   ${fallbackEmail}\n[seed]   Passwort: ${generated}\n` +
      `[seed] Eigene Zugangsdaten: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD setzen\n` +
      `[seed] oder "npm run admin:create" ausführen.\n[seed] ────────────────────────────────────────────────\n`,
  );
}

// ── DEMO / SEED ONLY ────────────────────────────────────────────────────────
async function seedDemo(db: Database, today: LocalDate): Promise<void> {
  // Prices are real (seedBase); the demo adds only the scenario: settings, handover slots, blocks.
  for (const [key, value] of Object.entries(demoSettings)) {
    await db
      .insert(t.settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: t.settings.key, set: { value } });
  }

  const handover = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];
  const ret = ["22:00", "23:00", "08:00", "10:00", "12:00"];
  await db
    .insert(t.handoverSlots)
    .values([
      ...handover.map((time) => ({ id: `demo-handover-${time}`, kind: "handover" as const, time, weekdays: null, label: `${time} Uhr`, isDemo: true })),
      ...ret.map((time) => ({ id: `demo-return-${time}`, kind: "return" as const, time, weekdays: null, label: `${time} Uhr`, isDemo: true })),
    ])
    .onConflictDoNothing();

  // availability blocks – DEMO / SEED ONLY (same specs as the static preview)
  // blocks have generated ids → guard against a second demo seed
  const [{ n: existingDemoBlocks }] = (await db
    .select({ n: count() })
    .from(t.availabilityBlocks)
    .where(eq(t.availabilityBlocks.isDemo, true))) as [{ n: number }];
  if (Number(existingDemoBlocks) > 0) return;
  await db.insert(t.availabilityBlocks).values(
    demoBlockSpecs(today).map((b) => ({
      spaceId: b.spaceId,
      startAt: new Date(zonedToUtc(b.date, b.from)),
      endAt: new Date(zonedToUtc(b.date, b.to)),
      type: b.type,
      reason: `${b.reason} (DEMO)`,
      isDemo: true,
      createdBy: "seed",
    })),
  );
}

export async function seedDatabase(db: Database, options: { demo: boolean; today?: LocalDate }): Promise<void> {
  await seedBase(db);
  if (options.demo) await seedDemo(db, options.today ?? todayLocal());
  await seedAdmin(db);
}

/**
 * Called on startup of the embedded DB: seeds once if the database is empty.
 */
export async function ensureSeeded(db: Database): Promise<void> {
  const [{ n }] = (await db.select({ n: count() }).from(t.spaces)) as [{ n: number }];
  if (Number(n) > 0) {
    await seedBase(db); // add newly configured spaces/extras/settings idempotently
    return;
  }
  const { env } = await import("@/lib/env");
  await seedDatabase(db, { demo: env.demoMode });
}
