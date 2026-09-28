import { createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { statusAfterPayment } from "@/domain/booking";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/format";
import type { Database } from "@/server/db/client";
import { bookings, customers, payments } from "@/server/db/schema";
import { applyBookingStatusToBlocks, BookingError, findBookingByNumber, hashToken } from "./booking-service";
import { sendEmail } from "./email-service";

/**
 * paymentService – provider abstraction.
 *
 *  demo   : simulated payment (DEMO_MODE) – success/failure buttons, no money moves
 *  stripe : Stripe Checkout (prepared). Needs STRIPE_SECRET_KEY and
 *           STRIPE_WEBHOOK_SECRET. The booking is confirmed ONLY by the
 *           verified webhook `checkout.session.completed`.
 *  none   : inquiries only
 *
 * The Kaution (security deposit) is never treated as revenue: it is a separate
 * payment kind (`security_deposit`) and – by default – collected separately.
 */

export type PaymentSession =
  | { provider: "demo"; paymentId: string; amount: number }
  | { provider: "stripe"; checkoutUrl: string }
  | { provider: "none" };

async function loadPendingPayment(db: Database, bookingNumber: string, token: string) {
  const booking = await findBookingByNumber(db, bookingNumber);
  if (!booking || booking.accessTokenHash !== hashToken(token)) throw new BookingError("NOT_FOUND", "Buchung nicht gefunden.");
  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.bookingId, booking.id), eq(payments.status, "pending")))
    .orderBy(desc(payments.createdAt));
  return { booking, payment: payment ?? null };
}

export async function createPaymentSession(db: Database, bookingNumber: string, token: string): Promise<PaymentSession> {
  const { booking, payment } = await loadPendingPayment(db, bookingNumber, token);
  if (!payment) return { provider: "none" };
  if (booking.status === "cancelled") throw new BookingError("NOT_AVAILABLE", "Die Reservierung ist abgelaufen. Bitte starten Sie die Buchung erneut.");

  if (payment.provider === "demo" || env.paymentProvider === "demo") {
    return { provider: "demo", paymentId: payment.id, amount: payment.amount };
  }

  if (env.paymentProvider === "stripe") {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY fehlt");
    const successUrl = `${env.siteUrl}/buchung/${booking.bookingNumber}?token=${encodeURIComponent(token)}&zahlung=ok`;
    const cancelUrl = `${env.siteUrl}/buchung/${booking.bookingNumber}?token=${encodeURIComponent(token)}&zahlung=abgebrochen`;
    const body = new URLSearchParams({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: booking.id,
      "metadata[paymentId]": payment.id,
      "metadata[bookingNumber]": booking.bookingNumber,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "eur",
      "line_items[0][price_data][unit_amount]": String(payment.amount),
      "line_items[0][price_data][product_data][name]": `Zur Krone – ${payment.kind === "down_payment" ? "Anzahlung" : "Miete"} ${booking.bookingNumber}`,
      expires_at: String(Math.floor(Date.now() / 1000) + 31 * 60),
    });
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { id?: string; url?: string; error?: { message: string } };
    if (!res.ok || !data.url) throw new Error(data.error?.message ?? "Stripe-Checkout konnte nicht erstellt werden");
    await db.update(payments).set({ providerRef: data.id, checkoutUrl: data.url, updatedAt: new Date() }).where(eq(payments.id, payment.id));
    return { provider: "stripe", checkoutUrl: data.url };
  }
  return { provider: "none" };
}

/** Applies a final payment outcome – shared by the demo endpoint and the Stripe webhook. */
export async function settlePayment(db: Database, paymentId: string, outcome: "succeeded" | "failed", raw?: unknown): Promise<void> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!payment || payment.status !== "pending") return; // idempotent
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, payment.bookingId));
  if (!booking) return;

  await db.update(payments).set({ status: outcome, raw: raw ?? null, updatedAt: new Date() }).where(eq(payments.id, payment.id));

  if (outcome === "failed") {
    await db.update(bookings).set({ paymentStatus: "failed", updatedAt: new Date() }).where(eq(bookings.id, booking.id));
    return; // booking stays pending; hold expires automatically
  }

  if (booking.status === "cancelled") {
    // Paid after the hold expired → must be handled manually (refund or re-book).
    await db
      .update(bookings)
      .set({ paymentStatus: payment.kind === "down_payment" ? "deposit_paid" : "paid", adminNotes: "Zahlung nach Ablauf der Reservierung eingegangen – bitte prüfen (Erstattung/Neubuchung).", updatedAt: new Date() })
      .where(eq(bookings.id, booking.id));
    return;
  }

  const paymentStatus = payment.kind === "down_payment" ? "deposit_paid" : "paid";
  const status = statusAfterPayment(booking.status, paymentStatus);
  await db.update(bookings).set({ paymentStatus, status, updatedAt: new Date() }).where(eq(bookings.id, booking.id));
  await applyBookingStatusToBlocks(db, booking.id, status);

  const [customer] = await db.select().from(customers).where(eq(customers.id, booking.customerId));
  if (customer) {
    const ctx = { customerName: `${customer.firstName} ${customer.lastName}`, bookingNumber: booking.bookingNumber, totalLabel: formatMoney(payment.amount) };
    await sendEmail(db, "payment_received", customer.email, ctx, booking.id);
    if (status === "confirmed") await sendEmail(db, "booking_confirmed", customer.email, ctx, booking.id);
  }
}

export async function confirmDemoPayment(db: Database, bookingNumber: string, token: string, outcome: "succeeded" | "failed"): Promise<void> {
  if (env.paymentProvider !== "demo") throw new BookingError("NOT_FOUND", "Demo-Zahlungen sind deaktiviert.");
  const { payment } = await loadPendingPayment(db, bookingNumber, token);
  if (!payment) throw new BookingError("NOT_FOUND", "Keine offene Zahlung gefunden.");
  await settlePayment(db, payment.id, outcome, { demo: true });
}

/**
 * Stripe webhook signature verification (t=…,v1=… scheme, HMAC-SHA256).
 * Implemented without the SDK so it can be unit-tested; tolerance 5 minutes.
 */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, toleranceSec = 300, now = Date.now()): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = Number(parts.t);
  const v1 = header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  if (!t || !v1.length) return false;
  if (Math.abs(now / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return v1.some((sig) => sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}
