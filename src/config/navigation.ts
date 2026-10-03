export interface NavItem {
  label: string;
  href: string;
}

/** Main menu – the house first, then what one does there. */
export const mainNavigation: NavItem[] = [
  { label: "Hotel", href: "/hotel" },
  { label: "Eventlocation", href: "/eventlocation" },
  { label: "Umgebung", href: "/sehenswuerdigkeiten" },
  { label: "Aktuelles", href: "/aktuelles" },
  { label: "Galerie", href: "/galerie" },
  { label: "Kontakt", href: "/kontakt" },
];

export const headerCta: NavItem = { label: "Zimmer buchen", href: "/hotel/buchen" };

export const legalNavigation: NavItem[] = [
  { label: "Impressum", href: "/impressum" },
  { label: "Datenschutz", href: "/datenschutz" },
  { label: "AGB", href: "/agb" },
  { label: "Mietbedingungen", href: "/mietbedingungen" },
  { label: "Hausordnung", href: "/hausordnung" },
];

export const footerNavigation: NavItem[] = [
  { label: "Hotel & Zimmer", href: "/hotel" },
  { label: "Zimmer buchen", href: "/hotel/buchen" },
  { label: "Eventlocation", href: "/eventlocation" },
  { label: "Raumplaner", href: "/eventlocation#karte" },
  { label: "Angebote & Aktuelles", href: "/aktuelles" },
  { label: "Sehenswürdigkeiten", href: "/sehenswuerdigkeiten" },
  { label: "Galerie", href: "/galerie" },
  { label: "FAQ", href: "/faq" },
  { label: "Kontakt & Anfahrt", href: "/kontakt" },
];

/** Routes whose first screen is a full-bleed hero: the header starts transparent there. */
export const heroRoutes = ["/", "/hotel", "/eventlocation", "/sehenswuerdigkeiten", "/aktuelles"];
