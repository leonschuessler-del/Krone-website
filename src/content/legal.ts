/**
 * LEGAL PLACEHOLDERS – LEGAL REVIEW REQUIRED.
 * None of these texts is legally valid. They only define the structure of the
 * pages. Replace every section with texts checked by a lawyer before launch.
 */
export interface LegalSection {
  id: string;
  heading: string;
  placeholder: string;
}

export interface LegalDocument {
  slug: string;
  title: string;
  intro: string;
  sections: LegalSection[];
}

const note = "Inhalt folgt – dieser Abschnitt wird vor dem Livegang durch eine rechtliche Prüfung erstellt.";

export const legalDocuments: Record<string, LegalDocument> = {
  impressum: {
    slug: "impressum",
    title: "Impressum",
    intro: "Angaben gemäß den gesetzlichen Informationspflichten.",
    sections: [
      { id: "anbieter", heading: "Anbieter", placeholder: "Name/Firma, Rechtsform, Anschrift, Vertretungsberechtigte – Angaben folgen." },
      { id: "kontakt", heading: "Kontakt", placeholder: "Telefon, E-Mail – Angaben folgen." },
      { id: "register", heading: "Register & Steuern", placeholder: "Registereintrag, USt-IdNr. (falls vorhanden) – Angaben folgen." },
      { id: "verantwortlich", heading: "Verantwortlich für den Inhalt", placeholder: note },
      { id: "streitbeilegung", heading: "Verbraucherstreitbeilegung", placeholder: note },
    ],
  },
  datenschutz: {
    slug: "datenschutz",
    title: "Datenschutzhinweise",
    intro: "Informationen zur Verarbeitung personenbezogener Daten auf dieser Website.",
    sections: [
      { id: "verantwortlicher", heading: "Verantwortlicher", placeholder: note },
      { id: "hosting", heading: "Hosting & Server-Logfiles", placeholder: note },
      { id: "buchung", heading: "Buchungen, Anfragen & Kontaktformular", placeholder: note },
      { id: "zahlung", heading: "Zahlungsabwicklung", placeholder: note },
      { id: "cookies", heading: "Cookies & lokale Speicherung", placeholder: "Die Website setzt derzeit keine Tracking-Cookies. Für die Buchungsauswahl wird der Sitzungsspeicher des Browsers (sessionStorage) genutzt. Admin-Anmeldung: technisch notwendiges Sitzungs-Cookie. [Rechtliche Formulierung folgt]" },
      { id: "rechte", heading: "Ihre Rechte", placeholder: note },
    ],
  },
  agb: {
    slug: "agb",
    title: "Allgemeine Geschäftsbedingungen",
    intro: "Allgemeine Bedingungen für Leistungen der Krone.",
    sections: [
      { id: "geltung", heading: "Geltungsbereich", placeholder: note },
      { id: "vertrag", heading: "Vertragsschluss", placeholder: note },
      { id: "preise", heading: "Preise & Zahlung", placeholder: note },
      { id: "haftung", heading: "Haftung", placeholder: note },
    ],
  },
  mietbedingungen: {
    slug: "mietbedingungen",
    title: "Mietbedingungen",
    intro: "Bedingungen für die Anmietung von Bereichen der Krone.",
    sections: [
      { id: "mietgegenstand", heading: "Mietgegenstand", placeholder: note },
      { id: "mietdauer", heading: "Mietdauer & Nutzung", placeholder: note },
      { id: "zahlung", heading: "Miete & Zahlung", placeholder: note },
      { id: "kaution", heading: "Kaution", placeholder: note },
      { id: "storno", heading: "Stornierung", placeholder: note },
      { id: "uebergabe", heading: "Übergabe & Rückgabe", placeholder: note },
      { id: "haftung", heading: "Haftung & Schäden", placeholder: note },
    ],
  },
  hausordnung: {
    slug: "hausordnung",
    title: "Hausordnung",
    intro: "Regeln für einen angenehmen Aufenthalt und reibungslose Veranstaltungen.",
    sections: [
      { id: "allgemein", heading: "Allgemeines", placeholder: note },
      { id: "laerm", heading: "Ruhezeiten & Lautstärke", placeholder: note },
      { id: "dekoration", heading: "Dekoration & Technik", placeholder: note },
      { id: "reinigung", heading: "Reinigung", placeholder: note },
      { id: "sicherheit", heading: "Sicherheit & Brandschutz", placeholder: note },
    ],
  },
};
