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
 * Coordinates: viewBox 1536×1024 over the drone photo of the whole plot incl.
 * courtyard and parking (/media/floorplan/aerial-2048.webp; neighbouring
 * buildings are muted in the image so the Krone stands out). Layout as marked by the owner:
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
    polygon: [[667, 230], [760, 230], [760, 171], [842, 171], [842, 235], [863, 235], [863, 455], [667, 455]],
    labelPosition: { x: 765, y: 347 },
  },
  {
    spaceId: "kitchen",
    level: "ground-floor",
    polygon: [[495, 227], [667, 227], [667, 453], [498, 453]],
    labelPosition: { x: 581, y: 340 },
  },
  {
    spaceId: "side-room",
    level: "ground-floor",
    polygon: [[863, 235], [971, 237], [971, 458], [863, 458]],
    labelPosition: { x: 917, y: 300 },
  },
  {
    spaceId: "stage",
    level: "ground-floor",
    polygon: [[971, 239], [1029, 245], [1055, 458], [971, 458]],
    labelPosition: { x: 1010, y: 405 },
  },
  {
    spaceId: "old-tavern",
    level: "ground-floor",
    polygon: [[487, 95], [657, 95], [657, 224], [487, 224]],
    labelPosition: { x: 572, y: 160 },
  },
  {
    spaceId: "winter-garden",
    level: "ground-floor",
    polygon: [[842, 465], [950, 465], [950, 590], [842, 590]],
    labelPosition: { x: 896, y: 528 },
  },
  {
    spaceId: "beer-garden",
    level: "outdoor",
    polygon: [[842, 591], [950, 591], [952, 547], [1068, 550], [1053, 616], [1005, 616], [1002, 702], [889, 713], [866, 695], [825, 702], [788, 688], [794, 616]],
    labelPosition: { x: 918, y: 652 },
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
    polygon: [[956, 461], [1058, 461], [1058, 540], [956, 540]],
    labelPosition: { x: 1007, y: 500 },
  },
  {
    id: "toilets-winter-garden",
    type: "toilets",
    label: "Toiletten",
    note: "Bei jeder Buchung automatisch inklusive",
    rentable: false,
    polygon: [[782, 459], [841, 459], [841, 555], [782, 555]],
    labelPosition: { x: 811, y: 507 },
  },
  {
    id: "entrance",
    type: "entrance",
    label: "Haupteingang",
    rentable: false,
    polygon: [[760, 171], [842, 171], [842, 188], [760, 188]],
    labelPosition: { x: 801, y: 150 },
  },
  {
    id: "parking",
    type: "parking",
    label: "Parkplatz",
    note: "Hofeinfahrt (Schotter) und Stellplätze im Hof – am Haus ausgeschildert: „Parkplätze im Hof“",
    rentable: false,
    polygon: [[1051, 238], [1121, 259], [1171, 481], [1227, 699], [1316, 695], [1329, 811], [1347, 937], [1193, 951], [919, 975], [916, 895], [994, 895], [996, 807], [1059, 786], [1057, 701], [1110, 694], [1065, 580], [1057, 318]],
    labelPosition: { x: 1150, y: 860 },
  },
];

/**
 * The plot of the Krone as outlined by the owner on the drone photo (F054):
 * building, courtyard, beer garden, driveway and parking. Shown in colour on
 * the map; everything outside is muted in the base image.
 */
export const plotOutline: Point[] = [[462, 138], [503, 129], [681, 115], [789, 105], [949, 185], [1122, 259], [1171, 481], [1228, 699], [1317, 695], [1330, 812], [1348, 939], [994, 972], [640, 1028], [623, 825], [599, 625], [468, 617], [470, 368]];

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
