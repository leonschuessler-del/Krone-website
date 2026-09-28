import { count, sql } from "drizzle-orm";
import { spaceSeeds } from "@/content/spaces";
import { defaultSettings, demoSettings } from "@/content/settings";
import { extraSeeds } from "@/content/extras";
import { addDays, isoWeekday, todayLocal, zonedToUtc, type LocalDate } from "@/domain/time";
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

export interface DemoScenario {
  /** Saturday ≥ 14 days ahead: Wintergarten fully booked (test case 59/103). */
  winterGardenBookedDate: LocalDate;
  /** Following Sunday: Bühne blocked for maintenance 14:00–20:00. */
  stageMaintenanceDate: LocalDate;
  /** Friday ≥ 21 days ahead: Restaurant booked 18:00–23:00 (partially available). */
  restaurantEveningDate: LocalDate;
  /** Monday ≥ 35 days ahead: Biergarten blocked for 5 days. */
  beerGardenClosedFrom: LocalDate;
  /** Wednesday ≥ 10 days ahead: Alte Wirtschaft reserved 12:00–22:00. */
  oldTavernReservedDate: LocalDate;
}

function nextWeekday(from: LocalDate, weekday: number): LocalDate {
  let d = from;
  while (isoWeekday(d) !== weekday) d = addDays(d, 1);
  return d;
}

export function getDemoScenario(today: LocalDate = todayLocal()): DemoScenario {
  const sat = nextWeekday(addDays(today, 14), 6);
  return {
    winterGardenBookedDate: sat,
    stageMaintenanceDate: addDays(sat, 1),
    restaurantEveningDate: nextWeekday(addDays(today, 21), 5),
    beerGardenClosedFrom: nextWeekday(addDays(today, 35), 1),
    oldTavernReservedDate: nextWeekday(addDays(today, 10), 3),
  };
}

