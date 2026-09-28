/**
 * Prepared additional services (Zusatzleistungen).
 * NOT CONFIRMED: none of these is claimed to be offered. In production only
 * extras with `confirmed = true` (set in the admin) are shown to customers.
 * Prices are NULL here; demo prices are added by the demo seed only.
 */
export const extraSeeds = [
  { id: "extra-cleaning", name: "Zusätzliche Reinigung", category: "service", priceModel: "flat", maxQuantity: 1, sortOrder: 10, description: "Zusätzliche Reinigungsleistung über die Endreinigung hinaus." },
  { id: "av-tech", name: "Veranstaltungstechnik (Ton & Licht)", category: "technik", priceModel: "per_day", maxQuantity: 1, sortOrder: 20, description: "Beschallung, Mikrofon und Grundbeleuchtung." },
  { id: "stage-tech", name: "Bühnentechnik", category: "technik", priceModel: "per_day", maxQuantity: 1, sortOrder: 30, description: "Bühnenlicht und -ton für Auftritte." },
  { id: "seating", name: "Bestuhlung & Eindeckung", category: "service", priceModel: "per_person", maxQuantity: 1, sortOrder: 40, description: "Aufbau von Tischen, Stühlen und Eindeckung nach Absprache." },
  { id: "kitchen-use", name: "Küchennutzung (z. B. für Caterer)", category: "raum", priceModel: "flat", maxQuantity: 1, sortOrder: 50, description: "Nutzung der Küche nach Einweisung." },
  { id: "cold-storage", name: "Kühlraumnutzung", category: "raum", priceModel: "per_day", maxQuantity: 1, sortOrder: 60, description: "Nutzung von Kühlflächen für Speisen und Getränke." },
  { id: "setup-time", name: "Zusätzliche Aufbauzeit", category: "zeit", priceModel: "per_unit", maxQuantity: 12, sortOrder: 70, description: "Pro Stunde vor Veranstaltungsbeginn." },
  { id: "teardown-time", name: "Zusätzliche Abbauzeit", category: "zeit", priceModel: "per_unit", maxQuantity: 12, sortOrder: 80, description: "Pro Stunde nach Veranstaltungsende." },
  { id: "service-staff", name: "Servicepersonal", category: "service", priceModel: "per_hour", maxQuantity: 10, sortOrder: 90, description: "Pro Servicekraft und Stunde der Veranstaltung." },
  { id: "hotel-rooms", name: "Hotelzimmer für Gäste", category: "hotel", priceModel: "on_request", maxQuantity: 1, sortOrder: 100, description: "Zimmerkontingent für Ihre Gäste – wird individuell angefragt." },
] as const satisfies ReadonlyArray<{
  id: string;
  name: string;
  category: string;
  priceModel: "flat" | "per_hour" | "per_day" | "per_person" | "per_unit" | "on_request";
  maxQuantity: number;
  sortOrder: number;
  description: string;
}>;
