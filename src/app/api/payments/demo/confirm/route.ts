import { z } from "zod";
import { siteScope } from "@/config/scope";
import { getDb } from "@/server/db/client";
import { errorJson, handleServiceError, json, limitOrNull, parseJson } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { confirmDemoPayment } from "@/server/services/payment-service";
import { bookingAccessSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

const schema = bookingAccessSchema.extend({ outcome: z.enum(["succeeded", "failed"]) });

/** POST /api/payments/demo/confirm – DEMO ONLY: simulates the payment provider callback. */
export async function POST(req: Request) {
  // request-only site: no online payment at all (the Stripe webhook stays for existing cases)
  if (siteScope.requestOnly) return errorJson(404, "NOT_FOUND", "Online-Zahlung ist nicht verfügbar – Anfragen sind unverbindlich.");
  const limited = limitOrNull(req, "payment", LIMITS.payment);
  if (limited) return limited;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  try {
    await confirmDemoPayment(await getDb(), parsed.data.bookingNumber, parsed.data.token, parsed.data.outcome);
    return json({ ok: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
