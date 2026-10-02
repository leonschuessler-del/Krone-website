/**
 * ESTIMATES – shown only where the operator has not entered real figures yet
 * (areaSqm / capacitySeated in the database win as soon as they are set).
 *
 * Area: footprint of each area as outlined on the drone photo (DJI FC3170,
 * 91 m above take-off, ≈3.1 cm per pixel at eaves height), outer dimensions
 * incl. walls, rounded to 10 m². The outlines are schematic → ±15 %.
 * Seats: rule of thumb for banquet seating, ≈1.5 m² per guest on ~85 % of the
 * area, rounded down to 10. Real numbers depend on the furniture layout.
 */
export interface SpaceEstimate {
  areaSqm: number;
  seats: number | null;
  /** Free text instead of seats (e.g. hotel rooms). */
  capacityNote?: string;
}

export const ESTIMATE_NOTE = "Richtwerte, geschätzt aus der Drohnenaufnahme – genaue Angaben folgen vom Betreiber.";

export const spaceEstimates: Record<string, SpaceEstimate> = {
  restaurant: { areaSqm: 160, seats: 90 },
  kitchen: { areaSqm: 130, seats: null, capacityNote: "Profiküche – keine Gästeplätze" },
  "side-room": { areaSqm: 80, seats: 40 },
  stage: { areaSqm: 50, seats: 20 },
  "old-tavern": { areaSqm: 70, seats: 40 },
  "winter-garden": { areaSqm: 50, seats: 20 },
  "beer-garden": { areaSqm: 100, seats: 50 },
  hotel: { areaSqm: 0, seats: null, capacityNote: "8 Doppel-, 2 Einzelzimmer, 1 Apartment" },
};

export interface DisplayFacts {
  area: string;
  seats: string;
  estimated: boolean;
}

/** Facts for display: real values first, otherwise the labelled estimate. */
export function displayFacts(space: { id: string; areaSqm: number | null; capacitySeated: number | null; capacityStanding?: number | null }): DisplayFacts {
  const est = spaceEstimates[space.id];
  let estimated = false;
  let area = "Angabe folgt";
  if (space.areaSqm !== null) area = `${space.areaSqm} m²`;
  else if (est && est.areaSqm > 0) {
    area = `ca. ${est.areaSqm} m²`;
    estimated = true;
  }
  let seats = "Angabe folgt";
  if (space.capacitySeated !== null) seats = `${space.capacitySeated} Sitzplätze`;
  else if (est?.capacityNote) seats = est.capacityNote;
  else if (est?.seats) {
    seats = `ca. ${est.seats} Sitzplätze`;
    estimated = true;
  }
  return { area, seats, estimated };
}
