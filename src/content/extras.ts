/**
 * Additional services (Zusatzleistungen) from the operator's price sheet
 * (10/2026, confirmed by the operator on 2026-10-02). Prices are net amounts
 * in cents (plus VAT). "tableware" is
 * charged per guest, the others once per booking.
 */
export const extraSeeds = [
  { id: "kitchen-use", name: "Küchennutzung", category: "raum", priceModel: "flat", unitPrice: 30000, maxQuantity: 1, sortOrder: 10, description: "Nutzung der Profiküche – nur zusammen mit einem Caterer." },
  { id: "cold-storage", name: "Kühlhaus", category: "raum", priceModel: "flat", unitPrice: 20000, maxQuantity: 1, sortOrder: 20, description: "Nutzung des Kühlhauses für Speisen und Getränke." },
  { id: "tap-bar", name: "Zapfanlage & Theke", category: "getraenke", priceModel: "flat", unitPrice: 25000, maxQuantity: 1, sortOrder: 30, description: "Theke mit Zapfanlage für Ihre eigenen Getränke." },
  { id: "tableware", name: "Gläser, Geschirr & Besteck", category: "service", priceModel: "per_person", unitPrice: 650, maxQuantity: 1, sortOrder: 40, description: "Komplette Eindeckung pro Gast: Gläser, Geschirr und Besteck." },
] as const satisfies ReadonlyArray<{
  id: string;
  name: string;
  category: string;
  priceModel: "flat" | "per_hour" | "per_day" | "per_person" | "per_unit" | "on_request";
  unitPrice: number;
  maxQuantity: number;
  sortOrder: number;
  description: string;
}>;
