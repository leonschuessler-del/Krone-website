import { getDb } from "@/server/db/client";
import { errorJson, handleServiceError, json } from "@/server/http";
import { getPublicBooking } from "@/server/services/booking-service";
import { toPublicBooking } from "@/server/services/booking-view";
import { bookingAccessSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

/** GET /api/bookings/:number?token=… – public booking view (token required). */
export async function GET(req: Request, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const parsed = bookingAccessSchema.safeParse({ bookingNumber: number, token });
  if (!parsed.success) return errorJson(404, "NOT_FOUND", "Buchung nicht gefunden");
  try {
    const details = await getPublicBooking(await getDb(), parsed.data.bookingNumber, parsed.data.token);
    if (!details) return errorJson(404, "NOT_FOUND", "Buchung nicht gefunden");
    return json({ booking: toPublicBooking(details) });
  } catch (err) {
    return handleServiceError(err);
  }
}
