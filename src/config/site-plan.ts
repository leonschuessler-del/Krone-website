import type { Point } from "@/domain/types";

/**
 * ============================================================================
 *  SITE PLAN ARTWORK – base layer of the interactive map
 * ============================================================================
 *  Purely visual geometry (roofs, trees, paving, streets) used to render our
 *  own stylised bird's-eye illustration (`/map/base.svg`). It is NOT a copy of
 *  any satellite image. Same coordinate system as `floorplan.ts`
 *  (viewBox 0 0 1536 1024).
 *
 *  To replace the illustration with a licensed drone orthophoto later, set
 *  `baseLayer.src` in `src/config/map.ts` to the new image and adjust the
 *  polygons in `floorplan.ts` to match.
 * ============================================================================
 */

export type RoofKind = "gable" | "hip" | "flat" | "glass" | "solar" | "metal" | "pergola";

export interface RoofPart {
  id: string;
  kind: RoofKind;
  /** Footprint polygon. For gable/hip roofs use 4 corners in order TL, TR, BR, BL. */
  polygon: Point[];
  /** Palette key */
  tone: "terracotta" | "ember" | "brick" | "anthracite" | "slate" | "gravel" | "glass" | "solar" | "zinc" | "wood";
  /** Ridge direction for gable/hip: along edge TL→TR ("x") or TL→BL ("y"). */
  ridge?: "x" | "y";
  /** Neutral buildings are unlabeled context. */
  neutral?: boolean;
}

export interface TreeSpec {
  x: number;
  y: number;
  r: number;
}

export interface StreetSpec {
  id: string;
  /** Street name as shown on the owner's reference image – needs verification. */
  name: string;
  path: string;
  width: number;
  label?: { x: number; y: number; rotate: number };
}

export const streets: StreetSpec[] = [
  {
    id: "hauptstrasse",
    name: "Hauptstraße",
    path: "M -80 -52 C 160 10, 430 92, 760 158 S 1290 246, 1620 292",
    width: 116,
    label: { x: 760, y: 164, rotate: 11.5 },
  },
  {
    id: "kolpingstrasse",
    name: "Kolpingstraße",
    path: "M -80 790 C 150 830, 400 870, 800 946 S 1290 1016, 1620 1050",
    width: 100,
    label: { x: 790, y: 950, rotate: 10 },
  },
];

/** Muted neighbouring buildings (context only). */
export const neighbourBuildings: Point[][] = [
  [[488, -4], [606, -4], [598, 40], [482, 28]],
  [[640, -4], [838, -4], [826, 76], [644, 56]],
  [[950, -4], [1030, -4], [1024, 142], [952, 130]],
  [[1040, -4], [1122, -4], [1112, 152], [1034, 144]],
  [[1150, -4], [1300, -4], [1292, 128], [1146, 118]],
  [[1330, 20], [1470, 30], [1462, 150], [1326, 140]],
  [[-4, 146], [106, 160], [98, 396], [-4, 386]],
  [[-4, 420], [56, 426], [52, 560], [-4, 554]],
  [[1296, 372], [1420, 384], [1410, 520], [1292, 510]],
  [[1440, 380], [1540, 390], [1540, 540], [1436, 532]],
  [[1330, 800], [1540, 824], [1540, 968], [1332, 944]],
  [[280, 968], [520, 1000], [516, 1030], [276, 1030]],
  [[1320, 590], [1440, 600], [1432, 720], [1316, 712]],
];

export const neighbourTrees: TreeSpec[] = [
  { x: 40, y: 60, r: 34 }, { x: 110, y: 20, r: 26 }, { x: 420, y: 30, r: 22 },
  { x: 900, y: 40, r: 30 }, { x: 1250, y: 150, r: 24 }, { x: 1400, y: 250, r: 34 },
  { x: 1500, y: 700, r: 36 }, { x: 1460, y: 800, r: 28 }, { x: 30, y: 640, r: 30 },
  { x: 150, y: 880, r: 42 }, { x: 380, y: 1010, r: 36 }, { x: 640, y: 1010, r: 26 },
  { x: 1140, y: 1024, r: 30 }, { x: 1380, y: 470, r: 20 }, { x: 1300, y: 290, r: 22 },
];

/** Surfaces inside the property. */
export const surfaces = {
  gravelBeerGarden: [
    [160, 150], [252, 172], [404, 206], [376, 492], [334, 490], [328, 538],
    [262, 522], [170, 506], [122, 470], [130, 300],
  ] as Point[],
  patio: [
    [552, 410], [584, 441], [627, 437], [642, 480], [662, 456], [748, 470],
    [758, 552], [773, 566], [765, 622], [720, 700], [600, 720], [520, 690],
    [530, 560], [548, 558],
  ] as Point[],
  courtyardNorth: [[579, 194], [631, 215], [620, 318], [606, 300], [556, 302]] as Point[],
  asphalt: [
    [996, 344], [1062, 338], [1196, 350], [1226, 790], [1162, 800], [1164, 912],
    [860, 886], [560, 846], [548, 740], [700, 742], [770, 690], [900, 650],
    [994, 632], [998, 486],
  ] as Point[],
  pathWest: [[330, 540], [376, 494], [395, 500], [420, 548], [380, 552], [345, 600]] as Point[],
};

