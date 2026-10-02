import { addDays, isoWeekday, utcToLocal, type LocalDate } from "./time";
import type { BookingMode, PriceModel, RentalMode, SpaceId } from "./types";

/**
 * ============================================================================
 *  PRICING ENGINE (pure, no I/O) – the only place where prices are computed.
 * ============================================================================
 *  Money: integer cents. `null` = unknown → shown as "Preis folgt" / "auf
 *  Anfrage" – never as 0 €.
 *  Supports: hourly / daily / flat prices, minimum duration, weekday/weekend
 *  and seasonal rules (priority based), bundle (combination) prices,
 *  cleaning fees, extras, security deposit (Kaution – NOT revenue),
 *  down payment policy.
 *  The server always recomputes the quote; client values are never trusted.
 * ============================================================================
 */

export interface PricedSpace {
  id: SpaceId;
  name: string;
  basePrice: number | null;
  priceModel: PriceModel | null;
  cleaningFee: number | null;
  deposit: number | null;
  minimumDurationMinutes: number | null;
  bookingMode: BookingMode;
}

export interface PricingRule {
  id: string;
  spaceId: SpaceId;
  label: string;
  priceModel: Exclude<PriceModel, "on_request">;
  amount: number;
  /** ISO weekdays (1–7) this rule applies to; null = all days */
  weekdays: number[] | null;
  validFrom: LocalDate | null;
  validTo: LocalDate | null;
  minDurationMinutes: number | null;
  priority: number;
  active: boolean;
  isDemo: boolean;
}

export type BundleAdjustment =
  | { type: "percent_discount"; value: number }
  | { type: "amount_discount"; value: number }
  | { type: "fixed_price"; priceModel: "hourly" | "daily" | "flat"; value: number };

export interface BundleRule {
  id: string;
  name: string;
  spaceIds: SpaceId[];
  /** exact: selection must equal the bundle; subset: bundle spaces contained in selection */
  matchMode: "exact" | "subset";
  adjustment: BundleAdjustment | null;
  /** Overrides the booking mode for this combination (e.g. full venue → inquiry). */
  bookingMode: BookingMode | null;
  isFullVenue: boolean;
  priority: number;
  active: boolean;
  isDemo: boolean;
}

export type ExtraPriceModel = "flat" | "per_hour" | "per_day" | "per_person" | "per_unit" | "on_request";

export interface ExtraDefinition {
  id: string;
  name: string;
  priceModel: ExtraPriceModel;
  unitPrice: number | null;
  active: boolean;
  isDemo: boolean;
}

export interface PaymentPolicy {
  /** full: pay rent completely; down_payment: pay a percentage now; none: inquiry / pay later */
  mode: "full" | "down_payment" | "none";
  downPaymentPercent: number | null;
  /** When the security deposit is collected. */
  depositCollection: "with_payment" | "separately";
  depositStrategy: "sum" | "max";
}

export interface QuoteRequest {
  spaceIds: SpaceId[];
  start: number;
  end: number;
  rentalMode: RentalMode;
  /** Local dates covered (for daily rentals: each rented day). */
  dates: LocalDate[];
  guestCount: number | null;
  extras: Array<{ extraId: string; quantity: number }>;
}

export interface QuoteLine {
  kind: "rental" | "bundle" | "extra" | "cleaning";
  refId: string;
  label: string;
  detail: string | null;
  amount: number | null;
  isDemo: boolean;
}

/** A flat room price covers the weekend (Fri–Sun); every further day costs this much extra. */
export const PACKAGE_DAYS = 3;
export const EXTRA_DAY_FEE = 10000;
/** All prices are net; German VAT. */
export const VAT_RATE = 19;

export interface Quote {
  currency: "EUR";
  lines: QuoteLine[];
  rentalSubtotal: number | null;
  discountTotal: number;
  extrasTotal: number | null;
  cleaningTotal: number | null;
  /** Mietsumme net (without Kaution) */
  total: number | null;
  /** VAT on the net total */
  vat: { rate: number; amount: number | null };
  /** Mietsumme incl. VAT */
  grossTotal: number | null;
  /** Kaution – refundable, not revenue */
  deposit: number | null;
  /** Due today (down payment / full amount, plus Kaution if collected with payment) */
  dueNow: number | null;
  durationMinutes: number;
  billableUnits: { hours: number; days: number };
  appliedBundle: { id: string; name: string } | null;
  bookingMode: BookingMode;
  /** true when every component has a known price */
  isComplete: boolean;
  isDemo: boolean;
  missing: string[];
  notes: string[];
}

