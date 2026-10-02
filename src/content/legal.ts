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
          "Schriftarten und Medien werden von unserem eigenen Server geladen; es werden keine Daten an externe Schriftendienste übertragen. Die Grundstückskarte ist eine eigene Drohnenaufnahme.",
        ],
      },
      {
        id: "karte",
        heading: "Umgebungskarte (OpenStreetMap)",
        body: [
          "Auf den Seiten „Umgebung“ und „Kontakt“ können Sie eine interaktive Karte laden. Die Karte wird erst nach Ihrem Klick auf „Karte laden“ eingebunden; vorher werden keine Daten übertragen. Mit dem Laden werden Kartenkacheln von den Servern der OpenStreetMap Foundation (St John's Innovation Centre, Cowley Road, Cambridge, CB4 0WS, Vereinigtes Königreich) abgerufen. Dabei werden Ihre IP-Adresse und die angezeigten Kartenausschnitte übermittelt.",
          "Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG), die Sie jederzeit durch erneutes Laden der Seite zurücknehmen. Für das Vereinigte Königreich liegt ein Angemessenheitsbeschluss der EU-Kommission vor. Weitere Informationen: https://wiki.osmfoundation.org/wiki/Privacy_Policy",
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
    intro: "Allgemeine Geschäftsbedingungen für die Beherbergung im Landhotel Gasthof „Zur Krone“ (Hotel garni). Für die Anmietung von Räumen gelten zusätzlich die Mietbedingungen.",
    updated: "Oktober 2026 – Entwurf zur rechtlichen Prüfung",
    draft: true,
    sections: [
      {
        id: "geltung",
        heading: "1. Geltungsbereich",
        body: [
          "Diese Bedingungen gelten für Verträge über die mietweise Überlassung von Hotelzimmern und des Apartments zur Beherbergung sowie für alle damit zusammenhängenden Leistungen des Hauses (Beherbergungsvertrag).",
          "Abweichende Bedingungen des Gastes gelten nur, wenn sie ausdrücklich schriftlich vereinbart wurden.",
        ],
      },
      {
        id: "vertrag",
        heading: "2. Vertragsschluss",
        body: [
          "Eine Reservierungsanfrage über die Website ist unverbindlich. Der Vertrag kommt mit der Bestätigung des Hauses per E-Mail zustande (Reservierungsnummer). Vertragspartner sind das Haus und der Gast; bestellt ein Dritter für den Gast, haftet er gegenüber dem Haus zusammen mit dem Gast als Gesamtschuldner.",
          "Die Unter- oder Weitervermietung der überlassenen Zimmer sowie deren Nutzung zu anderen als Beherbergungszwecken bedürfen der vorherigen Zustimmung des Hauses in Textform.",
        ],
      },
      {
        id: "preise",
        heading: "3. Preise und Zahlung",
        body: [
          "Die vereinbarten Preise verstehen sich inklusive der gesetzlichen Mehrwertsteuer und inklusive Frühstück, sofern nichts anderes angegeben ist. Zusatzleistungen (z. B. Zustellbett, Babybett, Haustier) werden gesondert berechnet.",
          "Die Zahlung erfolgt vor Ort bei Anreise oder Abreise, bar oder mit EC-, Maestro-, Visa- oder Mastercard. Bei Gruppen und längeren Aufenthalten kann das Haus eine angemessene Vorauszahlung verlangen.",
        ],
      },
      {
        id: "storno",
        heading: "4. Rücktritt des Gastes (Stornierung)",
        body: [
          "Bis zu 2 Tage vor dem Anreisetag kann der Gast kostenlos zurücktreten. Bei einem Rücktritt innerhalb von 2 Tagen vor der Anreise berechnet das Haus 80 % des Gesamtpreises der Buchung; bei Nichtanreise wird der Gesamtpreis berechnet.",
          "Dem Gast steht der Nachweis frei, dass dem Haus kein oder ein geringerer Schaden entstanden ist. Das Haus bemüht sich, nicht in Anspruch genommene Zimmer anderweitig zu vergeben; gelingt dies, entfällt die Berechnung insoweit.",
        ],
      },
      {
        id: "anreise",
        heading: "5. An- und Abreise",
        body: [
          "Die Zimmer stehen am Anreisetag ab 15:30 Uhr zur Verfügung; die Anreise ist bis 21:00 Uhr möglich, danach nach Absprache über den Schlüsselsafe. Am Abreisetag sind die Zimmer montags bis freitags bis 10:00 Uhr, samstags und sonntags bis 11:00 Uhr zu räumen.",
          "Bei verspäteter Räumung kann das Haus für die zusätzliche Nutzung bis 18:00 Uhr 50 %, danach 100 % des Zimmerpreises berechnen.",
        ],
      },
      {
        id: "haustiere",
        heading: "6. Haustiere",
        body: ["Haustiere sind nach vorheriger Absprache gegen den ausgewiesenen Aufpreis willkommen. Der Gast haftet für Schäden, die durch mitgebrachte Tiere entstehen."],
      },
      {
        id: "haftung",
        heading: "7. Haftung",
        body: [
          "Das Haus haftet für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit sowie für vorsätzlich oder grob fahrlässig verursachte Schäden nach den gesetzlichen Vorschriften. Im Übrigen ist die Haftung für leicht fahrlässig verursachte Schäden ausgeschlossen, soweit keine wesentlichen Vertragspflichten betroffen sind.",
          "Für eingebrachte Sachen haftet das Haus nach den gesetzlichen Bestimmungen (§§ 701 ff. BGB). Fahrzeuge auf dem Parkplatz des Hauses werden nicht verwahrt; eine Haftung besteht nur bei Verschulden des Hauses.",
        ],
      },
      {
        id: "schluss",
        heading: "8. Schlussbestimmungen",
        body: [
          "Es gilt deutsches Recht. Erfüllungsort ist Leidersbach. Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.",
          "Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
        ],
      },
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
