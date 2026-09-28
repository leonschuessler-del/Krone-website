import { getDb } from "@/server/db/client";
import { errorJson, json } from "@/server/http";
import { settlePayment, verifyStripeSignature } from "@/server/services/payment-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/payments/webhook – Stripe webhook (prepared).
 * The signature is verified with STRIPE_WEBHOOK_SECRET before anything is
 * processed. Only verified `checkout.session.completed` events confirm a booking.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return errorJson(503, "NOT_CONFIGURED", "Webhook nicht konfiguriert");
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) {
    return errorJson(400, "INVALID_SIGNATURE", "Ungültige Signatur");
  }
  const event = JSON.parse(payload) as { type: string; data: { object: { metadata?: { paymentId?: string }; payment_status?: string } } };
  const paymentId = event.data.object.metadata?.paymentId;
  if (!paymentId) return json({ received: true });
  const db = await getDb();
  if (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid") {
    await settlePayment(db, paymentId, "succeeded", event);
  } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    await settlePayment(db, paymentId, "failed", event);
  }
  return json({ received: true });
}
