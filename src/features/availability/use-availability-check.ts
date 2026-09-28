"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScheduleDraft } from "@/store/booking-store";
import type { AvailabilityCheckRequest, AvailabilityCheckResponse } from "./api-types";

export type AsyncState<T> =
  | { state: "idle"; data: null; error: null }
  | { state: "loading"; data: T | null; error: null }
  | { state: "ready"; data: T; error: null }
  | { state: "error"; data: T | null; error: string };

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
  const [result, setResult] = useState<AsyncState<AvailabilityCheckResponse>>({ state: "idle", data: null, error: null });
  const [nonce, setNonce] = useState(0);
  const lastData = useRef<AvailabilityCheckResponse | null>(null);

  const key = JSON.stringify({ spaceIds: [...spaceIds].sort(), schedule, alternatives });
  const active = enabled && spaceIds.length > 0 && scheduleIsQueryable(schedule);

  useEffect(() => {
    if (!active) {
      setResult({ state: "idle", data: null, error: null });
      return;
    }
    const controller = new AbortController();
    setResult({ state: "loading", data: lastData.current, error: null });
    const body: AvailabilityCheckRequest = {
      spaceIds,
      rentalMode: schedule.rentalMode,
      date: schedule.date!,
      endDate: schedule.rentalMode === "daily" ? (schedule.endDate ?? schedule.date) : null,
      startTime: schedule.rentalMode === "hourly" ? schedule.startTime : null,
      endTime: schedule.rentalMode === "hourly" ? schedule.endTime : null,
      alternatives,
    };
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/availability/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as AvailabilityCheckResponse;
        lastData.current = data;
        setResult({ state: "ready", data, error: null });
      } catch (err) {
        if (controller.signal.aborted) return;
        setResult({
          state: "error",
          data: lastData.current,
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { ...result, retry };
}
