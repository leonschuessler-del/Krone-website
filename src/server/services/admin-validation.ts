import { z } from "zod";
import { isLocalDate, isLocalTime } from "@/domain/time";
import { adminBookingPatchSchema } from "@/server/validation";

/**
 * Additional input schemas for admin endpoints. The shared schemas in
 * `src/server/validation.ts` (adminBlockSchema, adminBookingPatchSchema,
 * adminSpacePatchSchema, loginSchema) are reused where they exist.
 */

const trimmed = (max: number) => z.string().trim().max(max);
const localDate = z.string().refine(isLocalDate, "Ungültiges Datum (YYYY-MM-DD)");
const clockTime = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Uhrzeit im Format HH:mm");
const openingTime = z.string().refine(isLocalTime, "Uhrzeit im Format HH:mm");
const weekdays = z
  .array(z.number().int().min(1).max(7))
  .max(7)
  .transform((a) => Array.from(new Set(a)).sort((x, y) => x - y));
const cents = (max = 100_000_000) => z.number().int().min(0).max(max);
const spaceId = z.string().trim().regex(/^[a-z0-9-]{1,64}$/);

/** Booking PATCH = shared schema + optional customer notification switch. */
export const adminBookingUpdateSchema = adminBookingPatchSchema.extend({
  notifyCustomer: z.boolean().optional(),
});
export type AdminBookingUpdate = z.infer<typeof adminBookingUpdateSchema>;

export const pricingRuleSchema = z
  .object({
    spaceId,
    label: trimmed(120).min(1, "Bitte Bezeichnung angeben"),
    priceModel: z.enum(["hourly", "daily", "flat"]),
    amount: cents(),
    weekdays: weekdays.nullable(),
    validFrom: localDate.nullable(),
    validTo: localDate.nullable(),
    minDurationMinutes: z.number().int().min(0).max(20160).nullable(),
    priority: z.number().int().min(-1000).max(1000),
    active: z.boolean(),
    isDemo: z.boolean().optional(),
  })
  .strict()
  .refine((r) => !r.validFrom || !r.validTo || r.validFrom <= r.validTo, { message: "„Gültig bis“ liegt vor „Gültig ab“", path: ["validTo"] });

export const bundleAdjustmentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("percent_discount"), value: z.number().min(0).max(100) }).strict(),
  z.object({ type: z.literal("amount_discount"), value: cents() }).strict(),
  z.object({ type: z.literal("fixed_price"), priceModel: z.enum(["hourly", "daily", "flat"]), value: cents() }).strict(),
]);

export const bundleRuleSchema = z
  .object({
    name: trimmed(160).min(1, "Bitte Namen angeben"),
    spaceIds: z.array(spaceId).min(2, "Mindestens zwei Bereiche").max(20),
    matchMode: z.enum(["exact", "subset"]),
    adjustment: bundleAdjustmentSchema.nullable(),
    bookingMode: z.enum(["inquiry", "instant", "both"]).nullable(),
    isFullVenue: z.boolean(),
    priority: z.number().int().min(-1000).max(1000),
    active: z.boolean(),
    isDemo: z.boolean().optional(),
  })
  .strict();

export const extraSchema = z
  .object({
    name: trimmed(160).min(1, "Bitte Namen angeben"),
    description: trimmed(1000).nullable(),
    category: trimmed(40).min(1),
    priceModel: z.enum(["flat", "per_hour", "per_day", "per_person", "per_unit", "on_request"]),
    unitPrice: cents().nullable(),
    maxQuantity: z.number().int().min(1).max(1000),
    confirmed: z.boolean(),
    active: z.boolean(),
    sortOrder: z.number().int().min(0).max(100000),
    isDemo: z.boolean().optional(),
  })
  .strict();

export const handoverSlotSchema = z
  .object({
    kind: z.enum(["handover", "return"]),
    time: clockTime,
    weekdays: weekdays.nullable(),
    label: trimmed(80).nullable(),
    active: z.boolean(),
  })
  .strict();

export const handoverSlotPatchSchema = z
  .object({
    time: clockTime.optional(),
    weekdays: weekdays.nullable().optional(),
    label: trimmed(80).nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict();

const openingWindowSchema = z.object({ open: openingTime, close: openingTime }).strict();

export const settingsPatchSchema = z
  .object({
    bookableHours: z
      .object({
        weeklyHours: z.record(z.enum(["1", "2", "3", "4", "5", "6", "7"]), z.array(openingWindowSchema).max(4)),
        needsVerification: z.boolean(),
        isDemo: z.boolean(),
      })
      .strict()
      .optional(),
    paymentPolicy: z
      .object({
        mode: z.enum(["none", "full", "down_payment"]),
        downPaymentPercent: z.number().int().min(1).max(100).nullable(),
        depositCollection: z.enum(["with_payment", "separately"]),
        depositStrategy: z.enum(["sum", "max"]),
        isDemo: z.boolean(),
      })
      .strict()
      .refine((p) => p.mode !== "down_payment" || p.downPaymentPercent !== null, {
        message: "Bitte Prozentsatz der Anzahlung angeben",
        path: ["downPaymentPercent"],
      })
      .optional(),
    holds: z
      .object({
        checkoutHoldMinutes: z.number().int().min(5).max(24 * 60),
        inquiryCreatesHold: z.boolean(),
        inquiryHoldHours: z.number().int().min(1).max(24 * 60),
      })
      .strict()
      .optional(),
  })
  .strict();

export const contactMessagePatchSchema = z.object({ handled: z.boolean() }).strict();
