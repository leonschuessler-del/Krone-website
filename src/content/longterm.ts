/**
 * Long-term rental models for the former restaurant – PROPOSALS by the
 * website team (10/2026), to be confirmed by the operator. Anchors: asking
 * rents for restaurant space in the Landkreis Miltenberg/Aschaffenburg (about
 * 6–12 €/m² cold rent in villages, up to 17 €/m² in town centres), club-house
 * rents (about 300–800 €/month) and commercial kitchens for hire (rural
 * 150–250 €/day, 800–1.500 €/month exclusive). All prices net, plus VAT,
 * ancillary costs as stated.
 */
export interface RentalModel {
  id: string;
  name: string;
  eyebrow: string;
  /** monthly price in cents, null = individual offer */
  monthly: number | null;
  /** price with a 12-month commitment, cents */
  yearly?: number | null;
  unit: string;
  includes: string[];
  idealFor: string;
  note?: string;
  proposal: true;
}

export const rentalModels: RentalModel[] = [
  {
    id: "kitchen-monthly",
    name: "Gewerbeküche im Monat",
    eyebrow: "Küche",
    monthly: 90000,
    yearly: 79000,
    unit: "pro Monat zzgl. NK",
    includes: ["Profiküche mit Herdblock, Kombidämpfer und Spülküche", "Kühlhaus", "Lieferanteneingang und Parkplatz", "Nutzung Mo–So, feste Zeiten nach Absprache"],
    idealFor: "Caterer, Food-Start-ups, Manufakturen, Lieferküchen",
    note: "Stundenweise ab 35 € / Tag 220 € möglich.",
    proposal: true,
  },
  {
    id: "hall-club",
    name: "Stammlokal für Vereine",
    eyebrow: "Nebenzimmer + Restaurant",
    monthly: 65000,
    yearly: 59000,
    unit: "pro Monat zzgl. NK",
    includes: ["Fester Abend pro Woche im Nebenzimmer oder Restaurant", "Theke mit Zapfanlage", "Lagerschrank für Vereinsmaterial", "Jahresfeier zum Mitgliederpreis"],
    idealFor: "Vereine, Stammtische, Kurse, Chöre, Tanzgruppen",
    note: "Zwei Abende pro Woche: 990 € / Monat.",
    proposal: true,
  },
  {
    id: "studio-monthly",
    name: "Studio & Kurse",
    eyebrow: "Wintergarten oder Bühne",
    monthly: 49000,
    yearly: 44000,
    unit: "pro Monat zzgl. NK",
    includes: ["Wintergarten (Tageslicht) oder Bühnenraum", "Bis 5 Blöcke pro Woche zu festen Zeiten", "Garderobe und WC-Anlagen", "Aufbewahrung von Matten, Technik oder Material"],
    idealFor: "Yoga, Tanz, Musikunterricht, Fotostudio, Workshops",
    proposal: true,
  },
  {
    id: "popup",
    name: "Pop-up-Gastronomie",
    eyebrow: "Restaurant + Küche + Biergarten",
    monthly: 290000,
    yearly: 249000,
    unit: "pro Monat zzgl. NK",
    includes: ["Restaurant (60 Plätze), Küche, Kühlhaus, Theke", "Biergarten (100 Plätze) in der Saison", "Hotelgäste als Frühstücks- und Abendkundschaft", "Laufzeit ab 3 Monaten"],
    idealFor: "Gastronomen, die ein Konzept testen; Saisonbetriebe; Küchenchefs ohne eigenes Haus",
    note: "Alternativ Umsatzpacht: 8 % vom Netto-Umsatz, mindestens 1.900 € / Monat.",
    proposal: true,
  },
  {
    id: "whole-house",
    name: "Das ganze Erdgeschoss",
    eyebrow: "Alle Räume, Küche, Biergarten",
    monthly: null,
    unit: "individuelles Angebot",
    includes: ["Restaurant, Nebenzimmer, Bühne, Alte Wirtschaft, Wintergarten, Biergarten", "Küche, Kühlhaus, Theke", "Laufzeit 12 Monate und länger", "Option auf Hotelkontingent"],
    idealFor: "Gastronomie-Pacht, Veranstalter, Co-Working-Betreiber, Tagungsanbieter",
    note: "Richtwert 7–10 € / m² kalt, Staffelmiete in den ersten drei Jahren möglich.",
    proposal: true,
  },
];

export const longtermCopy = {
  eyebrow: "Dauerhaft mieten",
  title: "Räume, die sich jeden Monat lohnen.",
  text:
    "Das Erdgeschoss der Krone ist nicht nur für Feste da. Wer regelmäßig Platz braucht, zahlt eine feste Monatsmiete statt einzelner Tage – " +
    "und je länger die Laufzeit, desto günstiger der Monat.",
  footnote: "Alle Monatsmieten sind Vorschläge, zzgl. MwSt. und Nebenkosten. Konditionen werden im Gespräch festgelegt.",
};
