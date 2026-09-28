"use client";

import { fetchJson, useAsyncResource, type AsyncState } from "@/lib/use-async-resource";
import type { ScheduleDraft } from "@/store/booking-store";
import type { AvailabilityCheckRequest, AvailabilityCheckResponse } from "./api-types";

export type { AsyncState };

export function scheduleIsQueryable(schedule: ScheduleDraft): boolean {
  if (!schedule.date) return false;
  if (schedule.rentalMode === "daily") return true;
  // hourly: either no times at all (day overview) or both times
  return (!schedule.startTime && !schedule.endTime) || (!!schedule.startTime && !!schedule.endTime);
}

/**
 * Client hook for POST /api/availability/check. Debounced, abortable,
 * with loading/error/retry states. Display only – the server re-checks
 * everything when a booking is submitted.
 */
export function useAvailabilityCheck(
  spaceIds: string[],
  schedule: ScheduleDraft,
  options: { alternatives?: number; enabled?: boolean } = {},
): AsyncState<AvailabilityCheckResponse> & { retry: () => void } {
  const { alternatives = 0, enabled = true } = options;
  const body: AvailabilityCheckRequest | null = schedule.date
    ? {
        spaceIds,
        rentalMode: schedule.rentalMode,
        date: schedule.date,
        endDate: schedule.rentalMode === "daily" ? (schedule.endDate ?? schedule.date) : null,
        startTime: schedule.rentalMode === "hourly" ? schedule.startTime : null,
        endTime: schedule.rentalMode === "hourly" ? schedule.endTime : null,
        alternatives,
      }
    : null;
  const key = JSON.stringify({ ...body, spaceIds: [...spaceIds].sort() });
  const active = enabled && spaceIds.length > 0 && scheduleIsQueryable(schedule);

  return useAsyncResource<AvailabilityCheckResponse>(key, active, (signal) =>
    fetchJson("/api/availability/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    }),
  );
}
