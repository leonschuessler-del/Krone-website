import type { WeeklyHours } from "@/domain/availability";
import type { PaymentPolicy } from "@/domain/pricing";

/**
 * Operator settings stored in the `settings` table (editable in the admin).
 * Base defaults are PLACEHOLDERS (needsVerification) – real bookable hours and
 * payment rules are unknown and must be configured by the operator.
 */

export interface BookableHoursSetting {
  weeklyHours: WeeklyHours;
  needsVerification: boolean;
  isDemo: boolean;
}

export interface HoldSetting {
  /** Checkout hold duration for instant bookings awaiting payment. */
  checkoutHoldMinutes: number;
  /** Whether an inquiry temporarily reserves the requested spaces. */
  inquiryCreatesHold: boolean;
  inquiryHoldHours: number;
}

export type PaymentPolicySetting = PaymentPolicy & { isDemo: boolean };

const everyDay = (open: string, close: string): WeeklyHours =>
  Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, [{ open, close }]]));

export const defaultSettings = {
  bookableHours: {
    // PLACEHOLDER – real bookable hours unknown (TODO operator)
    weeklyHours: everyDay("10:00", "22:00"),
    needsVerification: true,
    isDemo: false,
  } satisfies BookableHoursSetting,
  paymentPolicy: {
    // Until prices and payment are configured: inquiries only, no payment.
    mode: "none",
    downPaymentPercent: null,
    depositCollection: "separately",
    depositStrategy: "sum",
    isDemo: false,
  } satisfies PaymentPolicySetting,
  holds: {
    checkoutHoldMinutes: 20,
    inquiryCreatesHold: false,
    inquiryHoldHours: 72,
  } satisfies HoldSetting,
};

/** DEMO / SEED ONLY */
export const demoSettings = {
  bookableHours: {
    weeklyHours: {
      1: [{ open: "09:00", close: "24:00" }],
      2: [{ open: "09:00", close: "24:00" }],
      3: [{ open: "09:00", close: "24:00" }],
      4: [{ open: "09:00", close: "24:00" }],
      5: [{ open: "09:00", close: "02:00" }],
      6: [{ open: "09:00", close: "02:00" }],
      7: [{ open: "10:00", close: "23:00" }],
    },
    needsVerification: true,
    isDemo: true,
  } satisfies BookableHoursSetting,
  paymentPolicy: {
    mode: "down_payment",
    downPaymentPercent: 30,
    depositCollection: "separately",
    depositStrategy: "sum",
    isDemo: true,
  } satisfies PaymentPolicySetting,
};

export type SettingsKey = keyof typeof defaultSettings;
