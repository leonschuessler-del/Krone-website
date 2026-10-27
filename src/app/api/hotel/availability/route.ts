import { siteScope } from "@/config/scope";
import { getDb } from "@/server/db/client";
import { errorJson, json, limitOrNull } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { hotelAvailability, hotelAvailabilityQuerySchema } from "@/server/services/hotel-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/hotel/availability?arrival=YYYY-MM-DD&departure=YYYY-MM-DD
 * Archiviert (10/2026): Die Antwort enthält Zimmerpreise. Solange nur die Eventlocation online ist
 * (siteScope.eventOnly) oder keine Preise gezeigt werden (!siteScope.showPrices), antwortet die Route
 * mit 404 – siehe ARCHIV.md.
 */
export async function GET(req: Request) {
  if (siteScope.eventOnly || !siteScope.showPrices) return errorJson(404, "NOT_FOUND", "Zimmer buchen Sie über unsere Hauptseite.");
  const limited = limitOrNull(req, "availability", LIMITS.availability);
  if (limited) return limited;
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = hotelAvailabilityQuerySchema.safeParse(q);
  if (!parsed.success) return errorJson(422, "VALIDATION", "Bitte An- und Abreise im Format YYYY-MM-DD angeben.");
  return json(await hotelAvailability(await getDb(), parsed.data.arrival, parsed.data.departure));
}
