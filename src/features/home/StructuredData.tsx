import { siteConfig } from "@/config/site";

/**
 * schema.org data with VERIFIED facts only (name, locality, postal code,
 * country, URL). No ratings, reviews, prices, phone numbers or opening hours
 * are emitted until they are confirmed.
 */
export function StructuredData() {
  const { address } = siteConfig;
  const data = {
    "@context": "https://schema.org",
    "@type": ["Hotel", "Restaurant"],
    name: `${siteConfig.name} Leidersbach`,
    description: siteConfig.description,
    url: siteConfig.url,
    address: {
      "@type": "PostalAddress",
      ...(address.street ? { streetAddress: address.street } : {}),
      postalCode: address.postalCode,
      addressLocality: address.city,
      addressCountry: address.countryCode,
    },
    ...(siteConfig.contact.phone ? { telephone: siteConfig.contact.phone } : {}),
    ...(siteConfig.contact.email ? { email: siteConfig.contact.email } : {}),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
