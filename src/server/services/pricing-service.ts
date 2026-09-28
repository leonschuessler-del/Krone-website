import { asc } from "drizzle-orm";
import { calculateQuote, type BundleRule, type ExtraDefinition, type PricedSpace, type PricingRule, type Quote } from "@/domain/pricing";
import { resolveSchedule, type ScheduleInput } from "@/domain/schedule";
import { env } from "@/lib/env";
import type { Database } from "@/server/db/client";
import { bundlePricingRules, extras as extrasTable, pricingRules } from "@/server/db/schema";
import { getVenueSettings } from "./settings-service";
import { listSpaceRows } from "./space-service";

/**
 * pricingService – loads price data and delegates to the pure pricing engine.
 * The server is the source of truth for every amount shown or charged.
 */

export interface QuoteInput extends ScheduleInput {
  spaceIds: string[];
  guestCount?: number | null;
  extras?: Array<{ extraId: string; quantity: number }>;
}

export async function listOfferedExtras(db: Database): Promise<Array<typeof extrasTable.$inferSelect>> {
  const rows = await db.select().from(extrasTable).orderBy(asc(extrasTable.sortOrder));
  // Production: only extras the operator confirmed. Demo: all active (flagged in UI).
  return rows.filter((e) => e.active && (e.confirmed || env.demoMode));
}

export async function loadPricingData(db: Database) {
  const [rows, rules, bundles, extraRows, settings] = await Promise.all([
    listSpaceRows(db),
    db.select().from(pricingRules),
    db.select().from(bundlePricingRules),
    listOfferedExtras(db),
    getVenueSettings(db),
  ]);
  const spaces: PricedSpace[] = rows
    .filter((r) => r.bookable)
    .map((r) => ({
      id: r.id,
      name: r.name,
      basePrice: r.basePrice,
      priceModel: r.priceModel,
      cleaningFee: r.cleaningFee,
      deposit: r.deposit,
      minimumDurationMinutes: r.minimumDurationMinutes,
      bookingMode: r.bookingMode,
    }));
  const pricing: PricingRule[] = rules.map((r) => ({ ...r, weekdays: r.weekdays ?? null }));
  const bundleRules: BundleRule[] = bundles.map((b) => ({ ...b, adjustment: b.adjustment ?? null, bookingMode: b.bookingMode ?? null }));
  const extras: ExtraDefinition[] = extraRows.map((e) => ({
    id: e.id,
    name: e.name,
    priceModel: e.priceModel,
    unitPrice: e.unitPrice,
    active: e.active,
    isDemo: e.isDemo,
  }));
  return { spaces, pricing, bundleRules, extras, settings, extraRows };
}

export async function calculatePrice(db: Database, input: QuoteInput): Promise<Quote & { paymentEnabled: boolean }> {
  const data = await loadPricingData(db);
  const resolved = resolveSchedule(input, data.settings.bookableHours.weeklyHours);
  if (resolved.kind !== "range") throw new Error("Für die Preisberechnung wird ein Zeitraum benötigt");
  const quote = calculateQuote({
    request: {
      spaceIds: input.spaceIds,
      start: resolved.start,
      end: resolved.end,
      rentalMode: resolved.rentalMode,
      dates: resolved.dates,
      guestCount: input.guestCount ?? null,
      extras: (input.extras ?? []).map((e) => ({
        extraId: e.extraId,
        quantity: Math.min(Math.max(0, Math.floor(e.quantity)), data.extraRows.find((x) => x.id === e.extraId)?.maxQuantity ?? 1),
      })),
    },
    spaces: data.spaces,
    rules: data.pricing,
    bundles: data.bundleRules,
    extras: data.extras,
    policy: data.settings.paymentPolicy,
  });
  const paymentEnabled = data.settings.paymentPolicy.mode !== "none" && env.paymentProvider !== "none";
  return {
    ...quote,
    isDemo: quote.isDemo || env.demoMode,
    bookingMode: paymentEnabled ? quote.bookingMode : "inquiry",
    paymentEnabled,
  };
}
