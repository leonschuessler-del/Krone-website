import { getDb } from "@/server/db/client";
import { errorJson, handleServiceError, json, limitOrNull } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { getHandoverOptions } from "@/server/services/handover-service";

export const dynamic = "force-dynamic";

/** GET /api/handover?start=ISO&end=ISO – allowed handover / return times */
export async function GET(req: Request) {
  const limited = limitOrNull(req, "availability", LIMITS.availability);
  if (limited) return limited;
  const url = new URL(req.url);
  const start = Date.parse(url.searchParams.get("start") ?? "");
  const end = Date.parse(url.searchParams.get("end") ?? "");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return errorJson(422, "VALIDATION_ERROR", "Ungültiger Zeitraum");
  try {
    return json(await getHandoverOptions(await getDb(), start, end));
  } catch (err) {
    return handleServiceError(err);
  }
}
