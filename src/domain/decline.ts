/**
 * Reasons the operator can pick when declining a request. Each one carries the
 * sentence that goes into the customer's e-mail, so the customer knows exactly
 * why – no free text needed (an optional personal note can be added).
 */
export const DECLINE_REASONS = [
  { id: "date_taken", label: "Termin bereits vergeben", text: "der gewünschte Termin ist leider bereits vergeben." },
  { id: "duration", label: "Mietdauer passt nicht", text: "die gewünschte Mietdauer können wir an diesem Termin leider nicht anbieten." },
  { id: "capacity", label: "Gästezahl zu hoch", text: "für die angegebene Gästezahl reichen die gewählten Räume leider nicht aus." },
  { id: "event_type", label: "Art der Veranstaltung", text: "diese Art von Veranstaltung können wir in der Krone leider nicht ausrichten." },
  { id: "rooms", label: "Raumkombination nicht möglich", text: "die gewünschte Raumkombination ist an diesem Termin leider nicht möglich." },
  { id: "closed", label: "Betriebsferien / geschlossen", text: "in diesem Zeitraum ist das Haus geschlossen." },
  { id: "other", label: "Sonstiger Grund", text: "wir können Ihre Anfrage leider nicht annehmen." },
] as const;

export type DeclineReasonId = (typeof DECLINE_REASONS)[number]["id"];
export const DECLINE_REASON_IDS = DECLINE_REASONS.map((r) => r.id) as [DeclineReasonId, ...DeclineReasonId[]];

export function declineReasonText(id: DeclineReasonId): string {
  return DECLINE_REASONS.find((r) => r.id === id)?.text ?? DECLINE_REASONS[DECLINE_REASONS.length - 1]!.text;
}
