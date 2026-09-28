import { eq } from "drizzle-orm";
import { addDays, isoWeekday, timeToMinutes, utcToLocal, zonedToUtc } from "@/domain/time";
import { formatDateTime } from "@/lib/format";
import type { Database } from "@/server/db/client";
import { handoverSlots } from "@/server/db/schema";

export interface HandoverOption {
  value: string; // ISO instant
  label: string;
}

export interface HandoverOptions {
  handover: HandoverOption[];
  return: HandoverOption[];
  /** true when the operator has not configured slots yet → coordinated individually */
  individual: boolean;
}

/**
 * Allowed handover (Übergabe) and return (Rückgabe) times for an event.
 * Handover: on the event day or the day before, not after the event start.
 * Return: at/after the event end, on the end day or the following day.
 */
export async function getHandoverOptions(db: Database, start: number, end: number, now = Date.now()): Promise<HandoverOptions> {
  const slots = await db.select().from(handoverSlots).where(eq(handoverSlots.active, true));
  if (slots.length === 0) return { handover: [], return: [], individual: true };

  const startDate = utcToLocal(start).date;
  const endDate = utcToLocal(end).date;
  const build = (kind: "handover" | "return", dates: string[], accept: (t: number) => boolean) => {
    const out: HandoverOption[] = [];
    for (const date of dates) {
      for (const slot of slots.filter((s) => s.kind === kind)) {
        if (slot.weekdays && !slot.weekdays.includes(isoWeekday(date))) continue;
        const t = zonedToUtc(date, timeToMinutes(slot.time));
        if (accept(t)) out.push({ value: new Date(t).toISOString(), label: `${formatDateTime(t)} Uhr` });
      }
    }
    return out.sort((a, b) => a.value.localeCompare(b.value)).filter((o, i, arr) => arr.findIndex((x) => x.value === o.value) === i);
  };
  const handover = build("handover", [addDays(startDate, -1), startDate], (t) => t <= start && t >= now).slice(-8);
  const ret = build("return", [endDate, addDays(endDate, 1)], (t) => t >= end).slice(0, 8);
  return { handover, return: ret, individual: false };
}

export function isAllowedOption(options: HandoverOption[], value: string | null | undefined): boolean {
  if (!value) return false;
  const t = Date.parse(value);
  return options.some((o) => Date.parse(o.value) === t);
}
