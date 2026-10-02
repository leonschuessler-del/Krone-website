import { z } from "zod";
import { DECLINE_REASON_IDS } from "@/domain/decline";
import { isLocalDate, isLocalTime } from "@/domain/time";

/** Server-side input validation for every API endpoint. */

const trimmed = (max: number) => z.string().trim().max(max);
const localDate = z.string().refine(isLocalDate, "Ungültiges Datum (YYYY-MM-DD)");
const localTime = z.string().refine(isLocalTime, "Ungültige Uhrzeit (HH:mm)");
const spaceIdList = z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,64}$/)).min(1).max(20);

export const scheduleSchema = z
  .object({
    rentalMode: z.enum(["hourly", "daily"]),
    date: localDate,
    endDate: localDate.nullish(),
    startTime: localTime.nullish(),
    endTime: localTime.nullish(),
  })
  .strict();

export const availabilityCheckSchema = scheduleSchema
  .extend({
    spaceIds: spaceIdList,
    alternatives: z.number().int().min(0).max(6).optional(),
  })
  .strict();

export const calendarQuerySchema = z.object({
  spaces: z.string().max(500),
  from: localDate,
  to: localDate,
});

export const pricingSchema = scheduleSchema
  .extend({
    spaceIds: spaceIdList,
    guestCount: z.number().int().min(1).max(5000).nullish(),
    extras: z.array(z.object({ extraId: z.string().max(64), quantity: z.number().int().min(0).max(100) })).max(30).optional(),
  })
  .strict();

const name = trimmed(80).min(1, "Pflichtfeld");

export const contactSchema = z.object({
  firstName: name,
  lastName: name,
  company: trimmed(120).nullish(),
  email: z.string().trim().toLowerCase().email("Bitte gültige E-Mail-Adresse angeben").max(160),
  phone: trimmed(40).regex(/^[+()0-9 /-]{5,40}$/, "Bitte gültige Telefonnummer angeben"),
  street: trimmed(120).min(1, "Pflichtfeld"),
  houseNumber: trimmed(20).min(1, "Pflichtfeld"),
  postalCode: trimmed(12).regex(/^[0-9A-Za-z -]{3,12}$/, "Bitte gültige PLZ angeben"),
  city: trimmed(80).min(1, "Pflichtfeld"),
  country: trimmed(60).min(2),
  billing: z
    .object({
      name: trimmed(120).min(1),
      street: trimmed(120).min(1),
      houseNumber: trimmed(20).min(1),
      postalCode: trimmed(12).min(3),
      city: trimmed(80).min(1),
      country: trimmed(60).min(2),
    })
    .nullish(),
});

export const bookingSubmissionSchema = z
  .object({
    kind: z.enum(["booking", "inquiry"]),
    spaceIds: spaceIdList,
    schedule: scheduleSchema,
    extras: z.array(z.object({ extraId: z.string().max(64), quantity: z.number().int().min(0).max(100) })).max(30).default([]),
    event: z.object({
      eventType: z.string().max(40).nullish().transform((v) => v || null),
      guestCount: z.number().int().min(1).max(5000).nullish().transform((v) => v ?? null),
      notes: trimmed(2000).nullish().transform((v) => v || null),
    }),
    contact: contactSchema,
    handoverAt: z.string().datetime().nullish().transform((v) => v ?? null),
    returnAt: z.string().datetime().nullish().transform((v) => v ?? null),
    acceptedTerms: z.array(z.string().max(40)).max(20),
    /** Honeypot – must stay empty (spam protection) */
    website: z.string().max(0).optional(),
  })
  .strict();

export const bookingAccessSchema = z.object({
  bookingNumber: z.string().regex(/^K[RA]-\d{4}-[2-9A-Z]{5}$/),
  token: z.string().min(20).max(100),
});

export const contactMessageSchema = z
  .object({
    name: trimmed(120).min(2, "Bitte Namen angeben"),
    email: z.string().trim().toLowerCase().email("Bitte gültige E-Mail-Adresse angeben").max(160),
    phone: trimmed(40).optional().or(z.literal("")),
    subject: trimmed(160).min(2, "Bitte Betreff angeben"),
    message: trimmed(4000).min(10, "Bitte eine Nachricht mit mindestens 10 Zeichen eingeben"),
    privacy: z.literal(true, { message: "Bitte Datenschutzhinweise bestätigen" }),
    website: z.string().max(0).optional(),
    startedAt: z.number().optional(),
  })
  .strict();

export const adminBlockSchema = z
  .object({
    spaceIds: spaceIdList,
    date: localDate,
    endDate: localDate.nullish(),
    startTime: localTime,
    endTime: localTime,
    type: z.enum(["blocked", "maintenance", "reserved", "booked"]),
    reason: trimmed(200).min(1),
  })
  .strict();

export const adminBookingPatchSchema = z
  .object({
    status: z.enum(["inquiry", "pending", "reserved", "confirmed", "cancelled", "completed"]).optional(),
    paymentStatus: z.enum(["unpaid", "pending", "deposit_required", "deposit_paid", "paid", "partially_refunded", "refunded", "failed"]).optional(),
    adminNotes: trimmed(4000).nullish(),
    markReviewed: z.boolean().optional(),
    /** when declining (status → cancelled from a request): reason for the customer's e-mail */
    declineReason: z.enum(DECLINE_REASON_IDS).optional(),
    declineNote: trimmed(2000).optional(),
  })
  .strict();

const nullableInt = (max: number) => z.number().int().min(0).max(max).nullable();

export const adminSpacePatchSchema = z
  .object({
    name: trimmed(80).min(1).optional(),
    shortDescription: trimmed(400).nullable().optional(),
    longDescription: trimmed(6000).nullable().optional(),
    areaSqm: nullableInt(100000).optional(),
    capacityStanding: nullableInt(10000).optional(),
    capacitySeated: nullableInt(10000).optional(),
    basePrice: nullableInt(100_000_000).optional(),
    priceModel: z.enum(["hourly", "daily", "flat", "on_request"]).nullable().optional(),
    deposit: nullableInt(100_000_000).optional(),
    cleaningFee: nullableInt(100_000_000).optional(),
    minimumDurationMinutes: nullableInt(10080).optional(),
    maximumDurationMinutes: nullableInt(20160).optional(),
    setupBufferMinutes: nullableInt(1440).optional(),
    cleanupBufferMinutes: nullableInt(1440).optional(),
    advanceBookingMinHours: nullableInt(8760).optional(),
    advanceBookingMaxDays: nullableInt(1825).optional(),
    bookingMode: z.enum(["inquiry", "instant", "both"]).optional(),
    availableForStandaloneRental: z.boolean().optional(),
    includedInFullVenue: z.boolean().optional(),
    bookable: z.boolean().optional(),
    active: z.boolean().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    features: z.array(trimmed(120).min(1)).max(40).optional(),
    usageOptions: z.array(trimmed(120).min(1)).max(40).optional(),
    rules: z.array(trimmed(300).min(1)).max(40).optional(),
    needsVerification: z.array(z.string().max(60)).max(40).optional(),
    polygonOverride: z
      .array(z.tuple([z.number().min(-100).max(2000), z.number().min(-100).max(2000)]))
      .min(3)
      .max(200)
      .nullable()
      .optional(),
    labelPositionOverride: z.object({ x: z.number().min(0).max(2000), y: z.number().min(0).max(2000) }).nullable().optional(),
  })
  .strict();

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(1).max(200),
});

export function zodErrorMessages(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}