/** Parking stall rows: start point, direction vector per stall, stall count, stall depth vector. */
export interface StallRow {
  origin: Point;
  step: Point;
  depth: Point;
  count: number;
}

export const stallRows: StallRow[] = [
  { origin: [1024, 404], step: [0.5, 38], depth: [52, 0], count: 10 },
  { origin: [1204, 404], step: [1.3, 38], depth: [-54, 0], count: 10 },
  { origin: [612, 790], step: [42, 3.6], depth: [0, 50], count: 4 },
  { origin: [872, 840], step: [42, 3.6], depth: [0, -50], count: 7 },
];

export interface CarSpec {
  x: number;
  y: number;
  rotate: number;
  tone: "dark" | "light" | "graphite";
}

export const parkedCars: CarSpec[] = [
  { x: 1050, y: 604, rotate: 90, tone: "dark" },
  { x: 1048, y: 758, rotate: 90, tone: "light" },
  { x: 1176, y: 430, rotate: 90, tone: "graphite" },
  { x: 1180, y: 540, rotate: 90, tone: "dark" },
  { x: 1052, y: 720, rotate: 90, tone: "graphite" },
  { x: 650, y: 820, rotate: 3, tone: "light" },
  { x: 692, y: 823, rotate: 3, tone: "dark" },
  { x: 740, y: 828, rotate: 3, tone: "graphite" },
];

export const roofParts: RoofPart[] = [
  // --- Alte Wirtschaft (long west wing) ---------------------------------
  { id: "aw-glass", kind: "glass", tone: "glass", polygon: [[412, 186], [442, 180], [397, 500], [376, 494]] },
  { id: "aw-roof", kind: "gable", tone: "ember", ridge: "y", polygon: [[442, 180], [579, 194], [548, 558], [395, 500]] },
  { id: "aw-leanto", kind: "gable", tone: "brick", ridge: "x", polygon: [[334, 490], [396, 500], [430, 552], [336, 544]] },

  // --- Main building -------------------------------------------------------
  { id: "court-roof", kind: "flat", tone: "gravel", polygon: [[579, 194], [631, 215], [620, 318], [606, 300], [556, 302]] },
  { id: "kitchen-roof", kind: "flat", tone: "slate", polygon: [[631, 215], [716, 223], [697, 331], [620, 318]] },
  { id: "kitchen-annex", kind: "glass", tone: "glass", polygon: [[716, 223], [750, 230], [744, 300], [706, 302]] },
  { id: "rest-west", kind: "flat", tone: "brick", polygon: [[556, 302], [606, 300], [620, 318], [612, 330], [606, 440], [584, 441], [552, 410]] },
  { id: "rest-north", kind: "gable", tone: "terracotta", ridge: "x", polygon: [[704, 298], [806, 309], [872, 356], [698, 334]] },
  { id: "rest-main", kind: "hip", tone: "terracotta", ridge: "x", polygon: [[612, 322], [872, 354], [864, 474], [606, 440]] },
  { id: "rest-south-gable", kind: "gable", tone: "terracotta", ridge: "y", polygon: [[748, 462], [800, 470], [786, 548], [758, 552]] },
  { id: "rest-se", kind: "flat", tone: "brick", polygon: [[800, 470], [864, 474], [902, 512], [800, 498]] },
  { id: "rest-solar", kind: "solar", tone: "solar", polygon: [[770, 418], [858, 428], [852, 466], [764, 456]] },
  { id: "side-room-roof", kind: "hip", tone: "anthracite", ridge: "y", polygon: [[914, 358], [996, 380], [994, 484], [902, 512]] },
  { id: "stage-roof", kind: "flat", tone: "slate", polygon: [[934, 471], [994, 484], [990, 622], [905, 607], [914, 560]] },
  {
    id: "winter-garden-roof",
    kind: "glass",
    tone: "glass",
    polygon: [[800, 498], [902, 512], [914, 560], [905, 607], [898, 648], [765, 622], [773, 566], [786, 548]],
  },

  // --- Neutral outbuildings (unlabeled; purpose to be confirmed) -----------
  { id: "south-solar", kind: "solar", tone: "solar", neutral: true, polygon: [[380, 552], [526, 562], [520, 616], [378, 604]] },
  { id: "south-glass", kind: "glass", tone: "glass", neutral: true, polygon: [[530, 566], [610, 574], [598, 704], [522, 692]] },
  { id: "south-dark", kind: "gable", tone: "anthracite", ridge: "y", neutral: true, polygon: [[476, 614], [524, 620], [506, 704], [466, 698]] },
  { id: "south-flat", kind: "flat", tone: "gravel", neutral: true, polygon: [[610, 574], [706, 584], [694, 732], [598, 720]] },
  { id: "south-red", kind: "hip", tone: "terracotta", ridge: "y", neutral: true, polygon: [[664, 590], [712, 596], [706, 646], [658, 640]] },
  { id: "shed-metal", kind: "metal", tone: "zinc", neutral: true, polygon: [[346, 636], [456, 646], [448, 796], [338, 782]] },
  { id: "shed-red", kind: "hip", tone: "brick", ridge: "x", neutral: true, polygon: [[446, 758], [522, 766], [514, 840], [440, 832]] },
  { id: "pergola", kind: "pergola", tone: "wood", neutral: true, polygon: [[790, 784], [856, 790], [850, 882], [782, 874]] },
  { id: "hut-1", kind: "hip", tone: "brick", ridge: "x", neutral: true, polygon: [[114, 480], [166, 486], [160, 532], [108, 526]] },
  { id: "hut-2", kind: "gable", tone: "terracotta", ridge: "x", neutral: true, polygon: [[168, 536], [266, 548], [256, 626], [158, 612]] },
  { id: "court-kiosk", kind: "flat", tone: "slate", neutral: true, polygon: [[618, 460], [698, 470], [694, 496], [616, 488]] },
];

