import { getDb } from "@/server/db/client";
import { errorJson, json, limitOrNull } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { hotelAvailability, hotelAvailabilityQuerySchema } from "@/server/services/hotel-service";

export const dynamic = "force-dynamic";

/** GET /api/hotel/availability?arrival=YYYY-MM-DD&departure=YYYY-MM-DD */
export async function GET(req: Request) {
  const limited = limitOrNull(req, "availability", LIMITS.availability);
  if (limited) return limited;
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = hotelAvailabilityQuerySchema.safeParse(q);
  if (!parsed.success) return errorJson(422, "VALIDATION", "Bitte An- und Abreise im Format YYYY-MM-DD angeben.");
  return json(await hotelAvailability(await getDb(), parsed.data.arrival, parsed.data.departure));
}
