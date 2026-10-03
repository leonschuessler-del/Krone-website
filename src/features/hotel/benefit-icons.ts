import { BadgeEuro, Car, CalendarCheck, type LucideIcon, UserRoundCheck } from "lucide-react";

/** One icon per direct-booking benefit (src/content/hotel.ts → directBenefits), keyed by title. */
export const BENEFIT_ICON: Record<string, LucideIcon> = {
  Bestpreis: BadgeEuro,
  "Persönliche Bestätigung": UserRoundCheck,
  "Flexibel bis 2 Tage vorher": CalendarCheck,
  "Parken inklusive": Car,
};