async function seedBase(db: Database): Promise<void> {
  for (const s of spaceSeeds) {
    const { features: _features, ...rest } = s;
    await db
      .insert(t.spaces)
      .values({ ...rest, weeklyHours: null })
      .onConflictDoNothing();
  }
  for (const e of extraSeeds) {
    await db
      .insert(t.extras)
      .values({ ...e, unitPrice: null, confirmed: false, isDemo: false })
      .onConflictDoNothing();
  }
  for (const [key, value] of Object.entries(defaultSettings)) {
    await db.insert(t.settings).values({ key, value }).onConflictDoNothing();
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
const DEMO_HOURLY: Record<string, number> = {
  restaurant: 12000,
  kitchen: 6000,
  "side-room": 7000,
  stage: 8000,
  "old-tavern": 9000,
  "winter-garden": 8500,
  "beer-garden": 7500,
};
const DEMO_CLEANING: Record<string, number> = {
  restaurant: 15000,
  kitchen: 12000,
  "side-room": 6000,
  stage: 8000,
  "old-tavern": 9000,
  "winter-garden": 8000,
  "beer-garden": 10000,
};
const DEMO_DEPOSIT: Record<string, number> = {
  restaurant: 50000,
  kitchen: 50000,
  "side-room": 20000,
  stage: 30000,
  "old-tavern": 30000,
  "winter-garden": 30000,
  "beer-garden": 30000,
};

async function seedDemo(db: Database, today: LocalDate): Promise<void> {
  // demo prices on spaces (the whole instance is flagged DEMO_MODE)
  for (const [spaceId, hourly] of Object.entries(DEMO_HOURLY)) {
    await db
      .update(t.spaces)
      .set({
        basePrice: hourly,
        priceModel: "hourly",
        cleaningFee: DEMO_CLEANING[spaceId] ?? null,
        deposit: DEMO_DEPOSIT[spaceId] ?? null,
        minimumDurationMinutes: spaceId === "restaurant" ? 180 : 120,
        advanceBookingMinHours: 48,
        advanceBookingMaxDays: 540,
        setupBufferMinutes: 60,
        cleanupBufferMinutes: 60,
      })
      .where(sql`${t.spaces.id} = ${spaceId}`);
    await db
      .insert(t.pricingRules)
      .values([
        {
          id: `demo-${spaceId}-weekend`,
          spaceId,
          label: "Wochenende (Fr/Sa) – Demo",
          priceModel: "hourly",
          amount: Math.round(hourly * 1.2),
          weekdays: [5, 6],
          priority: 10,
          isDemo: true,
        },
        {
          id: `demo-${spaceId}-december`,
          spaceId,
          label: "Adventszeit – Demo",
          priceModel: "hourly",
          amount: Math.round(hourly * 1.3),
          weekdays: null,
          validFrom: `${today.slice(0, 4)}-11-27`,
          validTo: `${today.slice(0, 4)}-12-23`,
          priority: 20,
          isDemo: true,
        },
      ])
      .onConflictDoNothing();
  }

  await db
    .insert(t.bundlePricingRules)
    .values([
      {
        id: "demo-bundle-restaurant-stage",
        name: "Kombi Restaurant + Bühne (Demo)",
        spaceIds: ["restaurant", "stage"],
        matchMode: "exact",
        adjustment: { type: "percent_discount", value: 10 },
        priority: 10,
        isDemo: true,
      },
      {
        id: "demo-bundle-restaurant-winter-garden",
        name: "Kombi Restaurant + Wintergarten (Demo)",
        spaceIds: ["restaurant", "winter-garden"],
        matchMode: "exact",
        adjustment: { type: "percent_discount", value: 10 },
        priority: 10,
        isDemo: true,
      },
      {
        id: "demo-bundle-restaurant-stage-beer-garden",
        name: "Sommerfest-Paket: Restaurant + Bühne + Biergarten (Demo)",
        spaceIds: ["restaurant", "stage", "beer-garden"],
        matchMode: "exact",
        adjustment: { type: "percent_discount", value: 15 },
        priority: 20,
        isDemo: true,
      },
      {
        id: "demo-bundle-full-venue",
        name: "Gesamte Location (Demo)",
        spaceIds: spaceSeeds.filter((s) => s.includedInFullVenue && s.bookable).map((s) => s.id),
        matchMode: "subset",
        adjustment: { type: "percent_discount", value: 20 },
        // full venue is always individually coordinated → inquiry
        bookingMode: "inquiry",
        isFullVenue: true,
        priority: 100,
        isDemo: true,
      },
    ])
    .onConflictDoNothing();

  const demoExtraPrices: Record<string, number> = {
    "extra-cleaning": 9000,
    "av-tech": 25000,
    "stage-tech": 35000,
    seating: 450,
    "kitchen-use": 20000,
    "cold-storage": 6000,
    "setup-time": 5000,
    "teardown-time": 5000,
    "service-staff": 3500,
  };
  for (const [id, price] of Object.entries(demoExtraPrices)) {
    await db.update(t.extras).set({ unitPrice: price, isDemo: true }).where(sql`${t.extras.id} = ${id}`);
  }

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

  // availability blocks – DEMO / SEED ONLY
  const sc = getDemoScenario(today);
  const block = (spaceId: string, date: LocalDate, from: number, to: number, type: "booked" | "reserved" | "blocked" | "maintenance", reason: string) => ({
    spaceId,
    startAt: new Date(zonedToUtc(date, from)),
    endAt: new Date(zonedToUtc(date, to)),
    type,
    reason: `${reason} (DEMO)`,
    isDemo: true,
    createdBy: "seed",
  });
  const beerGardenDays = [0, 1, 2, 3, 4].map((i) => addDays(sc.beerGardenClosedFrom, i));
  await db.insert(t.availabilityBlocks).values([
    block("winter-garden", sc.winterGardenBookedDate, 0, 24 * 60 + 120, "booked", "Hochzeitsfeier"),
    block("stage", sc.stageMaintenanceDate, 14 * 60, 20 * 60, "maintenance", "Wartung Bühnentechnik"),
    block("restaurant", sc.restaurantEveningDate, 17 * 60, 24 * 60, "booked", "Firmenfeier"),
    block("old-tavern", sc.oldTavernReservedDate, 11 * 60, 23 * 60, "reserved", "Reservierung in Klärung"),
    block("beer-garden", beerGardenDays[0]!, 0, 5 * 24 * 60, "blocked", "Saisonpause Biergarten"),
    block("restaurant", addDays(sc.winterGardenBookedDate, 7), 0, 13 * 60, "booked", "Mittagsgesellschaft"),
    block("side-room", addDays(sc.winterGardenBookedDate, 7), 12 * 60, 18 * 60, "booked", "Geburtstag"),
    block("kitchen", addDays(sc.restaurantEveningDate, 14), 6 * 60, 15 * 60, "maintenance", "Reinigung Küchentechnik"),
  ]);
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
