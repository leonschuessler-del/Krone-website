import { getDb } from "@/server/db/client";
import { handleServiceError, json, limitOrNull, parseJson } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { checkAvailability } from "@/server/services/availability-service";
import { availabilityCheckSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

/** POST /api/availability/check – per-space availability + common free time for a selection. */
export async function POST(req: Request) {
  const limited = limitOrNull(req, "availability", LIMITS.availability);
  if (limited) return limited;
  const parsed = await parseJson(req, availabilityCheckSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return json(await checkAvailability(await getDb(), parsed.data));
  } catch (err) {
    return handleServiceError(err);
  }
}
