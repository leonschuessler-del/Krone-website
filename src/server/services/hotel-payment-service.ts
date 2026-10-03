import { and, desc, eq } from "drizzle-orm";
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

/* ----------------------------------------------------------------------------
 * Admin actions: refund a paid stay, charge the stored card (no-show / late cancellation)
 * ------------------------------------------------------------------------- */

async function stripe<T>(path: string, body: URLSearchParams | null, method: "GET" | "POST" = "POST"): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY fehlt");
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: body ?? undefined,
  });
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message ?? `Stripe HTTP ${res.status}`);
  return data;
}

async function lastSucceeded(db: Database, reservationNumber: string, kind: "full" | "guarantee") {
  const [row] = await db
    .select()
    .from(hotelPayments)
    .where(and(eq(hotelPayments.reservationNumber, reservationNumber), eq(hotelPayments.kind, kind), eq(hotelPayments.status, "succeeded")))
    .orderBy(desc(hotelPayments.createdAt));
  return row ?? null;
}

export class HotelPaymentError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Refund an online-paid stay (fully by default, or a partial amount in cents). */
export async function refundHotelPayment(db: Database, reservationNumber: string, amount?: number): Promise<{ refunded: number }> {
  const payment = await lastSucceeded(db, reservationNumber, "full");
  if (!payment) throw new HotelPaymentError(404, "Keine bezahlte Online-Zahlung zu dieser Reservierung.");
  const sum = amount && amount > 0 ? Math.min(amount, payment.amount) : payment.amount;
  let raw: unknown = { demo: true };
  if (payment.provider === "stripe") {
    if (!payment.intentRef) throw new HotelPaymentError(409, "Zu dieser Zahlung ist kein Stripe-Zahlungsvorgang gespeichert.");
    raw = await stripe("/refunds", new URLSearchParams({ payment_intent: payment.intentRef, amount: String(sum), "metadata[reservationNumber]": reservationNumber }));
  }
  await db.update(hotelPayments).set({ status: "refunded", raw, updatedAt: new Date() }).where(eq(hotelPayments.id, payment.id));
  await db.update(hotelReservations).set({ paymentStatus: "refunded", updatedAt: new Date() }).where(eq(hotelReservations.reservationNumber, reservationNumber));
  return { refunded: sum };
}

/** Charge the card stored as guarantee – no-show or cancellation inside the last two days. */
export async function chargeGuarantee(db: Database, reservationNumber: string, amount: number, reason: string): Promise<{ charged: number; paymentId: string }> {
  if (!(amount > 0)) throw new HotelPaymentError(422, "Bitte einen Betrag über 0 € angeben.");
  const guarantee = await lastSucceeded(db, reservationNumber, "guarantee");
  if (!guarantee) throw new HotelPaymentError(404, "Zu dieser Reservierung ist keine Karte hinterlegt.");
  const [row] = await db
    .insert(hotelPayments)
    .values({ reservationNumber, provider: guarantee.provider, kind: "fee", amount, status: "pending" })
    .returning();
  const paymentId = row!.id;
  try {
    let raw: unknown = { demo: true, reason };
    let intentRef: string | null = null;
    if (guarantee.provider === "stripe") {
      if (!guarantee.intentRef) throw new HotelPaymentError(409, "Zur Kartenhinterlegung ist kein Stripe-SetupIntent gespeichert.");
      const setup = await stripe<{ customer?: string | null; payment_method?: string | null }>(`/setup_intents/${encodeURIComponent(guarantee.intentRef)}`, null, "GET");
      if (!setup.customer || !setup.payment_method) throw new HotelPaymentError(409, "Die hinterlegte Karte ist bei Stripe nicht mehr verfügbar.");
      const intent = await stripe<{ id: string; status: string }>(
        "/payment_intents",
        new URLSearchParams({
          amount: String(amount),
          currency: "eur",
          customer: setup.customer,
          payment_method: setup.payment_method,
          off_session: "true",
          confirm: "true",
          description: `Zur Krone – ${reason} ${reservationNumber}`,
          "metadata[reservationNumber]": reservationNumber,
          "metadata[hotelPaymentId]": paymentId,
        }),
      );
      if (intent.status !== "succeeded") throw new HotelPaymentError(402, `Die Belastung wurde nicht bestätigt (Status ${intent.status}).`);
      intentRef = intent.id;
      raw = intent;
    }
    await db.update(hotelPayments).set({ status: "succeeded", intentRef, raw, updatedAt: new Date() }).where(eq(hotelPayments.id, paymentId));
    await db.update(hotelReservations).set({ paymentStatus: "paid", updatedAt: new Date() }).where(eq(hotelReservations.reservationNumber, reservationNumber));
    return { charged: amount, paymentId };
  } catch (err) {
    await db.update(hotelPayments).set({ status: "failed", raw: { error: err instanceof Error ? err.message : String(err) }, updatedAt: new Date() }).where(eq(hotelPayments.id, paymentId));
    throw err;
  }
}
