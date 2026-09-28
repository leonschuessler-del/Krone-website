import { z } from "zod";
import { getDb } from "@/server/db/client";
import { handleServiceError, json, limitOrNull, parseJson } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { confirmDemoPayment } from "@/server/services/payment-service";
import { bookingAccessSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

const schema = bookingAccessSchema.extend({ outcome: z.enum(["succeeded", "failed"]) });

/** POST /api/payments/demo/confirm – DEMO ONLY: simulates the payment provider callback. */
export async function POST(req: Request) {
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
