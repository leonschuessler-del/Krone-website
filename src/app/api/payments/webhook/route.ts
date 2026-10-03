import { getDb } from "@/server/db/client";
import { errorJson, json } from "@/server/http";
import { settleHotelPayment } from "@/server/services/hotel-payment-service";
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
  const event = JSON.parse(payload) as {
    type: string;
    data: { object: { mode?: string; metadata?: { paymentId?: string; hotelPaymentId?: string }; payment_status?: string; payment_intent?: string | null; setup_intent?: string | null } };
  };
  const obj = event.data.object;
  const db = await getDb();
  const completed = event.type === "checkout.session.completed";
  const failed = event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed";
  // room reservations (hotel_payments): paid stay or stored card (mode setup → payment_status "no_payment_required")
  const hotelPaymentId = obj.metadata?.hotelPaymentId;
  if (hotelPaymentId) {
    const ok = completed && (obj.payment_status === "paid" || (obj.mode === "setup" && obj.payment_status === "no_payment_required"));
    if (ok) await settleHotelPayment(db, hotelPaymentId, "succeeded", event, obj.payment_intent ?? obj.setup_intent ?? null);
    else if (failed) await settleHotelPayment(db, hotelPaymentId, "failed", event);
    return json({ received: true });
  }
  // event bookings (payments)
  const paymentId = obj.metadata?.paymentId;
  if (!paymentId) return json({ received: true });
  if (completed && obj.payment_status === "paid") {
    await settlePayment(db, paymentId, "succeeded", event);
  } else if (failed) {
    await settlePayment(db, paymentId, "failed", event);
  }
  return json({ received: true });
}
