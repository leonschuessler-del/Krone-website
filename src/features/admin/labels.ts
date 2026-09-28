import type { BookingStatus, PaymentStatus } from "@/domain/types";

/** German labels and badge tones used throughout the admin. */

export type Tone = "neutral" | "gold" | "success" | "warning" | "danger" | "info" | "dark";

export const BOOKING_STATUS_TONE: Record<BookingStatus, Tone> = {
  draft: "neutral",
  inquiry: "info",
  pending: "warning",
  reserved: "gold",
  confirmed: "success",
  cancelled: "danger",
  completed: "dark",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, Tone> = {
  unpaid: "neutral",
  pending: "warning",
  deposit_required: "warning",
  deposit_paid: "gold",
  paid: "success",
  partially_refunded: "info",
  refunded: "info",
  failed: "danger",
};

export const BLOCK_TYPE_LABEL: Record<"booked" | "reserved" | "blocked" | "maintenance" | "inquiry", string> = {
  booked: "Gebucht",
  reserved: "Reserviert",
  blocked: "Gesperrt",
  maintenance: "Wartung",
  inquiry: "Anfrage",
};

export const WEEKDAYS = [
  { n: 1, short: "Mo", long: "Montag" },
  { n: 2, short: "Di", long: "Dienstag" },
  { n: 3, short: "Mi", long: "Mittwoch" },
  { n: 4, short: "Do", long: "Donnerstag" },
  { n: 5, short: "Fr", long: "Freitag" },
  { n: 6, short: "Sa", long: "Samstag" },
  { n: 7, short: "So", long: "Sonntag" },
] as const;

export function weekdaysLabel(days: number[] | null | undefined): string {
  if (!days || days.length === 0 || days.length === 7) return "alle Tage";
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.join(",") === "1,2,3,4,5") return "Mo–Fr";
  if (sorted.join(",") === "6,7") return "Sa/So";
  return sorted.map((d) => WEEKDAYS[d - 1]?.short ?? d).join(", ");
}

export const PRICE_MODEL_LABEL: Record<string, string> = {
  hourly: "pro Stunde",
  daily: "pro Tag",
  flat: "pauschal",
  on_request: "auf Anfrage",
};

export const EXTRA_PRICE_MODEL_LABEL: Record<string, string> = {
  flat: "pauschal",
  per_hour: "pro Stunde",
  per_day: "pro Tag",
  per_person: "pro Person",
  per_unit: "pro Einheit",
  on_request: "auf Anfrage",
};

export const BOOKING_MODE_LABEL: Record<string, string> = {
  inquiry: "Nur Anfrage",
  instant: "Nur Sofortbuchung",
  both: "Anfrage & Sofortbuchung",
};

export const RENTAL_MODE_LABEL: Record<string, string> = { hourly: "Stundenweise", daily: "Tageweise" };

export const EMAIL_TEMPLATE_LABEL: Record<string, string> = {
  booking_request_received: "Buchung eingegangen",
  inquiry_received: "Anfrage eingegangen",
  booking_confirmed: "Buchungsbestätigung",
  payment_received: "Zahlungseingang",
  booking_changed: "Buchung geändert",
  booking_cancelled: "Stornierung",
  handover_reminder: "Übergabe-Erinnerung",
  operator_new_request: "Betreiber: neue Anfrage/Buchung",
  contact_message: "Kontaktanfrage",
};

export const EMAIL_STATUS_LABEL: Record<string, string> = { preview: "Vorschau (nicht versendet)", sent: "Versendet", failed: "Fehlgeschlagen" };
export const EMAIL_STATUS_TONE: Record<string, Tone> = { preview: "warning", sent: "success", failed: "danger" };

export const PAYMENT_KIND_LABEL: Record<string, string> = { rent: "Miete", down_payment: "Anzahlung", security_deposit: "Kaution" };
export const PAYMENT_PROVIDER_LABEL: Record<string, string> = { demo: "Demo", stripe: "Stripe", manual: "Manuell" };
export const PAYMENT_RECORD_STATUS_LABEL: Record<string, string> = {
  pending: "offen",
  succeeded: "erfolgreich",
  failed: "fehlgeschlagen",
  cancelled: "abgebrochen",
  refunded: "erstattet",
  partially_refunded: "teilweise erstattet",
};

/** Field names used in `needsVerification` → readable German. */
export const FIELD_LABEL: Record<string, string> = {
  name: "Name",
  shortDescription: "Kurzbeschreibung",
  longDescription: "Beschreibung",
  areaSqm: "Fläche",
  capacityStanding: "Kapazität stehend",
  capacitySeated: "Kapazität sitzend",
  features: "Ausstattung",
  usageOptions: "Nutzungsmöglichkeiten",
  rules: "Regeln",
  basePrice: "Grundpreis",
  priceModel: "Preismodell",
  deposit: "Kaution",
  cleaningFee: "Reinigung",
  minimumDurationMinutes: "Mindestdauer",
  maximumDurationMinutes: "Höchstdauer",
  bookableHours: "Buchungszeiten",
  advanceBookingMinHours: "Vorlaufzeit",
  advanceBookingMaxDays: "Buchungshorizont",
  setupBufferMinutes: "Aufbaupuffer",
  cleanupBufferMinutes: "Abbaupuffer",
  polygon: "Kartenfläche",
  images: "Fotos",
};

export function fieldLabel(key: string): string {
  return FIELD_LABEL[key] ?? key;
}

export const SPACE_TYPE_LABEL: Record<string, string> = { indoor: "Innen", outdoor: "Außen", hotel: "Hotel", service: "Service" };

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "booking.status": "Status geändert",
  "booking.payment_status": "Zahlungsstatus geändert",
  "booking.notes": "Interne Notiz geändert",
  "booking.reviewed": "Als gesehen markiert",
  "booking.unreviewed": "Als neu markiert",
};
