import { addDays, isoWeekday, type LocalDate } from "./time";

/**
 * Offer logic for the event rooms – designed to fill the calendar without
 * giving anything away:
 *
 *  Day pricing (flat package per room):
 *    days 1–3   package price (a weekend)
 *    days 4–7   +100 € per further day, capped: the 7th day is free
 *               (week = package + 300 €)
 *    further    every started week +300 €
 *
 *  Offers (percentages on the room rent, never on add-ons):
 *    midweek     start Mon–Thu, up to 3 days           −10 %
 *    lastminute  weekend (Fri/Sat start) within 21 days −15 %  (still free = otherwise empty)
 *  Only the better of the two applies.
 *
 *  Nudges: short texts shown next to the calendar ("one more day costs nothing").
 */

export const PACKAGE_DAYS = 3;
export const EXTRA_DAY_FEE = 10000;
export const WEEK_SURCHARGE = 30000;

/** Surcharge on top of the package for `days` rental days. */
export function extraDaysFee(days: number): number {
  if (days <= PACKAGE_DAYS) return 0;
  const weeks = Math.floor((days - 1) / 7);
  const rest = days - weeks * 7;
  const restFee = rest <= PACKAGE_DAYS ? 0 : Math.min((rest - PACKAGE_DAYS) * EXTRA_DAY_FEE, WEEK_SURCHARGE);
  return weeks * WEEK_SURCHARGE + restFee;
}

export function extraDaysDetail(days: number): string {
  const fee = extraDaysFee(days);
  if (days <= PACKAGE_DAYS) return "Pauschale (bis 3 Tage)";
  if (days === 7) return "Wochenpreis: 7. Tag geschenkt";
  return `${days - PACKAGE_DAYS} weitere Tage (${(fee / 100).toLocaleString("de-DE")} €)`;
}

export type OfferId = "midweek" | "lastminute";

export interface Offer {
  id: OfferId;
  label: string;
  percent: number;
  text: string;
}

export const OFFERS: Record<OfferId, Offer> = {
  midweek: { id: "midweek", label: "Wochentage-Vorteil", percent: 10, text: "Montag bis Donnerstag: 10 % auf die Raummiete." },
  lastminute: { id: "lastminute", label: "Spontan-Wochenende", percent: 15, text: "Ein freies Wochenende in den nächsten drei Wochen: 15 % auf die Raummiete." },
};

export const LASTMINUTE_DAYS = 21;

/** The offer that applies to a rental starting on `first` with `days` days, booked `today`. */
export function eligibleOffer(first: LocalDate, days: number, today: LocalDate): Offer | null {
  const wd = isoWeekday(first);
  const within = first >= today && first <= addDays(today, LASTMINUTE_DAYS);
  if (within && (wd === 5 || wd === 6) && days <= PACKAGE_DAYS) return OFFERS.lastminute;
  if (wd >= 1 && wd <= 4 && days <= PACKAGE_DAYS) return OFFERS.midweek;
  return null;
}

/** Short hint for the calendar: what a slightly different choice would save. */
export function dayNudge(days: number): string | null {
  if (days === 5 || days === 6) return `Tipp: Bis 7 Tage kostet es keinen Cent mehr – der ${days === 5 ? "6. und 7." : "7."} Tag ${days === 5 ? "sind" : "ist"} geschenkt.`;
  if (days === 2) return "Tipp: Der 3. Tag ist in der Pauschale schon drin.";
  return null;
}

/** Upcoming weekends (Friday dates) inside the last-minute window. */
export function upcomingWeekends(today: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = today, i = 0; i <= LASTMINUTE_DAYS; d = addDays(d, 1), i++) if (isoWeekday(d) === 5) out.push(d);
  return out;
}
