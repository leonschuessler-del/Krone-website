import { siteConfig } from "@/config/site";

const TZ = siteConfig.timeZone;
const LOCALE = siteConfig.locale;

/** Parses a local calendar date (YYYY-MM-DD) into a Date at 12:00 UTC – safe for date-only formatting. */
function dateOnly(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 12));
}

export function formatDateLong(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(dateOnly(date));
}

export function formatDateMedium(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(dateOnly(date));
}

export function formatDateShort(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(dateOnly(date));
}

export function formatDayMonth(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(dateOnly(date));
}

/** Formats a UTC instant (ms or Date) as local Berlin time HH:mm. */
export function formatTime(instant: number | Date): string {
  return new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", timeZone: TZ, hourCycle: "h23" }).format(instant);
}

export function formatDateTime(instant: number | Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
    hourCycle: "h23",
  }).format(instant);
}

export function formatInstantDateLong(instant: number | Date): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(instant);
}

export function formatTimeRange(start: number, end: number): string {
  return `${formatTime(start)}–${formatTime(end)} Uhr`;
}

const money = new Intl.NumberFormat(LOCALE, { style: "currency", currency: siteConfig.currency });

/** Formats integer cents. `null` → placeholder text, never "0,00 €". */
export function formatMoney(cents: number | null | undefined, placeholder = "Preis folgt"): string {
  if (cents === null || cents === undefined) return placeholder;
  return money.format(cents / 100);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Minuten`;
  if (m === 0) return h === 1 ? "1 Stunde" : `${h} Stunden`;
  return `${h} Std. ${m} Min.`;
}

export function pluralize(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function formatCapacity(seated: number | null, standing: number | null): string {
  const parts = [seated !== null ? `${seated} sitzend` : null, standing !== null ? `${standing} stehend` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Angabe folgt";
}

export function formatArea(sqm: number | null): string {
  return sqm !== null ? `${new Intl.NumberFormat(LOCALE).format(sqm)} m²` : "Angabe folgt";
}
