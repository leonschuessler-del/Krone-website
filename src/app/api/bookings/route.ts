import { getDb } from "@/server/db/client";
import { errorJson, handleServiceError, json, limitOrNull, parseJson } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { createBooking } from "@/server/services/booking-service";
import { bookingSubmissionSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/bookings – creates a booking (kind "booking") or inquiry (kind "inquiry").
 * Everything is re-validated and re-priced on the server; availability is
 * re-checked inside a transaction (see bookingService).
 */
export async function POST(req: Request) {
  const limited = limitOrNull(req, "booking", LIMITS.booking);
  if (limited) return limited;
  const parsed = await parseJson(req, bookingSubmissionSchema);
  if (!parsed.ok) return parsed.response;
  if (parsed.data.website) return errorJson(422, "SPAM", "Anfrage abgelehnt");
  try {
    const { website: _hp, ...submission } = parsed.data;
    const result = await createBooking(await getDb(), submission);
    return json(result, { status: 201 });
  } catch (err) {
    return handleServiceError(err);
  }
}
