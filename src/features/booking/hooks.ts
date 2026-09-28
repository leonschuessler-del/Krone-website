"use client";

import type { Quote } from "@/domain/pricing";
import type { AvailabilityCalendarResponse } from "@/features/availability/api-types";
import { fetchJson, useAsyncResource } from "@/lib/use-async-resource";
import type { ScheduleDraft } from "@/store/booking-store";

export type QuoteResponse = Quote & { paymentEnabled: boolean };

export function scheduleHasRange(s: ScheduleDraft): boolean {
  if (!s.date) return false;
  if (s.rentalMode === "daily") return true;
  return Boolean(s.startTime && s.endTime);
}

/** Server-side price quote for the current selection (debounced). */
export function usePriceQuote(
  spaceIds: string[],
  schedule: ScheduleDraft,
  options: { extras?: Record<string, number>; guestCount?: number | null; enabled?: boolean } = {},
) {
  const { extras = {}, guestCount = null, enabled = true } = options;
  const body = {
    spaceIds,
    rentalMode: schedule.rentalMode,
    date: schedule.date,
    endDate: schedule.rentalMode === "daily" ? (schedule.endDate ?? schedule.date) : null,
    startTime: schedule.rentalMode === "hourly" ? schedule.startTime : null,
    endTime: schedule.rentalMode === "hourly" ? schedule.endTime : null,
    guestCount: guestCount && guestCount > 0 ? guestCount : null,
    extras: Object.entries(extras).map(([extraId, quantity]) => ({ extraId, quantity })),
  };
  const key = JSON.stringify({ ...body, spaceIds: [...spaceIds].sort() });
  const active = enabled && spaceIds.length > 0 && scheduleHasRange(schedule);
  return useAsyncResource<QuoteResponse>(
    key,
    active,
    async (signal) =>
      (
        await fetchJson<{ quote: QuoteResponse }>("/api/pricing/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal,
        })
      ).quote,
    220,
  );
}

/** Month calendar data for a selection. */
export function useAvailabilityCalendar(spaceIds: string[], from: string, to: string, enabled = true) {
  const spaces = [...spaceIds].sort().join(",");
  return useAsyncResource<AvailabilityCalendarResponse>(
    `${spaces}|${from}|${to}`,
    enabled && spaceIds.length > 0,
    (signal) => fetchJson(`/api/availability?spaces=${encodeURIComponent(spaces)}&from=${from}&to=${to}`, { signal }),
    60,
  );
}
