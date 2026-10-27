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
  tagline: "Eventlocation · Leidersbach",
  description:
    "Eventlocation „Zur Krone“ in Leidersbach: Räume für Hochzeiten, Feiern und Firmenveranstaltungen bis 160 Personen – Restaurant, Nebenzimmer, Bühne, Alte Wirtschaft, Wintergarten und Biergarten, einzeln oder kombiniert. Übernachtung für Ihre Gäste im Haus. Unverbindlich anfragen.",
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
    eyebrow: "Eventlocation · Leidersbach",
    title: "Willkommen in der Krone.",
    subline: "Hochzeiten, Feiern und Firmenveranstaltungen bis 160 Personen. Säle, Wintergarten und Biergarten unter einem Dach – und Zimmer für Ihre Gäste gleich darüber.",
    primaryCta: { label: "Räume entdecken", href: "#bereiche" },
    secondaryCta: { label: "Termin anfragen", href: "/buchen" },
    /**
     * Reference only – the player resolves the film itself (src/lib/media.ts → getHeroVideo,
     * see public/media/hero/README.md). Paths point to files that exist.
     */
    video: {
      src: "/media/hero/krone-film.mp4",
      srcSmall: "/media/hero/krone-film-720.mp4",
      poster: "/media/hero/poster.webp",
    },
  },

  positioning: {
    eyebrow: "Das Haus",
    title: "Ein Gasthof mit Platz für große und kleine Feste.",
    text:
      "Unter einem Dach liegen Gaststube, Nebenzimmer, Bühne, Alte Wirtschaft und Wintergarten, dahinter der Biergarten, darüber die Zimmer für Ihre Gäste. " +
      "Sie wählen genau die Räume, die Ihr Anlass braucht – einen einzelnen oder das ganze Haus. Das Angebot stellen wir Ihnen persönlich zusammen.",
  },

  mapSection: {
    eyebrow: "Raumplaner",
    title: "Wählen Sie Ihre Räume.",
    text: "Tippen Sie auf der Luftaufnahme die Bereiche an, die Sie nutzen möchten. Mit einem Datum zeigt die Karte sofort, was frei ist.",
    dateQuestion: "Wann möchten Sie feiern?",
  },

  demoNotice:
    "Demo-Modus: Verfügbarkeiten und Zusatzleistungen sind Beispieldaten und nicht verbindlich. Es werden keine E-Mails versendet.",
} as const;

export type SiteConfig = typeof siteConfig;

export function formatAddressLine(): string {
  const { street, postalCode, city } = siteConfig.address;
  return [street, `${postalCode} ${city}`].filter(Boolean).join(", ");
}
