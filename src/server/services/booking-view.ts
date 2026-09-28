import type { Quote } from "@/domain/pricing";
import { eventTypeLabel } from "@/content/event-types";
import type { getBookingDetails } from "./booking-service";

type Details = NonNullable<Awaited<ReturnType<typeof getBookingDetails>>>;

/** Shape of a booking as shown to the customer (no internal ids, no hashes). */
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
  spaces: Array<{ id: string; name: string; code: string; color: string; subtotal: number | null }>;
  quote: Quote | null;
  total: number | null;
  deposit: number | null;
  dueNow: number | null;
  customer: { name: string; company: string | null; email: string; phone: string };
  isDemo: boolean;
  createdAt: string;
}

export function toPublicBooking(d: Details): PublicBooking {
  const b = d.booking;
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
    spaces: d.items.map((i) => ({ id: i.item.spaceId, name: i.spaceName, code: i.spaceCode, color: i.spaceColor, subtotal: i.item.subtotal })),
    quote: (b.quoteSnapshot as Quote | null) ?? null,
    total: b.total,
    deposit: b.deposit,
    dueNow: b.dueNow,
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
