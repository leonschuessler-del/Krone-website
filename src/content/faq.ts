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
      "Zimmer für Ihre Gäste können Sie im Buchungsprozess als Zusatzwunsch angeben. Zimmerkategorien, Anzahl und Preise werden noch ergänzt – bis dahin werden Zimmeranfragen individuell beantwortet.",
    needsVerification: true,
  },
  {
    id: "deposit",
    question: "Wie funktioniert die Kaution?",
    answer:
      "Die Kaution wird getrennt von der Miete ausgewiesen und ist kein Teil des Mietpreises. Höhe, Zahlungszeitpunkt und Rückerstattung regeln die Kautionsbedingungen, die derzeit noch erstellt werden.",
    needsVerification: true,
  },
  {
    id: "handover",
    question: "Wann erfolgt die Übergabe?",
    answer:
      "Übergabe- und Rückgabezeit wählen Sie im Buchungsprozess aus den angebotenen Zeitfenstern. Die genauen Übergaberegeln werden noch veröffentlicht.",
    needsVerification: true,
  },
  {
    id: "inquiry",
    question: "Kann ich auch unverbindlich anfragen?",
    answer:
      "Ja. Jede Auswahl kann auch als unverbindliche Anfrage gesendet werden. Manche Kombinationen – etwa die gesamte Location – werden grundsätzlich individuell kalkuliert und sind nur per Anfrage möglich.",
  },
];
