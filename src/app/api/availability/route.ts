import { getDb } from "@/server/db/client";
import { errorJson, handleServiceError, json, limitOrNull } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { clampCalendarRange, getAvailabilityCalendar } from "@/server/services/availability-service";
import { calendarQuerySchema, zodErrorMessages } from "@/server/validation";

export const dynamic = "force-dynamic";

/**
 * GET /api/availability?spaces=restaurant,stage&from=2026-10-01&to=2026-10-31
 * Calendar data: status per day for the selection (intersection) and per space.
 */
export async function GET(req: Request) {
  const limited = limitOrNull(req, "availability", LIMITS.availability);
  if (limited) return limited;
  const url = new URL(req.url);
  const parsed = calendarQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return errorJson(422, "VALIDATION_ERROR", "Ungültige Parameter", zodErrorMessages(parsed.error));
  const spaceIds = parsed.data.spaces
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]{1,64}$/.test(s))
    .slice(0, 20);
  if (parsed.data.to < parsed.data.from) return errorJson(422, "VALIDATION_ERROR", "Zeitraum ungültig");
  try {
    const range = clampCalendarRange(parsed.data.from, parsed.data.to);
    return json(await getAvailabilityCalendar(await getDb(), { spaceIds, ...range }));
  } catch (err) {
    return handleServiceError(err);
  }
}