const euro = (cents: number) => (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

function ruleApplies(rule: PricingRule, date: LocalDate, durationMinutes: number): boolean {
  if (!rule.active) return false;
  if (rule.weekdays && !rule.weekdays.includes(isoWeekday(date))) return false;
  if (rule.validFrom && date < rule.validFrom) return false;
  if (rule.validTo && date > rule.validTo) return false;
  if (rule.minDurationMinutes !== null && durationMinutes < rule.minDurationMinutes) return false;
  return true;
}

/** Most specific applicable rule for a space on a date; falls back to the space's base price. */
export function resolveRate(
  space: PricedSpace,
  rules: readonly PricingRule[],
  date: LocalDate,
  durationMinutes: number,
): { priceModel: PriceModel; amount: number | null; label: string | null; isDemo: boolean; ruleId: string | null } {
  const candidates = rules
    .filter((r) => r.spaceId === space.id && ruleApplies(r, date, durationMinutes))
    .sort((a, b) => b.priority - a.priority);
  const rule = candidates[0];
  if (rule) return { priceModel: rule.priceModel, amount: rule.amount, label: rule.label, isDemo: rule.isDemo, ruleId: rule.id };
  if (space.priceModel && space.priceModel !== "on_request" && space.basePrice !== null) {
    return { priceModel: space.priceModel, amount: space.basePrice, label: null, isDemo: false, ruleId: null };
  }
  return { priceModel: space.priceModel ?? "on_request", amount: null, label: null, isDemo: false, ruleId: null };
}

function billableHours(durationMinutes: number, minimumMinutes: number | null): number {
  const minutes = Math.max(durationMinutes, minimumMinutes ?? 0);
  return Math.ceil(minutes / 30) / 2; // billed in half hours
}

export function findBundle(spaceIds: readonly SpaceId[], bundles: readonly BundleRule[]): BundleRule | null {
  const sel = new Set(spaceIds);
  const matching = bundles.filter((b) => {
    if (!b.active || b.spaceIds.length === 0) return false;
    const contained = b.spaceIds.every((id) => sel.has(id));
    return b.matchMode === "exact" ? contained && b.spaceIds.length === sel.size : contained;
  });
  matching.sort((a, b) => b.priority - a.priority || b.spaceIds.length - a.spaceIds.length);
  return matching[0] ?? null;
}

export function calculateQuote(input: {
  request: QuoteRequest;
  spaces: readonly PricedSpace[];
  rules: readonly PricingRule[];
  bundles: readonly BundleRule[];
  extras: readonly ExtraDefinition[];
  policy: PaymentPolicy;
}): Quote {
  const { request, spaces, rules, bundles, extras, policy } = input;
  const durationMinutes = Math.round((request.end - request.start) / 60_000);
  const dates = request.dates.length ? request.dates : [utcToLocal(request.start).date];
  const days = request.rentalMode === "daily" ? dates.length : 1;
  const lines: QuoteLine[] = [];
  const missing: string[] = [];
  const notes: string[] = [];
  let isDemo = false;

  const selected = request.spaceIds
    .map((id) => spaces.find((s) => s.id === id))
    .filter((s): s is PricedSpace => Boolean(s));

  // --- rent per space --------------------------------------------------------
  const rentBySpace = new Map<SpaceId, number | null>();
  for (const space of selected) {
    let amount: number | null = 0;
    const details: string[] = [];
    let lineDemo = false;
    const perDayDates = request.rentalMode === "daily" ? dates : [dates[0]!];
    for (const date of perDayDates) {
      const rate = resolveRate(space, rules, date, durationMinutes);
      lineDemo ||= rate.isDemo;
      if (rate.amount === null || rate.priceModel === "on_request") {
        amount = null;
        break;
      }
      let part: number;
      if (rate.priceModel === "hourly") {
        const hours =
          request.rentalMode === "daily"
            ? billableHours(durationMinutes / perDayDates.length, space.minimumDurationMinutes)
            : billableHours(durationMinutes, space.minimumDurationMinutes);
        part = Math.round(rate.amount * hours);
        details.push(`${hours.toLocaleString("de-DE")} Std. × ${euro(rate.amount)}`);
        if (space.minimumDurationMinutes && durationMinutes < space.minimumDurationMinutes) {
          notes.push(`${space.name}: Mindestmietdauer ${space.minimumDurationMinutes / 60} Std. berechnet.`);
        }
      } else if (rate.priceModel === "daily") {
        part = rate.amount;
        details.push(`1 Tag × ${euro(rate.amount)}`);
      } else {
        part = rate.amount;
        details.push(`Pauschale ${euro(rate.amount)}`);
        if (request.rentalMode === "daily") {
          // flat = per booking, not per day
          amount = (amount ?? 0) + part;
          break;
        }
      }
      amount = (amount ?? 0) + part;
    }
    if (amount === null) missing.push(`Miete ${space.name}`);
    isDemo ||= lineDemo;
    rentBySpace.set(space.id, amount);
    lines.push({
      kind: "rental",
      refId: space.id,
      label: space.name,
      detail: amount === null ? "Preis auf Anfrage" : details.length > 2 ? `${details.length} Tage` : details.join(" + "),
      amount,
      isDemo: lineDemo,
    });
  }

  // --- weekend package: further days ---------------------------------------------
  if (request.rentalMode === "daily" && dates.length > PACKAGE_DAYS && selected.some((s) => s.priceModel === "flat")) {
    const extraDays = dates.length - PACKAGE_DAYS;
    const amount = extraDays * EXTRA_DAY_FEE;
    rentBySpace.set("extra-days" as SpaceId, amount);
    lines.push({ kind: "rental", refId: "extra-days", label: "Weitere Miettage", detail: `${extraDays} × ${euro(EXTRA_DAY_FEE)} (Pauschale gilt Fr–So)`, amount, isDemo: false });
  }

  const rentValues = [...rentBySpace.values()];
  const rentalSubtotal = rentValues.some((v) => v === null) || selected.length === 0 ? null : rentValues.reduce<number>((a, b) => a + (b ?? 0), 0);

  // --- bundle / combination price ---------------------------------------------
  const bundle = findBundle(request.spaceIds, bundles);
  let discountTotal = 0;
  if (bundle?.adjustment) {
    const bundleRent = bundle.spaceIds.map((id) => rentBySpace.get(id) ?? null);
    const bundleRentKnown = bundleRent.every((v) => v !== null) ? bundleRent.reduce<number>((a, b) => a + (b ?? 0), 0) : null;
    let bundlePrice: number | null = null;
    const adj = bundle.adjustment;
    if (adj.type === "fixed_price") {
      bundlePrice =
        adj.priceModel === "hourly" ? Math.round(adj.value * billableHours(durationMinutes, null)) : adj.priceModel === "daily" ? adj.value * days : adj.value;
    } else if (bundleRentKnown !== null) {
      bundlePrice =
        adj.type === "percent_discount"
          ? Math.round(bundleRentKnown * (1 - adj.value / 100))
          : Math.max(0, bundleRentKnown - adj.value);
    }
    if (bundlePrice !== null && bundleRentKnown !== null) {
      discountTotal = Math.max(0, bundleRentKnown - bundlePrice);
      if (discountTotal > 0) {
        isDemo ||= bundle.isDemo;
        lines.push({
          kind: "bundle",
          refId: bundle.id,
          label: bundle.name,
          detail: adj.type === "percent_discount" ? `−${adj.value} % Kombinationsvorteil` : "Kombinationspreis",
          amount: -discountTotal,
          isDemo: bundle.isDemo,
        });
      }
    } else if (adj.type === "fixed_price" && bundlePrice !== null && bundleRentKnown === null) {
      // Fixed bundle price replaces unknown individual prices.
      for (const id of bundle.spaceIds) rentBySpace.set(id, 0);
      notes.push(`${bundle.name}: Paketpreis ${euro(bundlePrice)}.`);
    }
  }

  // --- extras -------------------------------------------------------------------
  let extrasTotal: number | null = 0;
  for (const req of request.extras) {
    const extra = extras.find((e) => e.id === req.extraId && e.active);
    if (!extra || req.quantity <= 0) continue;
    isDemo ||= extra.isDemo;
    let amount: number | null = null;
    let detail: string | null = null;
    if (extra.unitPrice !== null && extra.priceModel !== "on_request") {
      const qty = req.quantity;
      switch (extra.priceModel) {
        case "flat":
          amount = extra.unitPrice;
          detail = "Pauschale";
          break;
        case "per_unit":
          amount = extra.unitPrice * qty;
          detail = `${qty} × ${euro(extra.unitPrice)}`;
          break;
        case "per_hour": {
          const h = billableHours(durationMinutes, null);
          amount = Math.round(extra.unitPrice * h * qty);
          detail = `${h.toLocaleString("de-DE")} Std. × ${euro(extra.unitPrice)}${qty > 1 ? ` × ${qty}` : ""}`;
          break;
        }
        case "per_day":
          amount = extra.unitPrice * days * qty;
          detail = `${days} Tag(e) × ${euro(extra.unitPrice)}`;
          break;
        case "per_person":
          if (request.guestCount) {
            amount = extra.unitPrice * request.guestCount;
            detail = `${request.guestCount} Pers. × ${euro(extra.unitPrice)}`;
          } else {
            detail = `${euro(extra.unitPrice)} pro Person – Personenzahl fehlt`;
          }
          break;
      }
    } else {
      detail = "Preis auf Anfrage";
    }
    if (amount === null) {
      extrasTotal = null;
      missing.push(`Zusatzleistung ${extra.name}`);
    } else if (extrasTotal !== null) extrasTotal += amount;
    lines.push({ kind: "extra", refId: extra.id, label: extra.name, detail, amount, isDemo: extra.isDemo });
  }

  // --- cleaning -------------------------------------------------------------------
  let cleaningTotal: number | null = 0;
  for (const s of selected) {
    if (s.cleaningFee === null) {
      cleaningTotal = null;
      missing.push(`Reinigung ${s.name}`);
      break;
    }
    cleaningTotal += s.cleaningFee;
  }
  if (selected.length) {
    lines.push({ kind: "cleaning", refId: "cleaning", label: "Endreinigung", detail: null, amount: cleaningTotal, isDemo: false });
  }

  // --- deposit (Kaution) ------------------------------------------------------------
  let deposit: number | null = 0;
  for (const s of selected) {
    if (s.deposit === null) {
      deposit = null;
      break;
    }
    deposit = policy.depositStrategy === "max" ? Math.max(deposit, s.deposit) : deposit + s.deposit;
  }
  // an unknown deposit is shown as "folgt" but does not make the quote incomplete

  // --- totals -------------------------------------------------------------------------
  const rentAfterBundle = rentalSubtotal === null ? null : rentalSubtotal - discountTotal;
  const total =
    rentAfterBundle === null || extrasTotal === null || cleaningTotal === null ? null : rentAfterBundle + extrasTotal + cleaningTotal;

  const vatAmount = total === null ? null : Math.round((total * VAT_RATE) / 100);
  const grossTotal = total === null || vatAmount === null ? null : total + vatAmount;
  if (total !== null) notes.push(`Alle Preise zzgl. ${VAT_RATE} % MwSt.`);

  let dueNow: number | null;
  if (policy.mode === "none") dueNow = 0;
  else if (grossTotal === null) dueNow = null;
  else {
    const rentPart = policy.mode === "full" ? grossTotal : Math.round((grossTotal * (policy.downPaymentPercent ?? 100)) / 100);
    const depositPart = policy.depositCollection === "with_payment" ? deposit : 0;
    dueNow = depositPart === null ? null : rentPart + depositPart;
  }

  // --- booking mode ---------------------------------------------------------------------
  const isComplete = total !== null && selected.length > 0;
  let bookingMode: BookingMode = selected.every((s) => s.bookingMode === "instant" || s.bookingMode === "both") ? "both" : "inquiry";
  if (selected.some((s) => s.bookingMode === "instant") && bookingMode !== "inquiry" && selected.every((s) => s.bookingMode === "instant")) {
    bookingMode = "instant";
  }
  if (bundle?.bookingMode) bookingMode = bundle.bookingMode;
  if (!isComplete) {
    bookingMode = "inquiry";
    notes.push("Diese Kombination wird individuell kalkuliert – bitte unverbindlich anfragen.");
  }

  return {
    currency: "EUR",
    lines,
    rentalSubtotal,
    discountTotal,
    extrasTotal,
    cleaningTotal,
    total,
    vat: { rate: VAT_RATE, amount: vatAmount },
    grossTotal,
    deposit,
    dueNow,
    durationMinutes,
    billableUnits: { hours: billableHours(durationMinutes, null), days },
    appliedBundle: bundle ? { id: bundle.id, name: bundle.name } : null,
    bookingMode,
    isComplete,
    isDemo,
    missing,
    notes: Array.from(new Set(notes)),
  };
}

/** Helper: the local dates covered by a daily rental from `from` to `to` inclusive. */
export function datesBetween(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
