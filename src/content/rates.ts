/**
 * Rate plans and payment options of the room booking (operator, 10/2026).
 * One honest rate: every room includes breakfast and is free to cancel until
 * two days before arrival (src/content/hotel.ts → hotelFacts.cancellation).
 * Further plans (e.g. a package with dinner) only need another entry here –
 * the booking engine renders one row per plan.
 */
export type RateBulletIcon = "check" | "breakfast" | "wallet" | "shield";

export interface RatePlan {
  id: string;
  name: string;
  /** shown under the rate name, one line each */
  bullets: Array<{ icon: RateBulletIcon; text: string }>;
  /** small print next to the price */
  priceNote: string;
}

export const ratePlans: RatePlan[] = [
  {
    id: "flex",
    name: "Flexible Rate · Frühstück inklusive",
    bullets: [
      { icon: "check", text: "Kostenlose Stornierung bis 2 Tage vor Anreise" },
      { icon: "breakfast", text: "Frühstück inbegriffen" },
      { icon: "wallet", text: "Keine Vorauszahlung – Zahlung im Hotel oder online" },
    ],
    priceNote: "pro Zimmer und Nacht, inkl. MwSt.",
  },
];

export const defaultRateId = ratePlans[0]!.id;
export const ratePlanById = (id: string): RatePlan | undefined => ratePlans.find((r) => r.id === id);

/**
 * How a guest may pay. "hotel" always works; "online" and "guarantee" need
 * a payment provider (PAYMENT_PROVIDER=stripe, docs/ZAHLUNG.md).
 */
export type PaymentChoice = "hotel" | "online" | "guarantee";

export const paymentChoices: Array<{ id: PaymentChoice; title: string; text: string; needsProvider: boolean }> = [
  { id: "hotel", title: "Im Hotel bezahlen", text: "Bar, EC, Mastercard, Visa oder Maestro bei der Abreise. Keine Vorauszahlung.", needsProvider: false },
  { id: "online", title: "Jetzt online bezahlen", text: "Sicher per Karte, Apple Pay, Google Pay oder SEPA – Sie erhalten sofort die Zahlungsbestätigung.", needsProvider: true },
  { id: "guarantee", title: "Karte zur Absicherung hinterlegen", text: "Keine Abbuchung jetzt. Die Karte sichert die Reservierung; belastet wird nur bei Nichtanreise oder verspäteter Stornierung.", needsProvider: true },
];
