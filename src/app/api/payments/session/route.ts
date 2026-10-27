import { siteScope } from "@/config/scope";
import { getDb } from "@/server/db/client";
import { errorJson, handleServiceError, json, limitOrNull, parseJson } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { createPaymentSession } from "@/server/services/payment-service";
import { bookingAccessSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

/** POST /api/payments/session – creates a payment session for a pending booking (demo or Stripe). */
export async function POST(req: Request) {
  // request-only site: no online payment at all (the Stripe webhook stays for existing cases)
  if (siteScope.requestOnly) return errorJson(404, "NOT_FOUND", "Online-Zahlung ist nicht verfügbar – Anfragen sind unverbindlich.");
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
