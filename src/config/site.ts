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
  legalName: null as string | null, // TODO: exact company / operator name (Impressum)
  brandLine: "Landhotel · Gasthof",
  locality: "Leidersbach",
  tagline: "Restaurant · Hotel · Events · Genuss",
  description:
    "Landhotel und Gasthof „Zur Krone“ in Leidersbach: Restaurant, Eventräume, Biergarten und Hotel – einzeln oder kombiniert für Ihren Anlass buchbar.",
  locale: "de-DE",
  timeZone: "Europe/Berlin",
  currency: "EUR",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  address: {
    street: null as string | null, // TODO: street + house number (needs verification)
    postalCode: "63849",
    city: "Leidersbach",
    country: "Deutschland",
    countryCode: "DE",
  },

  /** Known from the property listing – total area of the whole property/building. Not a rentable room size. */
  propertyFacts: {
    totalAreaSqm: 1720,
    totalAreaNote: "ca. 1.720 m² Gesamtfläche laut Immobilienangebot – keine vermietbare Nutzfläche einzelner Räume.",
  },

  contact: {
    phone: null as string | null, // TODO
    email: null as string | null, // TODO
    contactPerson: null as string | null, // TODO
    openingHoursNote: null as string | null, // TODO: office / reachability hours
    needsVerification: true,
  },

  /** Social links – configurable placeholders. Leave `url: null` to hide. */
  social: [
    { id: "instagram", label: "Instagram", url: null as string | null },
    { id: "facebook", label: "Facebook", url: null as string | null },
  ],

  hero: {
    eyebrow: "Landhotel · Gasthof · Leidersbach",
    title: "Ein Ort. Viele Möglichkeiten.",
    subline: "Restaurant, Eventräume, Biergarten und Hotel – flexibel kombinierbar für Ihren Anlass.",
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
    eyebrow: "Willkommen in der Krone",
    title: "Tradition und Gastlichkeit – mit Raum für Ihre Ideen.",
    text:
      "Zur Krone vereint Restaurant, mehrere Veranstaltungsbereiche, Biergarten und Hotel auf einem Grundstück. " +
      "Wählen Sie genau die Bereiche, die Ihr Anlass braucht – vom einzelnen Raum bis zur gesamten Location.",
  },

  mapSection: {
    eyebrow: "Interaktive Grundstückskarte",
    title: "Stellen Sie Ihre Location zusammen.",
    text: "Wählen Sie einen oder mehrere Bereiche direkt auf der Karte. Mit einem Termin sehen Sie sofort, was frei ist.",
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
