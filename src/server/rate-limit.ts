/**
 * Simple fixed-window rate limiter (in-memory, per server instance).
 * Good enough for a single-instance deployment and as a first line of
 * defence. For multi-instance production use, swap `store` for a shared
 * backend (e.g. Redis / Upstash) behind the same interface.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const globalStore = globalThis as unknown as { __kroneRateLimit?: Map<string, Bucket> };
const store = (globalStore.__kroneRateLimit ??= new Map<string, Bucket>());

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (process.env.RATE_LIMIT_DISABLED === "1") return { ok: true, remaining: limit, retryAfterSec: 0 };
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    if (store.size > 10_000) {
      for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
    }
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  bucket.count += 1;
  const ok = bucket.count <= limit;
  return { ok, remaining: Math.max(0, limit - bucket.count), retryAfterSec: ok ? 0 : Math.ceil((bucket.resetAt - now) / 1000) };
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}

/** Preset limits for sensitive endpoints. */
export const LIMITS = {
  availability: { limit: 120, windowMs: 60_000 },
  pricing: { limit: 120, windowMs: 60_000 },
  booking: { limit: 8, windowMs: 10 * 60_000 },
  contact: { limit: 5, windowMs: 10 * 60_000 },
  login: { limit: 8, windowMs: 15 * 60_000 },
  payment: { limit: 20, windowMs: 10 * 60_000 },
} as const;
