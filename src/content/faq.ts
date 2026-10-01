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
      "Ja. Auf der Grundstückskarte können Sie beliebig viele Bereiche gleichzeitig auswählen – zum Beispiel Restaurant, Bühne und Wintergarten. Die Verfügbarkeit wird für jeden Bereich einzeln geprüft; buchbar ist die Zeit, in der alle gewählten Bereiche frei sind.",
  },
  {
    id: "full-venue",
    question: "Kann ich die gesamte Location mieten?",
    answer:
      "Mit „Gesamte Location“ wählen Sie mit einem Klick alle dafür vorgesehenen Bereiche aus. Sie sehen trotzdem jeden Bereich einzeln in Ihrer Zusammenfassung. Die Konditionen für die gesamte Location werden individuell abgestimmt.",
  },
  {
    id: "free-dates",
    question: "Wie sehe ich freie Termine?",
    answer:
      "Wählen Sie Ihre Bereiche und öffnen Sie „Verfügbarkeit prüfen“. Der Kalender zeigt Ihnen gemeinsame freie Tage – auf Wunsch auch die Verfügbarkeit je Bereich. Sobald Sie ein Datum wählen, färbt sich auch die Karte entsprechend ein.",
  },
  {
    id: "hotel",
    question: "Kann ich Hotelzimmer dazu buchen?",
    answer:
      "Ja. Die Übernachtung im Landhotel fügen Sie bei Ihrer Anfrage einfach hinzu. Das Hotel mit zehn Zimmern und einer Wohnung wird für Ihre Gesellschaft exklusiv vermietet; den Preis erhalten Sie mit unserem Angebot.",
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
      "Ja. Jede Auswahl kann auch als unverbindliche Anfrage gesendet werden. Manche Kombinationen – etwa die gesamte Location – werden grundsätzlich individuell kalkuliert und sind nur per Anfrage möglich.",
  },
];
