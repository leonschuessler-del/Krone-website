export interface NavItem {
  label: string;
  href: string;
}

export const mainNavigation: NavItem[] = [
  { label: "Start", href: "/" },
  { label: "Location", href: "/#location" },
  { label: "Bereiche", href: "/bereiche" },
  { label: "Hotel", href: "/bereiche/hotel" },
  { label: "Galerie", href: "/galerie" },
  { label: "Buchen", href: "/buchen" },
  { label: "Kontakt", href: "/kontakt" },
];

export const headerCta: NavItem = { label: "Jetzt buchen", href: "/buchen" };

export const legalNavigation: NavItem[] = [
  { label: "Impressum", href: "/impressum" },
  { label: "Datenschutz", href: "/datenschutz" },
  { label: "AGB", href: "/agb" },
  { label: "Mietbedingungen", href: "/mietbedingungen" },
  { label: "Hausordnung", href: "/hausordnung" },
];

export const footerNavigation: NavItem[] = [
  { label: "Bereiche", href: "/bereiche" },
  { label: "Raumplaner", href: "/#karte" },
  { label: "Hotel", href: "/bereiche/hotel" },
  { label: "Galerie", href: "/galerie" },
  { label: "FAQ", href: "/faq" },
  { label: "Buchen", href: "/buchen" },
  { label: "Kontakt", href: "/kontakt" },
];
