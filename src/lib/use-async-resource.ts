"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";

export type AsyncState<T> =
  | { state: "idle"; data: null; error: null }
  | { state: "loading"; data: T | null; error: null }
  | { state: "ready"; data: T; error: null }
  | { state: "error"; data: T | null; error: string };

interface Entry<T> {
  key: string;
  data: T | null;
  error: string | null;
}

/**
 * Small data-fetching primitive: debounced, abortable, with retry.
 * Loading/idle states are DERIVED during render (no synchronous setState in
 * effects); the previous result stays visible while a new one loads.
 */
export function useAsyncResource<T>(
  key: string,
  active: boolean,
  fetcher: (signal: AbortSignal) => Promise<T>,
  delayMs = 180,
): AsyncState<T> & { retry: () => void } {
  const [entry, setEntry] = useState<Entry<T> | null>(null);
  const [nonce, setNonce] = useState(0);
  const requestKey = `${key}#${nonce}`;
  const run = useEffectEvent(fetcher);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      run(controller.signal)
        .then((data) => setEntry({ key: requestKey, data, error: null }))
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setEntry((prev) => ({ key: requestKey, data: prev?.data ?? null, error: err instanceof Error ? err.message : "unknown" }));
        });
    }, delayMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [requestKey, active, delayMs]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  if (!active) return { state: "idle", data: null, error: null, retry };
  if (!entry || entry.key !== requestKey) return { state: "loading", data: entry?.data ?? null, error: null, retry };
  if (entry.error !== null) return { state: "error", data: entry.data, error: entry.error, retry };
  return { state: "ready", data: entry.data as T, error: null, retry };
}

export async function fetchJson<T>(url: string, init: RequestInit & { signal: AbortSignal }): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}
