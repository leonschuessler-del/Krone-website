import { PRICE_ON_REQUEST, siteScope } from "@/config/scope";
import type { Space } from "@/domain/types";
import { formatMoney } from "@/lib/format";

const UNIT: Record<string, string> = { hourly: " / Std.", daily: " / Tag", flat: " pauschal" };

/**
 * "ab 120,00 € / Std." or "Preis folgt" – never 0 €.
 * While the site shows no prices (siteScope.showPrices === false) always "Preis auf Anfrage".
 */
export function formatPriceFrom(space: Pick<Space, "basePrice" | "priceModel" | "bookable">): string {
  if (!siteScope.showPrices) return PRICE_ON_REQUEST;
  if (!space.bookable) return "auf Anfrage";
  if (space.basePrice === null || !space.priceModel || space.priceModel === "on_request") return space.priceModel === "on_request" ? "auf Anfrage" : "Preis folgt";
  return `ab ${formatMoney(space.basePrice)}${UNIT[space.priceModel] ?? ""}`;
}
