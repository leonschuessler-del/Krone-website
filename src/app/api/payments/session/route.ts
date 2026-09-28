import { getDb } from "@/server/db/client";
import { handleServiceError, json, limitOrNull, parseJson } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { createPaymentSession } from "@/server/services/payment-service";
import { bookingAccessSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

/** POST /api/payments/session – creates a payment session for a pending booking (demo or Stripe). */
export async function POST(req: Request) {
  const limited = limitOrNull(req, "payment", LIMITS.payment);
  if (limited) return limited;
  const parsed = await parseJson(req, bookingAccessSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return json(await createPaymentSession(await getDb(), parsed.data.bookingNumber, parsed.data.token));
  } catch (err) {
    return handleServiceError(err);
  }
}
