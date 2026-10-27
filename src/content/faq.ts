import { siteScope } from "@/config/scope";

/**
 * FAQ (event location only, 10/2026). Answers describe how the venue and the
 * request process work – no prices, totals or discounts: everything is quoted
 * individually after a request (siteScope.showPrices === false).
 * Business rules that are not yet confirmed are flagged with needsVerification
 * (they stay visible but are left out of the FAQPage structured data).
 */
export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  needsVerification?: boolean;
}

/** "krone-landhotel.de" – the operator's main website (hotel rooms, restaurant). */
const mainSiteHost = (() => {
  try {
    return new URL(siteScope.mainSiteUrl).host.replace(/^www\./, "");
  } catch {
    return "der Hauptseite";
  }
})();

export const faqItems: FaqItem[] = [
  {
    id: "combine",
    question: "Kann ich mehrere Räume kombinieren?",
    answer:
      "Ja. Im Raumplaner wählen Sie beliebig viele Bereiche – etwa Restaurant, Bühne und Wintergarten. Möglich ist jeder Termin, an dem alle gewählten Räume frei sind.",
  },
  {
    id: "full-venue",
    question: "Kann ich die gesamte Location mieten?",
    answer:
      "Ja. „Gesamte Location“ wählt mit einem Klick alle dafür vorgesehenen Räume; in Ihrer Auswahl bleibt jeder einzeln sichtbar. Alles Weitere stimmen wir persönlich mit Ihnen ab.",
  },
  {
    id: "cost",
    question: "Was kostet die Anmietung?",
    answer:
      "Jede Feier ist anders. Nach Ihrer Anfrage erhalten Sie ein individuelles Angebot – zugeschnitten auf Räume, Termin, Gästezahl und gewünschte Zusatzleistungen.",
  },
  {
    id: "free-dates",
    question: "Wie sehe ich freie Termine?",
    answer:
      "Räume wählen, „Verfügbarkeit prüfen“ öffnen: Der Kalender zeigt die gemeinsamen freien Tage, auf Wunsch je Raum. Mit einem Datum färbt sich auch die Karte ein.",
  },
  {
    id: "extras",
    question: "Welche Zusatzleistungen gibt es?",
    answer:
      "Zu Ihren Räumen können Sie Kühlhaus, Theke mit Zapfanlage sowie Gläser, Geschirr und Besteck anfragen. Die Profiküche steht zusammen mit einem Caterer zur Verfügung, Licht- und Tontechnik für die Bühne auf Anfrage.",
  },
  {
    id: "hotel",
    question: "Können unsere Gäste im Haus übernachten?",
    answer:
      `Ja. Über den Festräumen liegt das Landhotel: acht Doppelzimmer, zwei Einzelzimmer und ein Apartment, alle mit eigenem Bad und Frühstück am Morgen. ` +
      `Zu Ihrer Feier fragen Sie die ganze Etage einfach als Zusatzleistung mit an. Einzelne Zimmer buchen Ihre Gäste direkt über ${mainSiteHost}.`,
  },
  {
    id: "deposit",
    question: "Gibt es eine Kaution?",
    answer:
      "Eine Kaution weisen wir getrennt von der Miete aus. Höhe, Fälligkeit und Rückzahlung stehen in Ihrem individuellen Angebot.",
    needsVerification: true,
  },
  {
    id: "handover",
    question: "Wann erfolgt die Übergabe?",
    answer:
      "Übergabe und Rückgabe wählen Sie bei der Anfrage aus festen Zeitfenstern. Alles Weitere besprechen wir vorab persönlich mit Ihnen.",
    needsVerification: true,
  },
  {
    id: "inquiry",
    question: "Ist meine Anfrage verbindlich?",
    answer:
      "Nein. Über diese Website senden Sie ausschließlich unverbindliche Anfragen. Wir prüfen den Termin, melden uns persönlich und schicken Ihnen ein individuelles Angebot – verbindlich wird es erst, wenn Sie es annehmen.",
  },
];
