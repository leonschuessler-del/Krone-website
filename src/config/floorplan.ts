import type { LevelId, Point, SpaceId } from "@/domain/types";

/**
 * ============================================================================
 *  FLOORPLAN / MAP GEOMETRY – interactive layer of the site map
 * ============================================================================
 *
 *  All coordinates use the map's viewBox (0 0 1536 1024), i.e. the same
 *  pixel grid as the bird's-eye reference image supplied by the owner.
 *  x grows to the right (east), y grows downwards (south). North is up.
 *
 *  ⚠ SCHEMATIC: the polygons were traced from a hand-marked reference image.
 *  They are NOT survey accurate. Replace them once the real floor plan is
 *  confirmed.
 *
 *  HOW TO MOVE A POLYGON POINT
 *  ---------------------------
 *  1. Find the space below (e.g. `id: "winter-garden"`).
 *  2. Each `[x, y]` pair is one corner, in drawing order (clockwise).
 *  3. Change the numbers – e.g. `[800, 498]` → `[790, 490]` moves that corner
 *     10 px left and 8 px up. Add a pair to add a corner, delete a pair to
 *     remove one. The shape closes automatically.
 *  4. `labelPosition` is where the code badge (e.g. "WG") is drawn.
 *  5. Save – the dev server reloads instantly. No other file needs changing.
 *
 *  Alternatively use the visual editor at /admin/karte (drag points, add or
 *  delete points, move labels). Changes made there are stored in the database
 *  as an override and can be exported back into this file ("Als Code
 *  exportieren").
 * ============================================================================
 */

export interface MapViewBox {
  width: number;
  height: number;
}

export interface SpaceShape {
  spaceId: SpaceId;
  level: LevelId;
  /** Polygon corners in viewBox coordinates. `null` = not drawn yet. */
  polygon: Point[] | null;
  labelPosition: { x: number; y: number } | null;
}

export type MapFeatureType = "parking" | "street" | "entrance" | "toilets";

/** Non-rentable map features (not bookable, purely informative). */
export interface MapFeature {
  id: string;
  type: MapFeatureType;
  label: string;
  /** Short text shown on the map / in tooltips. */
  note?: string;
  polygon: Point[];
  labelPosition: { x: number; y: number };
  rentable: false;
}

export const floorplanMeta = {
  viewBox: { width: 1536, height: 1024 } satisfies MapViewBox,
  isSchematic: false,
  isSurveyAccurate: false,
  source:
    "Echtes Drohnenfoto (senkrecht von oben, 30.09.2026, Datei dji_fly_20260930_151832). Raumgrenzen vom Eigentümer eingezeichnet und auf die Dachkanten übertragen.",
  lastUpdated: "2026-10-01",
  /** Rotation of the building complex relative to north – for reference only. */
  approximateRotationDeg: 0,
} as const;

export interface MapLevel {
  id: LevelId;
  label: string;
  shortLabel: string;
  /** Levels without shapes are hidden in the level switcher. */
  enabled: boolean;
}

/** Prepared for later: separate plans per level (EG / OG / Außen). */
export const mapLevels: MapLevel[] = [
  { id: "site", label: "Grundstück", shortLabel: "Alle", enabled: true },
  { id: "ground-floor", label: "Erdgeschoss", shortLabel: "EG", enabled: false },
  { id: "first-floor", label: "Obergeschoss", shortLabel: "OG", enabled: false },
  { id: "outdoor", label: "Außenbereich", shortLabel: "Außen", enabled: false },
];

/*
 * Coordinates: viewBox 1536×1024 over the cropped drone photo
 * (/media/floorplan/aerial-2048.webp). Layout as marked by the owner:
 * Alte Wirtschaft (top left) · Küche below · Hauptrestaurant with the entrance
 * wing · Nebenzimmer · Bühne (right end, slightly raised) · Toiletten below the
 * Bühne and next to the Wintergarten · Wintergarten (glass roof) · Biergarten.
 * The hotel occupies the upper floor over Küche → Bühne and is booked as a
 * whole via its own button (no outline on the ground-floor photo).
 */
export const spaceShapes: SpaceShape[] = [
  {
    spaceId: "restaurant",
    level: "ground-floor",
    polygon: [[575, 255], [697, 255], [697, 178], [805, 178], [805, 262], [833, 262], [833, 552], [575, 552]],
    labelPosition: { x: 704, y: 410 },
  },
  {
    spaceId: "kitchen",
    level: "ground-floor",
    polygon: [[348, 252], [575, 252], [575, 550], [352, 550]],
    labelPosition: { x: 462, y: 401 },
  },
  {
    spaceId: "side-room",
    level: "ground-floor",
    polygon: [[833, 262], [975, 265], [975, 556], [833, 556]],
    labelPosition: { x: 904, y: 410 },
  },
  {
    spaceId: "stage",
    level: "ground-floor",
    polygon: [[975, 268], [1052, 276], [1086, 556], [975, 556]],
    labelPosition: { x: 1024, y: 420 },
  },
  {
    spaceId: "old-tavern",
    level: "ground-floor",
    polygon: [[338, 78], [562, 78], [562, 248], [338, 248]],
    labelPosition: { x: 450, y: 163 },
  },
  {
    spaceId: "winter-garden",
    level: "ground-floor",
    polygon: [[806, 566], [948, 566], [948, 730], [806, 730]],
    labelPosition: { x: 877, y: 648 },
  },
  {
    spaceId: "beer-garden",
    level: "outdoor",
    polygon: [
      [806, 732], [948, 732], [951, 673], [1103, 677], [1084, 764], [1020, 764],
      [1017, 878], [867, 892], [837, 869], [783, 878], [735, 859], [742, 764],
    ],
    labelPosition: { x: 905, y: 812 },
  },
  {
    // Upper floor (10 Zimmer + Wohnung) – booked as a whole via the hotel button.
    spaceId: "hotel",
    level: "first-floor",
    polygon: null,
    labelPosition: null,
  },
];

export const mapFeatures: MapFeature[] = [
  {
    id: "toilets-main",
    type: "toilets",
    label: "Toilettenanlage",
    note: "Bei jeder Buchung automatisch inklusive",
    rentable: false,
    polygon: [[956, 560], [1090, 560], [1090, 665], [956, 665]],
    labelPosition: { x: 1023, y: 612 },
  },
  {
    id: "toilets-winter-garden",
    type: "toilets",
    label: "Toiletten",
    note: "Bei jeder Buchung automatisch inklusive",
    rentable: false,
    polygon: [[727, 558], [804, 558], [804, 684], [727, 684]],
    labelPosition: { x: 765, y: 621 },
  },
  {
    id: "entrance",
    type: "entrance",
    label: "Haupteingang",
    rentable: false,
    polygon: [[697, 178], [805, 178], [805, 200], [697, 200]],
    labelPosition: { x: 751, y: 150 },
  },
];

/** Legacy schematic boundary – only used by the old generated plan (/map/base.svg). */
export const propertyBoundary: Point[] = [
  [160, 64], [204, 78], [440, 166], [582, 190], [742, 214], [756, 246],
  [870, 270], [962, 298], [972, 336], [1062, 336], [1196, 348], [1228, 780],
  [1284, 948], [1238, 958], [860, 900], [560, 846], [432, 826], [408, 806],
  [334, 724], [250, 700], [72, 580],
];

export function getSpaceShape(spaceId: SpaceId): SpaceShape | undefined {
  return spaceShapes.find((s) => s.spaceId === spaceId);
}
