/**
 * Legal pages.
 *
 * Impressum and Datenschutz: operator data as published on krone-landhotel.de
 * (Impressum, retrieved 10/2026), adapted to this website (§ 5 DDG instead of
 * the former § 5 TMG; the EU online dispute platform was discontinued in July
 * 2025 and is no longer referenced). Have both reviewed before launch.
 *
 * AGB, Mietbedingungen, Hausordnung: structure only (`draft: true`) – the
 * operator's own terms are inserted here; nothing is invented.
 */
export interface LegalSection {
  id: string;
  heading: string;
  /** Paragraphs; a line starting with "• " renders as a list item. */
  body: string[];
  /** Only shown when this provider is switched on (see src/lib/env.ts). */
  when?: "stripe" | "resend";
}

export interface LegalDocument {
  slug: string;
  title: string;
  intro: string;
  updated?: string;
  /** Placeholder document – shows a notice instead of pretending to be final. */
  draft?: boolean;
  sections: LegalSection[];
}

export const operator = {
  name: "Landhotel Gasthof „Zur Krone“",
  owner: "Boris Schüßler",
  street: "Hauptstraße 106",
  city: "63849 Leidersbach",
  phone: "+49 6028 99967-0",
  phoneHref: "+496028999670",
  fax: "+49 6028 99967-24",
  email: "info@krone-landhotel.de",
  vatId: "DE 297367201",
} as const;

const draftNote = "Dieser Abschnitt wird mit den Bedingungen des Hauses ergänzt. Bis dahin beantworten wir Fragen gern persönlich.";

