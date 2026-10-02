import { calculateQuote, type ExtraDefinition, type PricedSpace, type Quote } from "@/domain/pricing";

/**
 * Price estimate before a date is chosen. The rooms are flat packages
 * (Fri–Sun), so the amount does not depend on the time – only further days
 * and per-guest add-ons change it later. Used by the planner, the wizard's
 * summary and the preview, so every "Gesamt" shows the same figures.
 */
export interface ProvisionalSpace {
  id: string;
  name: string;
  basePrice: number | null;
  priceModel: PricedSpace["priceModel"];
  cleaningFee: number | null;
  deposit?: number | null;
}

export interface ProvisionalExtra {
  id: string;
  name: string;
  priceModel: ExtraDefinition["priceModel"];
  unitPrice: number | null;
}

export function provisionalQuote(
  spaces: readonly ProvisionalSpace[],
  selectedIds: readonly string[],
  options: { extras?: readonly ProvisionalExtra[]; chosenExtras?: readonly string[]; guestCount?: number | null; dates?: readonly string[] } = {},
): Quote | null {
  const ids = selectedIds.filter((id) => spaces.some((s) => s.id === id));
  if (!ids.length) return null;
  const start = Date.UTC(2030, 0, 4, 17); // any Friday evening – flat prices ignore the exact time
  return calculateQuote({
    request: {
      spaceIds: ids,
      start,
      end: start + 5 * 3_600_000,
      rentalMode: "hourly",
      dates: [...(options.dates ?? ["2030-01-04"])],
      guestCount: options.guestCount ?? null,
      extras: (options.chosenExtras ?? []).map((extraId) => ({ extraId, quantity: 1 })),
    },
    spaces: spaces.map((s) => ({
      id: s.id,
      name: s.name,
      basePrice: s.basePrice,
      priceModel: s.priceModel,
      deposit: s.deposit ?? null,
      cleaningFee: s.cleaningFee,
      minimumDurationMinutes: null,
      bookingMode: "inquiry" as const,
    })),
    rules: [],
    bundles: [],
    extras: (options.extras ?? []).map((e) => ({ id: e.id, name: e.name, priceModel: e.priceModel, unitPrice: e.unitPrice, active: true, isDemo: false })),
    policy: { mode: "none", downPaymentPercent: null, depositCollection: "separately", depositStrategy: "sum" },
  });
}
