import type { WeeklyHours } from "./availability";
import { addDays, diffDays, isLocalDate, isLocalTime, isoWeekday, localRangeToInterval, timeToMinutes, zonedToUtc, type LocalDate, type LocalTime } from "./time";
import type { RentalMode } from "./types";

/** What the customer picked: a local date (+ times) or a day range. */
export interface ScheduleInput {
  rentalMode: RentalMode;
  date: LocalDate;
  endDate?: LocalDate | null;
  startTime?: LocalTime | null;
  endTime?: LocalTime | null;
}

export type ResolvedSchedule =
  | { kind: "range"; start: number; end: number; dates: LocalDate[]; rentalMode: RentalMode }
  | { kind: "day"; dates: LocalDate[]; rentalMode: RentalMode };

export class ScheduleError extends Error {}

export const MAX_RENTAL_DAYS = 14;

/**
 * Resolves the customer's schedule into a UTC range.
 *  - hourly with start + end time → exact range (end <= start ⇒ next day)
 *  - hourly without times → "day overview" (no range yet)
 *  - daily → from the first opening on `date` to the last closing on `endDate`
 */
export function resolveSchedule(input: ScheduleInput, venueHours: WeeklyHours): ResolvedSchedule {
  if (!isLocalDate(input.date)) throw new ScheduleError("Ungültiges Datum");
  if (input.rentalMode === "hourly") {
    if (!input.startTime && !input.endTime) return { kind: "day", dates: [input.date], rentalMode: "hourly" };
    if (!isLocalTime(input.startTime) || !isLocalTime(input.endTime)) throw new ScheduleError("Bitte Start- und Endzeit wählen");
    const { start, end } = localRangeToInterval(input.date, input.startTime, input.endTime);
    if (end - start > 24 * 3_600_000) throw new ScheduleError("Stundenbuchungen dauern höchstens 24 Stunden – bitte Tagesbuchung wählen");
    return { kind: "range", start, end, dates: [input.date], rentalMode: "hourly" };
  }
  const endDate = input.endDate && isLocalDate(input.endDate) ? input.endDate : input.date;
  const days = diffDays(input.date, endDate);
  if (days < 0) throw new ScheduleError("Das Enddatum liegt vor dem Startdatum");
  if (days + 1 > MAX_RENTAL_DAYS) throw new ScheduleError(`Tagesbuchungen sind online bis ${MAX_RENTAL_DAYS} Tage möglich – bitte anfragen`);
  const firstWindows = venueHours[isoWeekday(input.date)] ?? [];
  const lastWindows = venueHours[isoWeekday(endDate)] ?? [];
  if (!firstWindows.length || !lastWindows.length) throw new ScheduleError("An diesem Tag ist keine Buchung möglich");
  const open = Math.min(...firstWindows.map((w) => timeToMinutes(w.open)));
  const closes = lastWindows.map((w) => {
    const o = timeToMinutes(w.open);
    const c = timeToMinutes(w.close);
    return c <= o ? c + 1440 : c;
  });
  const start = zonedToUtc(input.date, open);
  const end = zonedToUtc(endDate, Math.max(...closes));
  const dates: LocalDate[] = [];
  for (let i = 0; i <= days; i++) dates.push(addDays(input.date, i));
  return { kind: "range", start, end, dates, rentalMode: "daily" };
}
