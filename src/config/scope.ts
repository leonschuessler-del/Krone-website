/**
 * Scope of the public website (10/2026): only the event location goes live.
 * It is linked from the operator's existing website (krone-landhotel.de) via its
 * "Eventlocation" button. Hotel, offers and sights pages are archived under
 * src/app/(site)/_archiv (not routed, nothing deleted) – see ARCHIV.md.
 *
 *  - showPrices: false → no price, total, discount or deposit amount is shown or
 *    sent to the browser anywhere on the public site. Everything is "auf Anfrage".
 *    Prices stay in the database/admin for internal quotes.
 *  - requestOnly: true → the booking flow only sends non-binding requests
 *    (no online payment, no binding booking).
 */
export const siteScope = {
  eventOnly: true,
  showPrices: false,
  requestOnly: true,
  /** The operator's existing website – hotel, restaurant and everything not on this site. */
  mainSiteUrl: process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? "https://www.krone-landhotel.de",
  mainSiteLabel: "Zur Krone Hauptseite",
} as const;

/** The one wording used wherever a price would stand. */
export const PRICE_ON_REQUEST = "Preis auf Anfrage";
export const ON_REQUEST = "auf Anfrage";
