import { siteScope } from "@/config/scope";

export interface NavItem {
  label: string;
  href: string;
  /** Points to another website (e.g. the operator's main site): rendered as a plain <a>, not next/link. */
  external?: boolean;
}

/** True for absolute URLs (http/https, mailto, tel) – those never go through next/link. */
export function isExternalHref(href: string): boolean {
  return /^(https?:)?\/\/|^(mailto|tel):/i.test(href);
}

/**
 * Event-only scope (10/2026): the site is the event location of the Krone,
 * linked from krone-landhotel.de. Hotel, offers and sights are archived
 * (see ARCHIV.md) – the old menu is in the Git tag archiv/vollversion-2026-10.
 */
export const mainNavigation: NavItem[] = [
  { label: "Räume", href: "/#bereiche" },
  { label: "Raumplaner", href: "/#karte" },
  { label: "Galerie", href: "/galerie" },
  { label: "FAQ", href: "/faq" },
  { label: "Kontakt", href: "/kontakt" },
];

export const headerCta: NavItem = { label: "Termin anfragen", href: "/buchen" };

export const legalNavigation: NavItem[] = [
  { label: "Impressum", href: "/impressum" },
  { label: "Datenschutz", href: "/datenschutz" },
  { label: "AGB", href: "/agb" },
  { label: "Mietbedingungen", href: "/mietbedingungen" },
  { label: "Hausordnung", href: "/hausordnung" },
];

export const footerNavigation: NavItem[] = [
  { label: "Räume", href: "/#bereiche" },
  { label: "Raumplaner", href: "/#karte" },
  { label: "Termin anfragen", href: "/buchen" },
  { label: "Galerie", href: "/galerie" },
  { label: "FAQ", href: "/faq" },
  { label: "Kontakt & Anfahrt", href: "/kontakt" },
  { label: "Hotel & Zimmer", href: siteScope.mainSiteUrl, external: true },
];

/** Routes whose first screen is a full-bleed hero: the header starts transparent there. */
export const heroRoutes = ["/"];
