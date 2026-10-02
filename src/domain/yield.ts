import { eligibleOffer, LASTMINUTE_DAYS, OFFERS, type Offer } from "./offers";
import { addDays, diffDays, isoWeekday, type LocalDate } from "./time";

/**
 * Yield logic for the event rooms – "the calendar makes the offers".
 *
 * Input: today and the dates that are already taken (requested or booked).
 * Output: concrete, time-limited offers for dates that would otherwise stay
 * empty. Rules (so nothing is given away):
 *  - only dates inside the next LASTMINUTE_DAYS days (short horizon = low
 *    chance of a full-price request)
 *  - never for a date that already has a request or booking
 *  - percentages are the fixed ones from domain/offers.ts (10 % midweek,
 *    15 % last-minute weekend); the engine never invents deeper discounts
 *  - a long empty stretch (>= 7 free days in a row) becomes a week offer:
 *    the package week (7 days for the price of 6) instead of a percentage
 *  - a month without any booking becomes a long-term rental hint, not a discount
 */
export interface YieldOffer {
  id: string;
  kind: "weekend" | "midweek" | "week" | "longterm";
  title: string;
  text: string;
  /** rental start date (Friday for weekends) */
  date: LocalDate;
  /** last day of the offered rental */
  until: LocalDate;
  percent: number;
  offer: Offer | null;
  /** how many days until the offer disappears */
  expiresInDays: number;
}

export interface YieldInput {
  today: LocalDate;
  /** every local date with at least one request/booking/block on the event rooms */
  takenDates: ReadonlySet<LocalDate>;
}

export function yieldOffers({ today, takenDates }: YieldInput): YieldOffer[] {
  const out: YieldOffer[] = [];
  const free = (d: LocalDate) => !takenDates.has(d);
  const horizon = addDays(today, LASTMINUTE_DAYS);

  // 1) free weekends in the horizon → last-minute weekend offer
  for (let d = today; d <= horizon; d = addDays(d, 1)) {
    if (isoWeekday(d) !== 5) continue;
    const sat = addDays(d, 1);
    const sun = addDays(d, 2);
    if (!(free(d) && free(sat) && free(sun))) continue;
    const offer = eligibleOffer(d, 3, today);
    if (!offer) continue;
    out.push({
      id: `weekend-${d}`,
      kind: "weekend",
      title: "Spontan-Wochenende",
      text: `Das Wochenende ${fmt(d)}–${fmt(sun)} ist noch frei: ${offer.percent} % auf die Raummiete, solange es frei bleibt.`,
      date: d,
      until: sun,
      percent: offer.percent,
      offer,
      expiresInDays: diffDays(today, d),
    });
  }

  // 2) a free Mon–Thu block in the next 2 weeks → midweek offer (one entry per week)
  for (let d = today; d <= addDays(today, 14); d = addDays(d, 1)) {
    if (isoWeekday(d) !== 1) continue;
    const days = [0, 1, 2, 3].map((i) => addDays(d, i));
    if (!days.every(free)) continue;
    out.push({
      id: `midweek-${d}`,
      kind: "midweek",
      title: "Wochentage-Vorteil",
      text: `Montag bis Donnerstag (${fmt(d)}–${fmt(days[3]!)}) sind frei: ${OFFERS.midweek.percent} % auf die Raummiete für Firmenfeiern, Tagungen oder Trauerkaffee.`,
      date: d,
      until: days[3]!,
      percent: OFFERS.midweek.percent,
      offer: OFFERS.midweek,
      expiresInDays: diffDays(today, d),
    });
  }

  // 3) seven free days in a row inside the horizon → the week package (7 for 6), no extra percent
  for (let d = today; d <= horizon; d = addDays(d, 1)) {
    const week = Array.from({ length: 7 }, (_, i) => addDays(d, i));
    if (!week.every(free)) continue;
    out.push({
      id: `week-${d}`,
      kind: "week",
      title: "Eine ganze Woche",
      text: `Vom ${fmt(d)} bis ${fmt(week[6]!)} ist das Haus frei: sieben Tage zum Preis von sechs – Aufbau, Feier und Abbau ohne Zeitdruck.`,
      date: d,
      until: week[6]!,
      percent: 0,
      offer: null,
      expiresInDays: diffDays(today, d),
    });
    break; // one week offer is enough
  }

  // 4) nothing booked for 30 days → long-term hint
  let streak = 0;
  for (let d = today; d <= addDays(today, 30); d = addDays(d, 1)) streak += free(d) ? 1 : 0;
  if (streak >= 30) {
    out.push({
      id: "longterm",
      kind: "longterm",
      title: "Dauerhaft mieten",
      text: "Die nächsten Wochen sind frei – wer regelmäßig Platz braucht, mietet monatlich. Küche, Nebenzimmer oder das ganze Erdgeschoss.",
      date: today,
      until: addDays(today, 30),
      percent: 0,
      offer: null,
      expiresInDays: 30,
    });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Dates (local) covered by half-open UTC intervals – helper for the services. */
export function datesOfIntervals(intervals: ReadonlyArray<{ start: number; end: number }>, toLocal: (ms: number) => LocalDate): Set<LocalDate> {
  const out = new Set<LocalDate>();
  for (const i of intervals) {
    const from = toLocal(i.start);
    const to = toLocal(i.end - 1);
    for (let d = from; d <= to; d = addDays(d, 1)) out.add(d);
  }
  return out;
}

const fmt = (d: LocalDate) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
