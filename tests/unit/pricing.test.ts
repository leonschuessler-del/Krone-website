import { describe, expect, it } from "vitest";
import { calculateQuote, findBundle, type BundleRule, type PaymentPolicy, type PricedSpace, type PricingRule } from "@/domain/pricing";
import { zonedDateTimeToUtc } from "@/domain/time";

const space = (id: string, basePrice: number | null, extra: Partial<PricedSpace> = {}): PricedSpace => ({
  id,
  name: id,
  basePrice,
  priceModel: basePrice === null ? null : "hourly",
  cleaningFee: 10000,
  deposit: 30000,
  minimumDurationMinutes: null,
  bookingMode: "both",
  ...extra,
});

const policy: PaymentPolicy = { mode: "down_payment", downPaymentPercent: 30, depositCollection: "separately", depositStrategy: "sum" };

function request(spaceIds: string[], date = "2026-10-14", start = "16:00", end = "20:00") {
  return {
    spaceIds,
    start: zonedDateTimeToUtc(date, start),
    end: zonedDateTimeToUtc(date, end),
    rentalMode: "hourly" as const,
    dates: [date],
    guestCount: 50,
    extras: [],
  };
}

describe("pricing engine", () => {
  const spaces = [space("restaurant", 10000), space("stage", 5000), space("winter-garden", 8000)];

  it("hourly price × duration + cleaning, Kaution separat", () => {
    const q = calculateQuote({ request: request(["restaurant"]), spaces, rules: [], bundles: [], extras: [], policy });
    expect(q.rentalSubtotal).toBe(40000); // 4 h × 100 €
    expect(q.cleaningTotal).toBe(10000);
    expect(q.total).toBe(50000);
    expect(q.deposit).toBe(30000);
    expect(q.vat.amount).toBe(9500); // 19 % on the net total
    expect(q.grossTotal).toBe(59500);
    expect(q.dueNow).toBe(17850); // 30 % down payment on the gross total, deposit collected separately
    expect(q.isComplete).toBe(true);
  });

  it("applies the minimum rental duration", () => {
    const s = [space("restaurant", 10000, { minimumDurationMinutes: 360 })];
    const q = calculateQuote({ request: request(["restaurant"]), spaces: s, rules: [], bundles: [], extras: [], policy });
    expect(q.rentalSubtotal).toBe(60000);
  });

  it("weekday/weekend rules by priority", () => {
    const rules: PricingRule[] = [
      { id: "we", spaceId: "restaurant", label: "Wochenende", priceModel: "hourly", amount: 15000, weekdays: [5, 6], validFrom: null, validTo: null, minDurationMinutes: null, priority: 10, active: true, isDemo: false },
    ];
    const weekday = calculateQuote({ request: request(["restaurant"], "2026-10-14"), spaces, rules, bundles: [], extras: [], policy });
    const saturday = calculateQuote({ request: request(["restaurant"], "2026-10-17"), spaces, rules, bundles: [], extras: [], policy });
    expect(weekday.rentalSubtotal).toBe(40000);
    expect(saturday.rentalSubtotal).toBe(60000);
  });

  it("seasonal rule wins inside its date range only", () => {
    const rules: PricingRule[] = [
      { id: "xmas", spaceId: "restaurant", label: "Advent", priceModel: "flat", amount: 99900, weekdays: null, validFrom: "2026-12-01", validTo: "2026-12-23", minDurationMinutes: null, priority: 20, active: true, isDemo: false },
    ];
    expect(calculateQuote({ request: request(["restaurant"], "2026-12-05"), spaces, rules, bundles: [], extras: [], policy }).rentalSubtotal).toBe(99900);
    expect(calculateQuote({ request: request(["restaurant"], "2026-11-05"), spaces, rules, bundles: [], extras: [], policy }).rentalSubtotal).toBe(40000);
  });

  it("unknown price → null (never 0) and inquiry mode", () => {
    const s = [space("restaurant", 10000), space("stage", null)];
    const q = calculateQuote({ request: request(["restaurant", "stage"]), spaces: s, rules: [], bundles: [], extras: [], policy });
    expect(q.total).toBeNull();
    expect(q.dueNow).toBeNull();
    expect(q.isComplete).toBe(false);
    expect(q.bookingMode).toBe("inquiry");
    expect(q.missing).toContain("Miete stage");
  });
});

describe("bundle pricing (Kombinationspreise)", () => {
  const spaces = [space("restaurant", 10000), space("stage", 5000), space("beer-garden", 6000)];
  const bundles: BundleRule[] = [
    { id: "rs", name: "Restaurant + Bühne", spaceIds: ["restaurant", "stage"], matchMode: "exact", adjustment: { type: "percent_discount", value: 10 }, bookingMode: null, isFullVenue: false, priority: 10, active: true, isDemo: false },
    { id: "rsb", name: "Sommerfest", spaceIds: ["restaurant", "stage", "beer-garden"], matchMode: "exact", adjustment: { type: "fixed_price", priceModel: "flat", value: 50000 }, bookingMode: null, isFullVenue: false, priority: 20, active: true, isDemo: false },
    { id: "full", name: "Gesamte Location", spaceIds: ["restaurant", "stage", "beer-garden"], matchMode: "subset", adjustment: null, bookingMode: "inquiry", isFullVenue: true, priority: 5, active: true, isDemo: false },
  ];

  it("combination is not necessarily the sum of single prices", () => {
    const q = calculateQuote({ request: request(["restaurant", "stage"]), spaces, rules: [], bundles, extras: [], policy });
    expect(q.rentalSubtotal).toBe(60000);
    expect(q.discountTotal).toBe(6000);
    expect(q.total).toBe(60000 - 6000 + 20000);
    expect(q.appliedBundle?.id).toBe("rs");
  });

  it("fixed package price for an exact combination", () => {
    const q = calculateQuote({ request: request(["restaurant", "stage", "beer-garden"]), spaces, rules: [], bundles, extras: [], policy });
    expect(q.appliedBundle?.id).toBe("rsb");
    expect(q.rentalSubtotal! - q.discountTotal).toBe(50000);
  });

  it("combination-specific booking mode (full venue → inquiry)", () => {
    const b = findBundle(["restaurant", "stage", "beer-garden"], bundles.filter((x) => x.id !== "rsb"));
    expect(b?.id).toBe("full");
    const q = calculateQuote({ request: request(["restaurant", "stage", "beer-garden"]), spaces, rules: [], bundles: bundles.filter((x) => x.id !== "rsb"), extras: [], policy });
    expect(q.bookingMode).toBe("inquiry");
  });

  it("extras: per person, per hour and on request", () => {
    const extras = [
      { id: "seating", name: "Bestuhlung", priceModel: "per_person" as const, unitPrice: 400, active: true, isDemo: false },
      { id: "staff", name: "Personal", priceModel: "per_hour" as const, unitPrice: 3000, active: true, isDemo: false },
      { id: "hotel", name: "Hotel", priceModel: "on_request" as const, unitPrice: null, active: true, isDemo: false },
    ];
    const req = { ...request(["restaurant"]), extras: [{ extraId: "seating", quantity: 1 }, { extraId: "staff", quantity: 2 }] };
    const q = calculateQuote({ request: req, spaces, rules: [], bundles: [], extras, policy });
    expect(q.extrasTotal).toBe(50 * 400 + 4 * 3000 * 2);
    const q2 = calculateQuote({ request: { ...req, extras: [{ extraId: "hotel", quantity: 1 }] }, spaces, rules: [], bundles: [], extras, policy });
    expect(q2.extrasTotal).toBeNull();
    expect(q2.total).toBeNull();
  });
});
