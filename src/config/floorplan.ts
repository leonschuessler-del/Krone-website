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

export type MapFeatureType = "parking" | "street" | "entrance";

/** Non-rentable map features (not bookable, purely informative). */
export interface MapFeature {
  id: string;
  type: MapFeatureType;
  label: string;
  polygon: Point[];
  labelPosition: { x: number; y: number };
  rentable: false;
}

export const floorplanMeta = {
  viewBox: { width: 1536, height: 1024 } satisfies MapViewBox,
  isSchematic: true,
  isSurveyAccurate: false,
  source:
    "Schematisch nachgezeichnet nach der vom Eigentümer bereitgestellten Vogelperspektive mit markierten Bereichen (R, K, NZ, B, AW, WG, BG).",
  lastUpdated: "2026-09-28",
  /** Rotation of the building complex relative to north – for reference only. */
  approximateRotationDeg: -7,
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

export const spaceShapes: SpaceShape[] = [
  {
    spaceId: "restaurant",
    level: "ground-floor",
    polygon: [
      [556, 302], [606, 300], [620, 318], [697, 331], [706, 302], [790, 292],
      [806, 309], [860, 318], [872, 354], [914, 358], [902, 512], [800, 498],
      [786, 548], [758, 552], [748, 470], [662, 456], [642, 480], [627, 437],
      [584, 441], [552, 410],
    ],
    labelPosition: { x: 772, y: 400 },
  },
  {
    spaceId: "kitchen",
    level: "ground-floor",
    polygon: [[631, 215], [716, 223], [697, 331], [620, 318]],
    labelPosition: { x: 667, y: 270 },
  },
  {
    spaceId: "side-room",
    level: "ground-floor",
    polygon: [[914, 358], [996, 380], [994, 484], [934, 471], [902, 512]],
    labelPosition: { x: 953, y: 425 },
  },
  {
    spaceId: "stage",
    level: "ground-floor",
    polygon: [[934, 471], [994, 484], [990, 622], [905, 607], [914, 560]],
    labelPosition: { x: 954, y: 548 },
  },
  {
    spaceId: "old-tavern",
    level: "ground-floor",
    polygon: [[442, 180], [579, 194], [548, 558], [395, 500]],
    labelPosition: { x: 485, y: 372 },
  },
  {
    spaceId: "winter-garden",
    level: "ground-floor",
    polygon: [
      [800, 498], [902, 512], [914, 560], [905, 607], [898, 648], [765, 622],
      [773, 566], [786, 548],
    ],
    labelPosition: { x: 842, y: 575 },
  },
  {
    spaceId: "beer-garden",
    level: "outdoor",
    polygon: [
      [160, 150], [252, 172], [404, 206], [376, 492], [334, 490], [328, 538],
      [262, 522], [170, 506], [122, 470], [130, 300],
    ],
    labelPosition: { x: 262, y: 372 },
  },
  {
    // Hotel area is intentionally NOT drawn yet – the owner will supply the
    // exact outline. Until then the hotel appears in the legend as
    // "Abgrenzung folgt" and is not clickable on the map.
    spaceId: "hotel",
    level: "site",
    polygon: null,
    labelPosition: null,
  },
];

export const mapFeatures: MapFeature[] = [
  {
    id: "parking-east",
    type: "parking",
    label: "Parkplatz",
    rentable: false,
    polygon: [[1012, 382], [1198, 384], [1226, 790], [1016, 796]],
    labelPosition: { x: 1112, y: 600 },
  },
  {
    id: "parking-south",
    type: "parking",
    label: "Parkplatz",
    rentable: false,
    polygon: [[560, 760], [1012, 796], [1150, 806], [1150, 902], [560, 846]],
    labelPosition: { x: 960, y: 850 },
  },
];

/** Property boundary (Grundstücksgrenze) – schematic. */
export const propertyBoundary: Point[] = [
  [160, 64], [204, 78], [440, 166], [582, 190], [742, 214], [756, 246],
  [870, 270], [962, 298], [972, 336], [1062, 336], [1196, 348], [1228, 780],
  [1284, 948], [1238, 958], [860, 900], [560, 846], [432, 826], [408, 806],
  [334, 724], [250, 700], [72, 580],
];

export function getSpaceShape(spaceId: SpaceId): SpaceShape | undefined {
  return spaceShapes.find((s) => s.spaceId === spaceId);
}
