import { siteScope } from "@/config/scope";
import type { Quote } from "@/domain/pricing";
import { eventTypeLabel } from "@/content/event-types";
import type { getBookingDetails } from "./booking-service";

type Details = NonNullable<Awaited<ReturnType<typeof getBookingDetails>>>;

/**
 * Shape of a booking as shown to the customer (no internal ids, no hashes).
 * While siteScope.showPrices === false the price fields (quote, total,
 * deposit, dueNow, per-space subtotal) are left out entirely – the view goes
 * to the confirmation page and to GET /api/bookings/:number.
 */
export interface PublicBooking {
  bookingNumber: string;
  kind: "booking" | "inquiry";
  status: string;
  paymentStatus: string;
  rentalMode: "hourly" | "daily";
  start: string;
  end: string;
  eventType: string;
  guestCount: number | null;
  notes: string | null;
  handoverAt: string | null;
  returnAt: string | null;
  spaces: Array<{ id: string; name: string; code: string; color: string; subtotal?: number | null }>;
  /** chosen add-ons (names only) */
  extras: Array<{ id: string; name: string; quantity: number }>;
  quote?: Quote | null;
  total?: number | null;
  deposit?: number | null;
  dueNow?: number | null;
  customer: { name: string; company: string | null; email: string; phone: string };
  isDemo: boolean;
  createdAt: string;
}

/** Add-on name from the stored quote (the line label), falling back to the id. */
function extraName(quote: Quote | null, extraId: string): string {
  return quote?.lines.find((l) => l.kind === "extra" && l.refId === extraId)?.label ?? extraId;
}

export function toPublicBooking(d: Details): PublicBooking {
  const b = d.booking;
  const quote = (b.quoteSnapshot as Quote | null) ?? null;
  return {
    bookingNumber: b.bookingNumber,
    kind: b.kind,
    status: b.status,
    paymentStatus: b.paymentStatus,
    rentalMode: b.rentalMode,
    start: b.startAt.toISOString(),
    end: b.endAt.toISOString(),
    eventType: eventTypeLabel(b.eventType),
    guestCount: b.guestCount,
    notes: b.notes,
    handoverAt: b.handoverAt?.toISOString() ?? null,
    returnAt: b.returnAt?.toISOString() ?? null,
    spaces: d.items.map((i) => ({
      id: i.item.spaceId,
      name: i.spaceName,
      code: i.spaceCode,
      color: i.spaceColor,
      ...(siteScope.showPrices ? { subtotal: i.item.subtotal } : {}),
    })),
    extras: d.extras.map((e) => ({ id: e.extraId, name: extraName(quote, e.extraId), quantity: e.quantity })),
    ...(siteScope.showPrices ? { quote, total: b.total, deposit: b.deposit, dueNow: b.dueNow } : {}),
    customer: {
      name: `${d.customer.firstName} ${d.customer.lastName}`,
      company: d.customer.company,
      email: d.customer.email,
      phone: d.customer.phone,
    },
    isDemo: b.isDemo,
    createdAt: b.createdAt.toISOString(),
  };
}