export const trees: TreeSpec[] = [
  // north edge / Hauptstraße
  { x: 186, y: 104, r: 30 }, { x: 250, y: 128, r: 26 }, { x: 318, y: 150, r: 30 }, { x: 386, y: 170, r: 24 },
  { x: 560, y: 176, r: 18 }, { x: 800, y: 262, r: 22 }, { x: 874, y: 290, r: 26 }, { x: 944, y: 318, r: 22 },
  { x: 1010, y: 312, r: 30 }, { x: 1078, y: 330, r: 22 }, { x: 1150, y: 338, r: 20 },
  // beer garden canopy (chestnut-like)
  { x: 206, y: 206, r: 30 }, { x: 300, y: 222, r: 34 }, { x: 362, y: 262, r: 24 }, { x: 214, y: 300, r: 30 },
  { x: 334, y: 336, r: 26 }, { x: 190, y: 420, r: 28 }, { x: 290, y: 436, r: 28 }, { x: 356, y: 452, r: 22 },
  { x: 226, y: 482, r: 22 }, { x: 150, y: 250, r: 22 },
  // west boundary
  { x: 110, y: 320, r: 26 }, { x: 98, y: 398, r: 24 }, { x: 96, y: 474, r: 20 }, { x: 128, y: 566, r: 28 },
  { x: 208, y: 652, r: 32 }, { x: 282, y: 680, r: 26 }, { x: 302, y: 606, r: 22 }, { x: 318, y: 700, r: 18 },
  // courtyard
  { x: 626, y: 512, r: 18 }, { x: 712, y: 540, r: 28 }, { x: 640, y: 664, r: 16 }, { x: 736, y: 648, r: 26 },
  { x: 704, y: 708, r: 18 }, { x: 772, y: 700, r: 22 }, { x: 822, y: 656, r: 28 }, { x: 862, y: 704, r: 24 },
  { x: 920, y: 660, r: 18 }, { x: 574, y: 626, r: 12 },
  // parking islands and east strip
  { x: 1044, y: 470, r: 18 }, { x: 1040, y: 556, r: 14 }, { x: 1238, y: 420, r: 20 }, { x: 1244, y: 500, r: 22 },
  { x: 1238, y: 600, r: 20 }, { x: 1250, y: 700, r: 24 }, { x: 1256, y: 820, r: 30 }, { x: 1232, y: 906, r: 30 },
  { x: 1196, y: 880, r: 22 },
  // south edge / Kolpingstraße
  { x: 598, y: 862, r: 20 }, { x: 874, y: 896, r: 16 }, { x: 1010, y: 912, r: 18 }, { x: 540, y: 820, r: 16 },
];

/** Beer garden furniture: long tables with benches (cx, cy, rotation). */
export const beerGardenTables: Array<{ x: number; y: number; rotate: number }> = [
  { x: 190, y: 180, rotate: 12 }, { x: 246, y: 250, rotate: 12 }, { x: 268, y: 290, rotate: 12 },
  { x: 180, y: 350, rotate: 12 }, { x: 234, y: 378, rotate: 12 }, { x: 290, y: 388, rotate: 12 },
  { x: 350, y: 398, rotate: 12 }, { x: 250, y: 468, rotate: 12 }, { x: 318, y: 488, rotate: 12 },
  { x: 160, y: 470, rotate: 12 }, { x: 370, y: 312, rotate: 12 }, { x: 200, y: 256, rotate: 12 },
];

export const parasols: Array<{ x: number; y: number; r: number }> = [{ x: 312, y: 316, r: 24 }];

export const patioTables: Array<{ x: number; y: number }> = [
  { x: 572, y: 480 }, { x: 600, y: 500 }, { x: 560, y: 520 }, { x: 596, y: 540 },
  { x: 660, y: 520 }, { x: 680, y: 560 }, { x: 640, y: 590 }, { x: 740, y: 600 },
  { x: 560, y: 740 }, { x: 740, y: 752 },
];
