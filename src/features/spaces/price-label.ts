import type { Space } from "@/domain/types";
import { formatMoney } from "@/lib/format";

const UNIT: Record<string, string> = { hourly: " / Std.", daily: " / Tag", flat: " pauschal" };

/** "ab 120,00 € / Std." or "Preis folgt" – never 0 €. */
export function formatPriceFrom(space: Pick<Space, "basePrice" | "priceModel" | "bookable">): string {
  if (!space.bookable) return "auf Anfrage";
  if (space.basePrice === null || !space.priceModel || space.priceModel === "on_request") return space.priceModel === "on_request" ? "auf Anfrage" : "Preis folgt";
  return `ab ${formatMoney(space.basePrice)}${UNIT[space.priceModel] ?? ""}`;
}