export const legalDocuments: Record<string, LegalDocument> = {
  impressum: {
    slug: "impressum",
    title: "Impressum",
    intro: "Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG).",
    sections: [
      {
        id: "anbieter",
        heading: "Anbieter",
        body: [operator.name, `Inh. ${operator.owner}`, operator.street, operator.city],
      },
      {
        id: "kontakt",
        heading: "Kontakt",
        body: [`Telefon: ${operator.phone}`, `Fax: ${operator.fax}`, `E-Mail: ${operator.email}`],
      },
      {
        id: "steuern",
        heading: "Umsatzsteuer",
        body: [`Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: ${operator.vatId}`],
      },
      {
        id: "verantwortlich",
        heading: "Verantwortlich für den Inhalt",
        body: [`Verantwortlich für journalistisch-redaktionelle Inhalte gemäß § 18 Abs. 2 Medienstaatsvertrag: ${operator.owner}, Anschrift wie oben.`],
      },
      {
        id: "streitbeilegung",
        heading: "Verbraucherstreitbeilegung",
        body: ["Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen."],
      },
      {
        id: "haftung",
        heading: "Haftung für Inhalte und Links",
        body: [
          "Die Inhalte dieser Website werden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität können wir jedoch keine Gewähr übernehmen. Angaben zu Flächen und Plätzen, die als „ca.“ gekennzeichnet sind, sind Richtwerte.",
          "Für Inhalte verlinkter externer Websites sind ausschließlich deren Betreiber verantwortlich. Bei Bekanntwerden von Rechtsverletzungen entfernen wir entsprechende Links umgehend.",
        ],
      },
      {
        id: "urheberrecht",
        heading: "Urheberrecht und Bildnachweis",
        body: [
          "Texte, Fotos, Drohnen- und Videoaufnahmen auf dieser Website sind eigene Aufnahmen des Landhotels Gasthof „Zur Krone“ und urheberrechtlich geschützt. Eine Verwendung außerhalb dieser Website bedarf unserer vorherigen Zustimmung.",
        ],
      },
    ],
  },

  datenschutz: {
    slug: "datenschutz",
    title: "Datenschutzerklärung",
    intro: "Wir behandeln Ihre Daten vertraulich und verarbeiten nur, was für den Betrieb dieser Website und die Bearbeitung Ihrer Anfrage nötig ist. Diese Website verwendet keine Tracking- oder Werbe-Cookies und bindet keine Dienste von Google, Facebook o. Ä. ein.",
    updated: "Oktober 2026",
    sections: [
      {
        id: "verantwortlicher",
        heading: "Verantwortlicher",
        body: [
          `Verantwortlich für die Datenverarbeitung auf dieser Website im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:`,
          `${operator.name}, Inh. ${operator.owner}, ${operator.street}, ${operator.city}`,
          `Telefon: ${operator.phone} · E-Mail: ${operator.email}`,
        ],
      },
      {
        id: "hosting",
        heading: "Hosting und Server-Logfiles",
        body: [
          "Beim Aufruf dieser Website verarbeitet der Webserver automatisch Daten, die Ihr Browser übermittelt: IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Referrer-URL, Browsertyp und Betriebssystem. Diese Daten sind technisch erforderlich, um die Website auszuliefern und ihre Sicherheit zu gewährleisten (Art. 6 Abs. 1 lit. f DSGVO). Sie werden nicht mit anderen Daten zusammengeführt und spätestens nach 14 Tagen gelöscht, sofern sie nicht zur Aufklärung eines Sicherheitsvorfalls benötigt werden.",
          "Die Website wird bei einem externen Dienstleister betrieben, mit dem ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO besteht. [Name und Anschrift des Hosting-Anbieters werden vor dem Livegang ergänzt.]",
        ],
      },
      {
        id: "anfragen",
        heading: "Raumplaner, Buchungsanfragen und Kontakt",
        body: [
          "Wenn Sie über den Raumplaner, das Buchungsformular oder das Kontaktformular eine Anfrage senden oder uns per E-Mail oder Telefon kontaktieren, verarbeiten wir die von Ihnen angegebenen Daten: Name, E-Mail-Adresse, Telefonnummer (freiwillig), Anlass, Gästezahl, gewählte Räume, Termin und Ihre Nachricht.",
          "Zweck ist die Prüfung der Verfügbarkeit, die Beantwortung Ihrer Anfrage und gegebenenfalls die Durchführung des Mietvertrags (Art. 6 Abs. 1 lit. b DSGVO). Wir speichern diese Daten, solange es für die Bearbeitung nötig ist; für abgeschlossene Buchungen gelten die gesetzlichen Aufbewahrungsfristen (bis zu 10 Jahre nach HGB und AO). Reine Anfragen ohne Buchung löschen wir spätestens 12 Monate nach dem letzten Kontakt.",
          "Ihre Daten werden nicht an Dritte verkauft oder für Werbung genutzt.",
        ],
      },
      {
        id: "email",
        heading: "Versand von Bestätigungs-E-Mails",
        when: "resend",
        body: [
          "Bestätigungen zu Ihrer Anfrage versenden wir über den E-Mail-Dienst Resend (Resend, Inc., 2261 Market Street #5039, San Francisco, CA 94114, USA) als Auftragsverarbeiter. Dabei werden Ihre E-Mail-Adresse und der Inhalt der Nachricht übermittelt. Die Übermittlung in die USA erfolgt auf Grundlage der EU-Standardvertragsklauseln (Art. 46 DSGVO).",
        ],
      },
      {
        id: "zahlung",
        heading: "Online-Zahlung",
        when: "stripe",
        body: [
          "Für Anzahlungen nutzen wir den Zahlungsdienst Stripe (Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Dublin 2, Irland). Die Zahlungsdaten geben Sie direkt bei Stripe ein; wir erhalten nur die Bestätigung der Zahlung. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Es gilt zusätzlich die Datenschutzerklärung von Stripe.",
        ],
      },
      {
        id: "speicher",
        heading: "Cookies und Speicher im Browser",
        body: [
          "Diese Website setzt keine Cookies zu Analyse- oder Werbezwecken und verwendet keine Tracking-Dienste. Ein Cookie-Banner ist deshalb nicht erforderlich.",
          "Damit Ihre Raumauswahl beim Wechsel zwischen den Seiten erhalten bleibt, wird sie im Sitzungsspeicher Ihres Browsers (sessionStorage) abgelegt. Diese Daten verlassen Ihr Gerät nicht und werden beim Schließen des Browserfensters gelöscht (§ 25 Abs. 2 Nr. 2 TDDDG, technisch erforderlich).",
          "Schriftarten und Medien werden von unserem eigenen Server geladen; es werden keine Daten an externe Schriften- oder Kartendienste übertragen. Die Grundstückskarte ist eine eigene Drohnenaufnahme.",
        ],
      },
      {
        id: "rechte",
        heading: "Ihre Rechte",
        body: [
          "Sie haben jederzeit das Recht auf:",
          "• Auskunft über Ihre gespeicherten Daten (Art. 15 DSGVO)",
          "• Berichtigung unrichtiger Daten (Art. 16 DSGVO)",
          "• Löschung (Art. 17 DSGVO) und Einschränkung der Verarbeitung (Art. 18 DSGVO)",
          "• Datenübertragbarkeit (Art. 20 DSGVO)",
          "• Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21 DSGVO)",
          `Eine formlose Nachricht an ${operator.email} genügt.`,
          "Sie können sich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren. Für uns zuständig ist das Bayerische Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach.",
        ],
      },
      {
        id: "sicherheit",
        heading: "Datensicherheit",
        body: ["Die Übertragung dieser Website und aller Formulare erfolgt verschlüsselt (TLS/HTTPS)."],
      },
    ],
  },

  agb: {
    slug: "agb",
    title: "Allgemeine Geschäftsbedingungen",
    intro: "Allgemeine Bedingungen für Leistungen des Landhotels Gasthof „Zur Krone“.",
    draft: true,
    sections: [
      { id: "geltung", heading: "Geltungsbereich", body: [draftNote] },
      { id: "vertrag", heading: "Vertragsschluss", body: [draftNote] },
      { id: "preise", heading: "Preise & Zahlung", body: [draftNote] },
      { id: "haftung", heading: "Haftung", body: [draftNote] },
    ],
  },
  mietbedingungen: {
    slug: "mietbedingungen",
    title: "Mietbedingungen",
    intro: "Bedingungen für die Anmietung von Räumen der Krone.",
    draft: true,
    sections: [
      { id: "mietgegenstand", heading: "Mietgegenstand", body: [draftNote] },
      { id: "mietdauer", heading: "Mietdauer & Nutzung", body: [draftNote] },
      { id: "zahlung", heading: "Miete & Zahlung", body: [draftNote] },
      { id: "kaution", heading: "Kaution", body: [draftNote] },
      { id: "storno", heading: "Stornierung", body: [draftNote] },
      { id: "uebergabe", heading: "Übergabe & Rückgabe", body: [draftNote] },
      { id: "haftung", heading: "Haftung & Schäden", body: [draftNote] },
    ],
  },
  hausordnung: {
    slug: "hausordnung",
    title: "Hausordnung",
    intro: "Regeln für einen angenehmen Aufenthalt und reibungslose Veranstaltungen.",
    draft: true,
    sections: [
      { id: "allgemein", heading: "Allgemeines", body: [draftNote] },
      { id: "laerm", heading: "Ruhezeiten & Lautstärke", body: [draftNote] },
      { id: "dekoration", heading: "Dekoration & Technik", body: [draftNote] },
      { id: "reinigung", heading: "Reinigung", body: [draftNote] },
      { id: "sicherheit", heading: "Sicherheit & Brandschutz", body: [draftNote] },
    ],
  },
};
