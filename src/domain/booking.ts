import type { BookingKind, BookingStatus, PaymentStatus } from "./types";

/**
 * Booking status machine. Booking status, payment status and availability
 * status are deliberately separate concepts.
 */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  draft: ["inquiry", "pending", "cancelled"],
  inquiry: ["reserved", "confirmed", "cancelled"],
  pending: ["reserved", "confirmed", "cancelled"],
  reserved: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  cancelled: [],
  completed: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return from === to || BOOKING_TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: BookingStatus,
    public readonly to: BookingStatus,
  ) {
    super(`Statuswechsel ${from} → ${to} ist nicht erlaubt`);
  }
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/**
 * A booking may only become `confirmed` via payment when the payment
 * succeeded (or no payment is required). A failed payment never confirms.
 */
export function statusAfterPayment(current: BookingStatus, payment: PaymentStatus): BookingStatus {
  if (payment === "paid" || payment === "deposit_paid") return canTransition(current, "confirmed") ? "confirmed" : current;
  if (payment === "failed") return current === "pending" ? "pending" : current;
  return current;
}

/** Which statuses hold availability (create blocks). */
export function statusBlocksAvailability(status: BookingStatus): "booked" | "reserved" | null {
  switch (status) {
    case "confirmed":
    case "completed":
      return "booked";
    case "pending":
    case "reserved":
      return "reserved";
    default:
      return null;
  }
}

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  draft: "Entwurf",
  inquiry: "Anfrage",
  pending: "Neu / ausstehend",
  reserved: "Reserviert",
  confirmed: "Bestätigt",
  cancelled: "Storniert",
  completed: "Abgeschlossen",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Unbezahlt",
  pending: "Zahlung ausstehend",
  deposit_required: "Anzahlung erforderlich",
  deposit_paid: "Anzahlung bezahlt",
  paid: "Bezahlt",
  partially_refunded: "Teilweise erstattet",
  refunded: "Erstattet",
  failed: "Fehlgeschlagen",
};

// Crockford-style alphabet without ambiguous characters (0/O, 1/I/L, U).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Human-readable reference, e.g. KR-2026-7K3QD (booking) or KA-2026-… (inquiry).
 * Random (not sequential), so it does not leak volumes. Uniqueness is
 * enforced by a DB unique constraint (with retry on collision).
 */
export function generateBookingNumber(kind: BookingKind, year: number, random: (n: number) => Uint8Array = defaultRandom): string {
  const bytes = random(5);
  let code = "";
  for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
  return `${kind === "inquiry" ? "KA" : "KR"}-${year}-${code}`;
}

function defaultRandom(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  globalThis.crypto.getRandomValues(arr);
  return arr;
}

export const BOOKING_NUMBER_RE = /^K[RA]-\d{4}-[2-9A-HJKMNP-TV-Z]{5}$/;
