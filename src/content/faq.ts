/**
 * FAQ. Answers only describe how the website/booking system works.
 * Business rules that are not yet known are explicitly marked as
 * "folgt" and flagged with needsVerification.
 */
export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  needsVerification?: boolean;
}

export const faqItems: FaqItem[] = [
  {
    id: "combine",
    question: "Kann ich mehrere Bereiche kombinieren?",
    answer:
      "Ja. Auf der Karte wählen Sie beliebig viele Bereiche – etwa Restaurant, Bühne und Wintergarten. Buchbar ist die Zeit, in der alle gewählten Bereiche frei sind.",
  },
  {
    id: "full-venue",
    question: "Kann ich die gesamte Location mieten?",
    answer:
      "„Gesamte Location“ wählt mit einem Klick alle dafür vorgesehenen Bereiche; in der Zusammenfassung bleibt jeder einzeln sichtbar. Die Konditionen stimmen wir individuell ab.",
  },
  {
    id: "free-dates",
    question: "Wie sehe ich freie Termine?",
    answer:
      "Bereiche wählen, „Verfügbarkeit prüfen“ öffnen: Der Kalender zeigt die gemeinsamen freien Tage, auf Wunsch je Bereich. Mit einem Datum färbt sich auch die Karte ein.",
  },
  {
    id: "hotel",
    question: "Kann ich Hotelzimmer dazu buchen?",
    answer:
      "Ja. Das Landhotel im Obergeschoss hat acht Doppelzimmer (100 € / Nacht, zur Einzelnutzung 74 €), zwei Einzelzimmer (68 €) und ein Apartment, jeweils mit Frühstück. Die Zimmer buchen Sie einzeln über die Hotelseite – gern auch als Kontingent für Ihre Gäste; sprechen Sie uns dazu an.",
    needsVerification: true,
  },
  {
    id: "deposit",
    question: "Wie funktioniert die Kaution?",
    answer:
      "Die Kaution wird getrennt von der Miete ausgewiesen und ist kein Teil des Mietpreises. Höhe, Zahlungszeitpunkt und Rückzahlung stehen in Ihrem Angebot.",
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
    question: "Kann ich auch unverbindlich anfragen?",
    answer:
      "Ja, jede Auswahl lässt sich unverbindlich anfragen. Manche Kombinationen – etwa die gesamte Location – kalkulieren wir grundsätzlich individuell, also nur auf Anfrage.",
  },
];
