/**
 * Event types offered in the booking form. Configurable.
 * `allowed` is a placeholder – it is NOT confirmed that every type is
 * permitted in every space (needsVerification).
 */
export const eventTypes = [
  { id: "wedding", label: "Hochzeit" },
  { id: "birthday", label: "Geburtstag" },
  { id: "company", label: "Firmenfeier" },
  { id: "conference", label: "Tagung" },
  { id: "club", label: "Vereinsveranstaltung" },
  { id: "family", label: "Familienfeier" },
  { id: "seminar", label: "Seminar" },
  { id: "other", label: "Sonstiges" },
] as const;

export type EventTypeId = (typeof eventTypes)[number]["id"];

export function eventTypeLabel(id: string | null | undefined): string {
  return eventTypes.find((e) => e.id === id)?.label ?? "–";
}
