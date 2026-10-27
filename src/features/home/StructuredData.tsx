import { siteConfig } from "@/config/site";
import { siteScope } from "@/config/scope";

/**
 * schema.org data for the event location with VERIFIED facts only (name,
 * address, phone, e-mail, URL). Event-only scope (10/2026): no priceRange,
 * offers or prices; no ratings, reviews or opening hours until confirmed.
 * The hotel is the operator's main site and only referenced via `sameAs`.
 */
export function StructuredData() {
  const { address, contact } = siteConfig;
  const data = {
    "@context": "https://schema.org",
    "@type": ["EventVenue", "LocalBusiness"],
    name: "Eventlocation Zur Krone Leidersbach",
    alternateName: "Landhotel Gasthof Zur Krone",
    description: siteConfig.description,
    url: siteConfig.url,
    maximumAttendeeCapacity: 160,
    amenityFeature: [
      { "@type": "LocationFeatureSpecification", name: "Profiküche", value: true },
      { "@type": "LocationFeatureSpecification", name: "Biergarten", value: true },
      { "@type": "LocationFeatureSpecification", name: "Übernachtung im Haus", value: true },
      { "@type": "LocationFeatureSpecification", name: "Parkplätze am Haus", value: true },
    ],
    address: {
      "@type": "PostalAddress",
      ...(address.street ? { streetAddress: address.street } : {}),
      postalCode: address.postalCode,
      addressLocality: address.city,
      addressCountry: address.countryCode,
    },
    ...(contact.phone ? { telephone: contact.phone } : {}),
    ...(contact.email ? { email: contact.email } : {}),
    sameAs: [siteScope.mainSiteUrl],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
