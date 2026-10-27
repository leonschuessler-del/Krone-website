import { siteScope } from "@/config/scope";
import { getDb } from "@/server/db/client";
import { errorJson, json, limitOrNull, parseJson } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { createHotelReservation, HotelError, hotelReservationSchema } from "@/server/services/hotel-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/hotel/reservations – a guest requests rooms (status "requested").
 * Archiviert (10/2026): Solange nur die Eventlocation online ist (siteScope.eventOnly), antwortet die
 * Route mit 404 – es entstehen weder Datensätze noch Mails. Siehe ARCHIV.md.
 */
export async function POST(req: Request) {
  if (siteScope.eventOnly) return errorJson(404, "NOT_FOUND", "Zimmer buchen Sie über unsere Hauptseite.");
  const limited = limitOrNull(req, "booking", LIMITS.booking);
  if (limited) return limited;
  const parsed = await parseJson(req, hotelReservationSchema);
  if (!parsed.ok) return parsed.response;
  if (parsed.data.website) return errorJson(422, "SPAM", "Anfrage abgelehnt");
  try {
    return json(await createHotelReservation(await getDb(), parsed.data), { status: 201 });
  } catch (err) {
    if (err instanceof HotelError) return errorJson(err.status, err.code, err.message);
    throw err;
  }
}
