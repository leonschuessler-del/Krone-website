import { TZDate } from "@date-fns/tz";

/**
 * Time handling for a venue in Germany.
 *
 * Rule: all instants are stored and compared as UTC epoch milliseconds.
 * User-facing wall-clock values (a local date "2026-10-17" and a local time
 * "18:00") are ALWAYS interpreted in Europe/Berlin – including daylight
 * saving transitions (23 h / 25 h days). Never use naive `new Date("…")`
 * parsing for booking times.
 */

export const VENUE_TIME_ZONE = "Europe/Berlin";

export type LocalDate = string; // YYYY-MM-DD
export type LocalTime = string; // HH:mm

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string") return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function isLocalTime(value: unknown): value is LocalTime {
  return typeof value === "string" && (TIME_RE.test(value) || value === "24:00");
}

export function parseLocalDate(date: LocalDate): { y: number; m: number; d: number } {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`Invalid local date: ${date}`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** Minutes since midnight. Accepts "24:00" as 1440. */
export function timeToMinutes(time: LocalTime): number {
  if (time === "24:00") return 1440;
  const m = TIME_RE.exec(time);
  if (!m) throw new Error(`Invalid local time: ${time}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export function minutesToTime(minutes: number): LocalTime {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Calendar arithmetic on local dates (independent of time zones). */
export function addDays(date: LocalDate, days: number): LocalDate {
  const { y, m, d } = parseLocalDate(date);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function diffDays(from: LocalDate, to: LocalDate): number {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

export function eachDate(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  const n = diffDays(from, to);
  for (let i = 0; i <= n; i++) out.push(addDays(from, i));
  return out;
}

/** ISO weekday: 1 = Monday … 7 = Sunday */
export function isoWeekday(date: LocalDate): number {
  const { y, m, d } = parseLocalDate(date);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function isWeekend(date: LocalDate): boolean {
  return isoWeekday(date) >= 6;
}

/**
 * Converts a Berlin wall-clock time to a UTC instant.
 * `minutes` may exceed 1440 (e.g. 1560 = 02:00 on the following day).
 * Non-existent times (spring-forward gap) resolve forward, as TZDate does.
 */
export function zonedToUtc(date: LocalDate, minutes: number): number {
  const { y, m, d } = parseLocalDate(date);
  const dayOffset = Math.floor(minutes / 1440);
  const rest = minutes - dayOffset * 1440;
  return new TZDate(y, m - 1, d + dayOffset, Math.floor(rest / 60), rest % 60, 0, VENUE_TIME_ZONE).getTime();
}

export function zonedDateTimeToUtc(date: LocalDate, time: LocalTime): number {
  return zonedToUtc(date, timeToMinutes(time));
}

/** Local midnight → next local midnight (23, 24 or 25 hours long). */
export function dayBounds(date: LocalDate): { start: number; end: number } {
  return { start: zonedToUtc(date, 0), end: zonedToUtc(addDays(date, 1), 0) };
}

export function utcToLocal(instant: number): { date: LocalDate; time: LocalTime; minutes: number; weekday: number } {
  const t = new TZDate(instant, VENUE_TIME_ZONE);
  const date = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  const minutes = t.getHours() * 60 + t.getMinutes();
  return { date, time: minutesToTime(minutes), minutes, weekday: isoWeekday(date) };
}

export function todayLocal(now: number = Date.now()): LocalDate {
  return utcToLocal(now).date;
}

/**
 * Builds a UTC interval from a local date + start/end time.
 * If end <= start the event ends on the following day (e.g. 18:00–02:00).
 */
export function localRangeToInterval(date: LocalDate, startTime: LocalTime, endTime: LocalTime): { start: number; end: number } {
  const s = timeToMinutes(startTime);
  let e = timeToMinutes(endTime);
  if (e <= s) e += 1440;
  return { start: zonedToUtc(date, s), end: zonedToUtc(date, e) };
}

export function monthRange(year: number, month1: number): { from: LocalDate; to: LocalDate } {
  const from = `${year}-${String(month1).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(year, month1, 0)).getUTCDate();
  return { from, to: `${year}-${String(month1).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
}
