import { NextResponse } from "next/server";
import type { z } from "zod";
import { ScheduleError } from "@/domain/schedule";
import { clientIp, rateLimit } from "./rate-limit";
import { BookingError } from "./services/booking-service";
import { zodErrorMessages } from "./validation";

/** Helpers shared by API route handlers. */

export function json<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

export function errorJson(status: number, code: string, message: string, details?: unknown) {
  return json({ error: { code, message, details } }, { status });
}

export async function parseJson<S extends z.ZodType>(req: Request, schema: S): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > 100_000) return { ok: false, response: errorJson(413, "PAYLOAD_TOO_LARGE", "Anfrage zu groß") };
    body = JSON.parse(text);
  } catch {
    return { ok: false, response: errorJson(400, "INVALID_JSON", "Ungültige Anfrage") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, response: errorJson(422, "VALIDATION_ERROR", "Bitte prüfen Sie Ihre Eingaben.", zodErrorMessages(parsed.error)) };
  }
  return { ok: true, data: parsed.data };
}

export function limitOrNull(req: Request, bucket: string, preset: { limit: number; windowMs: number }) {
  const res = rateLimit(`${bucket}:${clientIp(req.headers)}`, preset.limit, preset.windowMs);
  if (res.ok) return null;
  return errorJson(429, "RATE_LIMITED", "Zu viele Anfragen – bitte versuchen Sie es in Kürze erneut.", { retryAfterSec: res.retryAfterSec });
}

export function handleServiceError(err: unknown) {
  if (err instanceof BookingError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "NOT_AVAILABLE" ? 409 : 422;
    return errorJson(status, err.code, err.message, err.details);
  }
  if (err instanceof ScheduleError) return errorJson(422, "INVALID_SCHEDULE", err.message);
  console.error("[api] unexpected error", err);
  return errorJson(500, "INTERNAL_ERROR", "Es ist ein unerwarteter Fehler aufgetreten.");
}
