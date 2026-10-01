/**
 * Central site configuration. All customer-facing copy that is not tied to a
 * single space lives here or in `src/content/*` – never scattered across
 * components.
 *
 * Values marked `needsVerification: true` or containing `null` are
 * placeholders and must be confirmed by the operator before going live.
 */

export const siteConfig = {
  name: "Zur Krone",
  legalName: "Landhotel Gasthof „Zur Krone“, Inh. Boris Schüßler" as string | null, // Impressum krone-landhotel.de
  brandLine: "Landhotel · Gasthof",
  locality: "Leidersbach",
  tagline: "Eventlocation · Landhotel · Leidersbach",
  description:
    "Landhotel Gasthof „Zur Krone“ in Leidersbach: Eventlocation für Hochzeiten, Feiern und Firmenveranstaltungen bis 160 Personen – Säle, Wintergarten, Biergarten und Hotel, einzeln oder kombiniert buchbar.",
  locale: "de-DE",
  timeZone: "Europe/Berlin",
  currency: "EUR",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  address: {
    street: "Hauptstraße 106" as string | null, // Impressum krone-landhotel.de
    postalCode: "63849",
    city: "Leidersbach",
    country: "Deutschland",
    countryCode: "DE",
  },

  /** Known from the property listing – total area of the whole property/building. Not a rentable room size. */
  propertyFacts: {
    totalAreaSqm: 1720,
    totalAreaNote: "ca. 1.720 m² Fläche des Anwesens (Immobilienangebot) – keine vermietbare Nutzfläche einzelner Räume.",
  },

  contact: {
    phone: "+49 6028 99967-0" as string | null,
    fax: "+49 6028 99967-24" as string | null,
    email: "info@krone-landhotel.de" as string | null,
    contactPerson: "Boris Schüßler" as string | null,
    openingHoursNote: null as string | null, // TODO: office / reachability hours
    needsVerification: false,
  },

  /** Social links – configurable placeholders. Leave `url: null` to hide. */
  social: [
    { id: "instagram", label: "Instagram", url: null as string | null },
    { id: "facebook", label: "Facebook", url: null as string | null },
  ],

  hero: {
    eyebrow: "Eventlocation · Landhotel · Leidersbach",
    title: "Willkommen in der Krone.",
    subline: "Hochzeiten, Feiern und Firmenveranstaltungen bis 160 Personen. Säle, Wintergarten, Biergarten und ein eigenes Hotel unter einem Dach.",
    primaryCta: { label: "Location entdecken", href: "#location" },
    secondaryCta: { label: "Bereiche auswählen", href: "#karte" },
    video: {
      /** Put the final film here. Until the file exists, a stylised animated placeholder is shown. */
      src: "/media/hero/krone-property-tour.mp4",
      srcWebm: "/media/hero/krone-property-tour.webm",
      poster: "/media/hero/poster.webp",
    },
  },

  positioning: {
    eyebrow: "Das Haus",
    title: "Ein Gasthof mit Platz für große und kleine Feste.",
    text:
      "Unter einem Dach liegen Gaststube, Nebenzimmer, Bühne, Alte Wirtschaft und Wintergarten, dahinter der Biergarten, darüber das Landhotel. " +
      "Sie mieten genau die Räume, die Ihr Anlass braucht: einen einzelnen oder das ganze Haus.",
  },

  mapSection: {
    eyebrow: "Raumplaner",
    title: "Wählen Sie Ihre Räume.",
    text: "Tippen Sie auf der Luftaufnahme die Bereiche an, die Sie nutzen möchten. Mit einem Datum zeigt die Karte sofort, was frei ist.",
    dateQuestion: "Wann möchten Sie feiern?",
  },

  demoNotice:
    "Demo-Modus: Verfügbarkeiten, Preise und Zusatzleistungen sind Beispieldaten und nicht verbindlich. Es werden keine Zahlungen ausgeführt und keine E-Mails versendet.",
} as const;

export type SiteConfig = typeof siteConfig;

export function formatAddressLine(): string {
  const { street, postalCode, city } = siteConfig.address;
  return [street, `${postalCode} ${city}`].filter(Boolean).join(", ");
}
