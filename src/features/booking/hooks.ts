"use client";

import { useEffect, useRef, useState } from "react";
import type { Quote } from "@/domain/pricing";
import type { AvailabilityCalendarResponse } from "@/features/availability/api-types";
import type { AsyncState } from "@/features/availability/use-availability-check";
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
): AsyncState<QuoteResponse> & { retry: () => void } {
  const { extras = {}, guestCount = null, enabled = true } = options;
  const [state, setState] = useState<AsyncState<QuoteResponse>>({ state: "idle", data: null, error: null });
  const [nonce, setNonce] = useState(0);
  const last = useRef<QuoteResponse | null>(null);
  const active = enabled && spaceIds.length > 0 && scheduleHasRange(schedule);
  const key = JSON.stringify({ spaceIds: [...spaceIds].sort(), schedule, extras, guestCount });

  useEffect(() => {
    if (!active) {
      setState({ state: "idle", data: null, error: null });
      return;
    }
    const controller = new AbortController();
    setState({ state: "loading", data: last.current, error: null });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/pricing/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            spaceIds,
            rentalMode: schedule.rentalMode,
            date: schedule.date,
            endDate: schedule.rentalMode === "daily" ? (schedule.endDate ?? schedule.date) : null,
            startTime: schedule.rentalMode === "hourly" ? schedule.startTime : null,
            endTime: schedule.rentalMode === "hourly" ? schedule.endTime : null,
            guestCount: guestCount && guestCount > 0 ? guestCount : null,
            extras: Object.entries(extras).map(([extraId, quantity]) => ({ extraId, quantity })),
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { quote: QuoteResponse };
        last.current = data.quote;
        setState({ state: "ready", data: data.quote, error: null });
      } catch (e) {
        if (controller.signal.aborted) return;
        setState({ state: "error", data: last.current, error: e instanceof Error ? e.message : "unknown" });
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active, nonce]);

  return { ...state, retry: () => setNonce((n) => n + 1) };
}

/** Month calendar data for a selection. */
export function useAvailabilityCalendar(spaceIds: string[], from: string, to: string, enabled = true) {
  const [state, setState] = useState<AsyncState<AvailabilityCalendarResponse>>({ state: "idle", data: null, error: null });
  const [nonce, setNonce] = useState(0);
  const key = `${[...spaceIds].sort().join(",")}|${from}|${to}`;
  const active = enabled && spaceIds.length > 0;

  useEffect(() => {
    if (!active) {
      setState({ state: "idle", data: null, error: null });
      return;
    }
    const controller = new AbortController();
    setState((s) => ({ state: "loading", data: s.data, error: null }));
    fetch(`/api/availability?spaces=${encodeURIComponent(spaceIds.join(","))}&from=${from}&to=${to}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setState({ state: "ready", data: (await res.json()) as AvailabilityCalendarResponse, error: null });
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setState((s) => ({ state: "error", data: s.data, error: e instanceof Error ? e.message : "unknown" }));
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active, nonce]);

  return { ...state, retry: () => setNonce((n) => n + 1) };
}
