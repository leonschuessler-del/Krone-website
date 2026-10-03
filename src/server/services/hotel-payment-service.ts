import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/format";
import type { Database } from "@/server/db/client";
import { customers, hotelPayments, hotelReservations } from "@/server/db/schema";
import { sendEmail } from "./email-service";

/**
 * Online payment of room reservations (docs/ZAHLUNG.md).
 *
 *  kind "full"      – the guest pays the stay now (Stripe Checkout, mode payment)
 *  kind "guarantee" – a card is stored (Stripe Checkout, mode setup); nothing is
 *                     charged unless the guest does not arrive or cancels late
 *
 *  provider demo    – DEMO_MODE: the outcome is simulated at once, no money moves
 *  provider stripe  – needs STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET; only the
 *                     verified webhook (`checkout.session.completed`) marks the
 *                     reservation paid / guaranteed
 *
 * The Stripe REST API is called directly (no SDK) – the same way the event
 * bookings do it in payment-service.ts.
 */

export type HotelPaymentKind = "full" | "guarantee";
export type HotelPaymentStart =
  | { provider: "none" }
  | { provider: "demo"; paymentId: string; status: "paid" | "guaranteed" }
  | { provider: "stripe"; paymentId: string; checkoutUrl: string };

export interface HotelPaymentRequest {
  reservationNumber: string;
  kind: HotelPaymentKind;
  /** cents */
  amount: number;
  customerEmail: string;
  customerName: string;
  description: string;
}

export function hotelPaymentsAvailable(): boolean {
  return env.paymentProvider !== "none";
}

export async function startHotelPayment(db: Database, req: HotelPaymentRequest): Promise<HotelPaymentStart> {
  const provider = env.paymentProvider;
  if (provider === "none") return { provider: "none" };
  if (req.kind === "full" && req.amount <= 0) return { provider: "none" };

  if (provider === "demo") {
    const [row] = await db
      .insert(hotelPayments)
      .values({ reservationNumber: req.reservationNumber, provider: "demo", kind: req.kind, amount: req.kind === "full" ? req.amount : 0, status: "succeeded", raw: { demo: true } })
      .returning();
    await db
      .update(hotelReservations)
      .set({ paymentStatus: req.kind === "full" ? "paid" : "guaranteed", updatedAt: new Date() })
      .where(eq(hotelReservations.reservationNumber, req.reservationNumber));
    return { provider: "demo", paymentId: row!.id, status: req.kind === "full" ? "paid" : "guaranteed" };
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY fehlt");
  const [row] = await db
    .insert(hotelPayments)
    .values({ reservationNumber: req.reservationNumber, provider: "stripe", kind: req.kind, amount: req.kind === "full" ? req.amount : 0, status: "pending" })
    .returning();
  const paymentId = row!.id;
  const back = `${env.siteUrl}/hotel/buchen?nr=${encodeURIComponent(req.reservationNumber)}`;
  const body = new URLSearchParams({
    success_url: `${back}&zahlung=ok#bestaetigt`,
    cancel_url: `${back}&zahlung=abgebrochen#bestaetigt`,
    client_reference_id: req.reservationNumber,
    customer_email: req.customerEmail,
    "metadata[hotelPaymentId]": paymentId,
    "metadata[reservationNumber]": req.reservationNumber,
    locale: "de",
    expires_at: String(Math.floor(Date.now() / 1000) + 31 * 60),
  });
  if (req.kind === "full") {
    body.set("mode", "payment");
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price_data][currency]", "eur");
    body.set("line_items[0][price_data][unit_amount]", String(req.amount));
    body.set("line_items[0][price_data][product_data][name]", req.description);
    body.set("payment_intent_data[description]", req.description);
    body.set("payment_intent_data[metadata][reservationNumber]", req.reservationNumber);
  } else {
    // card on file: SetupIntent – charged off-session only for a no-show / late cancellation
    body.set("mode", "setup");
    body.set("payment_method_types[0]", "card");
    body.set("setup_intent_data[description]", `Garantie ${req.description}`);
    body.set("setup_intent_data[metadata][reservationNumber]", req.reservationNumber);
  }
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as { id?: string; url?: string; error?: { message: string } };
  if (!res.ok || !data.url) {
    await db.update(hotelPayments).set({ status: "failed", raw: data, updatedAt: new Date() }).where(eq(hotelPayments.id, paymentId));
    throw new Error(data.error?.message ?? "Stripe-Checkout konnte nicht erstellt werden");
  }
  await db.update(hotelPayments).set({ providerRef: data.id, checkoutUrl: data.url, updatedAt: new Date() }).where(eq(hotelPayments.id, paymentId));
  await db.update(hotelReservations).set({ paymentStatus: "pending", updatedAt: new Date() }).where(eq(hotelReservations.reservationNumber, req.reservationNumber));
  return { provider: "stripe", paymentId, checkoutUrl: data.url };
}

/** Final outcome from the webhook (idempotent). */
export async function settleHotelPayment(db: Database, paymentId: string, outcome: "succeeded" | "failed", raw?: unknown, intentRef?: string | null): Promise<void> {
  const [payment] = await db.select().from(hotelPayments).where(eq(hotelPayments.id, paymentId));
  if (!payment || payment.status !== "pending") return;
  await db.update(hotelPayments).set({ status: outcome, raw: raw ?? null, intentRef: intentRef ?? payment.intentRef, updatedAt: new Date() }).where(eq(hotelPayments.id, paymentId));
  const paymentStatus = outcome === "failed" ? "failed" : payment.kind === "full" ? "paid" : "guaranteed";
  await db.update(hotelReservations).set({ paymentStatus, updatedAt: new Date() }).where(eq(hotelReservations.reservationNumber, payment.reservationNumber));
  if (outcome === "failed") return;

  const [res] = await db
    .select({ customer: customers })
    .from(hotelReservations)
    .leftJoin(customers, eq(hotelReservations.customerId, customers.id))
    .where(eq(hotelReservations.reservationNumber, payment.reservationNumber));
  const customer = res?.customer;
  if (!customer) return;
  const ctx = { customerName: `${customer.firstName} ${customer.lastName}`, bookingNumber: payment.reservationNumber, totalLabel: formatMoney(payment.amount) };
  await sendEmail(db, payment.kind === "full" ? "hotel_payment_received" : "hotel_card_guaranteed", customer.email, ctx);
}

export async function listHotelPayments(db: Database) {
  return db.select().from(hotelPayments);
}
