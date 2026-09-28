import { eq } from "drizzle-orm";
import { defaultSettings, type BookableHoursSetting, type HoldSetting, type PaymentPolicySetting } from "@/content/settings";
import type { Database } from "@/server/db/client";
import { settings } from "@/server/db/schema";

export interface VenueSettings {
  bookableHours: BookableHoursSetting;
  paymentPolicy: PaymentPolicySetting;
  holds: HoldSetting;
}

export async function getVenueSettings(db: Database): Promise<VenueSettings> {
  const rows = await db.select().from(settings);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    bookableHours: (map.get("bookableHours") as BookableHoursSetting | undefined) ?? defaultSettings.bookableHours,
    paymentPolicy: (map.get("paymentPolicy") as PaymentPolicySetting | undefined) ?? defaultSettings.paymentPolicy,
    holds: (map.get("holds") as HoldSetting | undefined) ?? defaultSettings.holds,
  };
}

export async function updateSetting<K extends keyof VenueSettings>(db: Database, key: K, value: VenueSettings[K]): Promise<void> {
  const existing = await db.select().from(settings).where(eq(settings.key, key));
  if (existing.length) await db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, key));
  else await db.insert(settings).values({ key, value });
}
