import type { Space, SpaceId } from "./types";

type SelectableSpace = Pick<
  Space,
  "id" | "name" | "active" | "bookable" | "includedInFullVenue" | "requires" | "incompatibleWith" | "availableForStandaloneRental"
>;

/** All spaces that make up "Gesamte Location" – driven by `includedInFullVenue`, never "every entity". */
export function getFullVenueSpaceIds(spaces: readonly SelectableSpace[]): SpaceId[] {
  return spaces.filter((s) => s.active && s.bookable && s.includedInFullVenue).map((s) => s.id);
}

export function isFullVenueSelection(selected: readonly SpaceId[], spaces: readonly SelectableSpace[]): boolean {
  const full = getFullVenueSpaceIds(spaces);
  return full.length > 0 && full.every((id) => selected.includes(id));
}

/**
 * Parses a user-supplied list of space ids (e.g. from `?spaces=a,b,c`).
 * Unknown / inactive / non-bookable ids are dropped silently, duplicates removed.
 */
export function sanitizeSpaceIds(input: unknown, spaces: readonly SelectableSpace[]): SpaceId[] {
  const raw: string[] = Array.isArray(input)
    ? input.filter((v): v is string => typeof v === "string")
    : typeof input === "string"
      ? input.split(",")
      : [];
  const valid = new Set(spaces.filter((s) => s.active && s.bookable).map((s) => s.id));
  const out: SpaceId[] = [];
  for (const part of raw) {
    const id = part.trim().toLowerCase();
    if (id.length > 64 || !/^[a-z0-9-]+$/.test(id)) continue;
    if (valid.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

export type SelectionIssue =
  | { type: "requires"; spaceId: SpaceId; missing: SpaceId[] }
  | { type: "incompatible"; spaceId: SpaceId; conflictsWith: SpaceId[] }
  | { type: "not_standalone"; spaceId: SpaceId }
  | { type: "not_bookable"; spaceId: SpaceId }
  | { type: "empty" };

/**
 * Validates combination rules (requires / incompatibleWith / standalone).
 * No real dependencies are configured yet – the rules are prepared and only
 * take effect once the operator defines them.
 */
export function validateSelection(selected: readonly SpaceId[], spaces: readonly SelectableSpace[]): SelectionIssue[] {
  if (selected.length === 0) return [{ type: "empty" }];
  const byId = new Map(spaces.map((s) => [s.id, s]));
  const issues: SelectionIssue[] = [];
  for (const id of selected) {
    const space = byId.get(id);
    if (!space || !space.active || !space.bookable) {
      issues.push({ type: "not_bookable", spaceId: id });
      continue;
    }
    const missing = space.requires.filter((r) => !selected.includes(r));
    if (missing.length) issues.push({ type: "requires", spaceId: id, missing });
    const conflicts = space.incompatibleWith.filter((c) => selected.includes(c));
    if (conflicts.length) issues.push({ type: "incompatible", spaceId: id, conflictsWith: conflicts });
    if (selected.length === 1 && !space.availableForStandaloneRental) {
      issues.push({ type: "not_standalone", spaceId: id });
    }
  }
  return issues;
}

export function describeSelectionIssue(issue: SelectionIssue, nameOf: (id: SpaceId) => string): string {
  switch (issue.type) {
    case "empty":
      return "Bitte wählen Sie mindestens einen Bereich aus.";
    case "not_bookable":
      return `${nameOf(issue.spaceId)} ist derzeit nicht buchbar.`;
    case "requires":
      return `${nameOf(issue.spaceId)} ist nur zusammen mit ${issue.missing.map(nameOf).join(", ")} buchbar.`;
    case "incompatible":
      return `${nameOf(issue.spaceId)} kann nicht zusammen mit ${issue.conflictsWith.map(nameOf).join(", ")} gebucht werden.`;
    case "not_standalone":
      return `${nameOf(issue.spaceId)} ist nicht einzeln buchbar.`;
  }
}
