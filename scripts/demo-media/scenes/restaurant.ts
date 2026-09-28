import { P } from "../lib/color";
import { ON_TOP, type Scene, type V3 } from "../lib/persp";
import {
  beams,
  bokeh,
  candle,
  chair,
  lightShaft,
  paintingFill,
  pendant,
  picture,
  placeSetting,
  pottedPlant,
  room,
  table,
  vaseFlowersSvg,
  wallSconce,
  windowOn,
  wineGlassSvg,
  tumblerSvg,
  type Facing,
} from "../lib/props";
import { mulberry32, type Rand } from "../lib/rand";
import { finish, svgDoc } from "../lib/svg";
import { compose, eveningGrade, makeScene, type SpaceScenes } from "./common";

const WALL = "#efe5d3";
const FLOOR = "#b38b5d";
const BEAM = "#5a4330";
const CLOTH = "#f7f3ea";
const SEAT = "#7e3b3f";

/** A cloth-covered table with chairs, settings, flowers and optional candles. */
export function setTable(
  s: Scene,
  x: number,
  z: number,
  w: number,
  d: number,
  rand: Rand,
  opts: { candles?: boolean; flowers?: boolean; seat?: string; cloth?: string; wood?: string; back?: "upholstered" | "slats" | "solid" } = {},
): void {
  const h = 0.76;
  const seat = opts.seat ?? SEAT;
  const n = Math.max(1, Math.round(w / 0.75));
  const xs = Array.from({ length: n }, (_, i) => x - w / 2 + (i + 0.5) * (w / n));
  table(s, {
    x,
    z,
    w,
    d,
    cloth: opts.cloth ?? CLOTH,
    wood: opts.wood ?? P.woodDark,
    drop: 0.46,
    decor: () => {
      for (const cx of xs) {
        placeSetting(s, cx, h, z - d / 2 + 0.22, "+z" as Facing, rand);
        placeSetting(s, cx, h, z + d / 2 - 0.22, "-z" as Facing, rand);
      }
      if (opts.flowers !== false) s.sprite([x, h, z], vaseFlowersSvg(rand, 0.28, "#e3b9a4"), { layer: ON_TOP });
      if (opts.candles) {
        candle(s, [x - 0.22, h, z + 0.05], 0.16, 0.6, 0.45);
        candle(s, [x + 0.22, h, z - 0.05], 0.12, 0.6, 0.45);
      }
    },
  });
  for (const cx of xs) {
    chair(s, { x: cx, z: z - d / 2 - 0.22, facing: "+z", wood: opts.wood ?? P.woodDark, seat, back: opts.back ?? "upholstered" });
    chair(s, { x: cx, z: z + d / 2 + 0.22, facing: "-z", wood: opts.wood ?? P.woodDark, seat, back: opts.back ?? "upholstered" });
  }
}

/** Round banquet table with four chairs. */
function roundTable(s: Scene, x: number, z: number, r: number, rand: Rand, seat = SEAT): void {
  const h = 0.76;
  table(s, {
    x,
    z,
    w: r * 2,
    d: r * 2,
    round: true,
    cloth: CLOTH,
    drop: 0.55,
    decor: () => {
      placeSetting(s, x, h, z - r + 0.2, "+z", rand);
      placeSetting(s, x, h, z + r - 0.2, "-z", rand);
      placeSetting(s, x - r + 0.2, h, z, "+x", rand);
      placeSetting(s, x + r - 0.2, h, z, "-x", rand);
      s.sprite([x, h, z], vaseFlowersSvg(rand, 0.32, "#e3b9a4"), { layer: ON_TOP });
    },
  });
  const off = r + 0.24;
  chair(s, { x, z: z - off, facing: "+z", wood: P.woodDark, seat, back: "upholstered" });
  chair(s, { x, z: z + off, facing: "-z", wood: P.woodDark, seat, back: "upholstered" });
  chair(s, { x: x - off, z, facing: "+x", wood: P.woodDark, seat, back: "upholstered" });
  chair(s, { x: x + off, z, facing: "-x", wood: P.woodDark, seat, back: "upholstered" });
}

interface DiningOpts {
  mood: "day" | "dusk";
  rand: Rand;
}

const DINING = { x0: -4.3, x1: 4.3, z0: -1, z1: 13.5, h: 3.35 };

/** The main dining room shared by the hero and the evening view. */
function diningRoom(s: Scene, o: DiningOpts): void {
  const R = DINING;
  const { rand } = o;
  const evening = o.mood === "dusk";
  room(s, { ...R, wall: WALL, floor: FLOOR, floorKind: "planks", plank: 0.24, ceiling: "#efe6d6", wainscot: { h: 1.0, color: P.wood, panels: 1.2 }, skirting: P.woodDark, seed: rand });
  beams(s, R, BEAM, 1.8, [0.2, 0.24]);

  const sun: V3 = [0.9, -0.62, 0.28];
  for (const [u0, u1] of [
    [1.6, 3.2],
    [5.0, 6.6],
    [8.4, 10.0],
  ] as const) {
    const g = windowOn(s, { side: "left", plane: R.x0, u0, u1, v0: 1.0, v1: 2.65, cols: 2, rows: 3, mood: o.mood, wall: WALL, curtains: "#e6d7bd", view: "garden" }, Math.round(u0 * 10));
    if (!evening) lightShaft(s, g, sun, { alpha: 0.26, floorAlpha: 0.5, blur: 14 });
  }
  picture(s, "right", R.x1, 2.2, 3.6, 1.45, 2.35, paintingFill(s));
  picture(s, "right", R.x1, 6.0, 7.1, 1.45, 2.3, paintingFill(s, "#e3d6bb", "#b39868", "#7d6443"));
  picture(s, "right", R.x1, 9.4, 10.4, 1.45, 2.25, paintingFill(s, "#d5dbd3", "#93a07a", "#606d4a"));
  for (const z of [4.8, 8.4, 11.8]) wallSconce(s, [R.x1 - 0.06, 1.95, z]);

  // back wall: double door + sideboards
  s.box([-0.8, 0, R.z1 - 0.06], [0.8, 2.45, R.z1], { base: P.woodDark }, { layer: 0.45 });
  s.box([-0.72, 0, R.z1 - 0.08], [-0.03, 2.2, R.z1 - 0.06], { base: P.wood }, { layer: 0.46 });
  s.box([0.03, 0, R.z1 - 0.08], [0.72, 2.2, R.z1 - 0.06], { base: P.wood }, { layer: 0.46 });
  s.box([-2.9, 0, R.z1 - 0.5], [-1.5, 0.9, R.z1 - 0.02], { base: P.woodDark, top: P.wood });
  s.box([1.5, 0, R.z1 - 0.5], [2.9, 0.9, R.z1 - 0.02], { base: P.woodDark, top: P.wood });
  picture(s, "back", R.z1, -3.0, -1.4, 1.35, 2.35, paintingFill(s));
  picture(s, "back", R.z1, 1.4, 3.0, 1.35, 2.35, paintingFill(s, "#e2d7c0", "#a88a5f", "#6f5638"));
  pottedPlant(s, [-3.7, 0, R.z1 - 0.5], rand, { h: 1.7, w: 1.0, kind: "olive", pot: P.inkSoft, potR: 0.25 });
  pottedPlant(s, [3.7, 0, R.z1 - 0.5], rand, { h: 1.7, w: 1.0, kind: "olive", pot: P.inkSoft, potR: 0.25 });

  for (const z of [3.6, 6.6, 9.6]) {
    for (const x of [-2.25, 2.0]) {
      setTable(s, x, z, 1.6, 0.9, rand, { candles: evening });
      pendant(s, { x, z, y: 2.05, ceiling: R.h, shade: P.inkSoft, r: 0.24, hShade: 0.2, glowAlpha: evening ? 0.6 : 0.3, glowRadius: evening ? 1.6 : 1.0, pool: 0.77 });
    }
  }
}

// ---------------------------------------------------------------------------

function hero(): string {
  const rand = mulberry32(11);
  const s = makeScene({ pos: [0.2, 1.52, 0], yaw: -3, fov: 76, horizon: 0.47 }, { haze: "#f1e6d2", hazeNear: 3, hazeFar: 16, hazeMax: 0.26, light: [-0.6, 0.7, -0.2] });
  diningRoom(s, { mood: "day", rand });
  return compose(s, { background: WALL, vignette: 0.3, grain: 0.18, grade: "#f0c890", gradeOpacity: 0.14 });
}

/** Evening view from a corner, candles and pendants lit. */
function eveningCorner(): string {
  const rand = mulberry32(23);
  const s = makeScene({ pos: [3.5, 1.45, 0.4], yaw: -24, fov: 72, horizon: 0.5 }, { haze: "#3a2c22", hazeNear: 4, hazeFar: 18, hazeMax: 0.3, light: [0.3, 0.8, -0.5] });
  diningRoom(s, { mood: "dusk", rand });
  eveningGrade(s, 0.62);
  return compose(s, { background: "#2a211b", vignette: 0.45, grain: 0.2, grade: "#ffb870", gradeOpacity: 0.12 });
}

/** Close-up of a laid table by candle light, room out of focus behind. */
function tableDetail(): string {
  const rand = mulberry32(5);
  const cam = { pos: [0.05, 1.2, -0.3] as V3, pitch: 11, fov: 42, horizon: 0.5 };
  const fg = makeScene(cam, { light: [0.2, 0.9, -0.4], shadeDark: 0.2 });
  const bg = makeScene(cam, { haze: "#3a2c22", hazeNear: 3, hazeFar: 14, hazeMax: 0.35 }, fg.defs);

  // background room (blurred)
  const R = { x0: -4, x1: 4, z0: -1, z1: 11, h: 3.3 };
  room(bg, { ...R, wall: WALL, floor: FLOOR, floorKind: "planks", ceiling: "#efe6d6", wainscot: { h: 1.0, color: P.wood }, seed: rand });
  windowOn(bg, { side: "back", plane: R.z1, u0: -2.6, u1: -1.2, v0: 0.9, v1: 2.6, mood: "dusk", wall: WALL, cols: 2, rows: 3 });
  windowOn(bg, { side: "back", plane: R.z1, u0: 1.2, u1: 2.6, v0: 0.9, v1: 2.6, mood: "dusk", wall: WALL, cols: 2, rows: 3 });
  for (const [x, z] of [[-2.2, 4.2], [1.8, 4.6], [-1.2, 7.4], [2.4, 7.8]] as const) {
    setTable(bg, x, z, 1.4, 0.85, rand, { candles: true });
    pendant(bg, { x, z, y: 2.0, ceiling: R.h, shade: P.inkSoft, r: 0.24, glowAlpha: 0.7, glowRadius: 1.5 });
  }

  // foreground table (sharp)
  const T = { x: 0, z: 1.25, w: 1.5, d: 0.95 };
  const h = 0.76;
  table(fg, { ...T, cloth: "#f5efe3", drop: 0.5 });
  placeSetting(fg, -0.38, h, T.z + T.d / 2 - 0.24, "-z", rand);
  placeSetting(fg, 0.38, h, T.z + T.d / 2 - 0.24, "-z", rand);
  placeSetting(fg, -0.38, h, T.z - T.d / 2 + 0.22, "+z", rand);
  placeSetting(fg, 0.38, h, T.z - T.d / 2 + 0.22, "+z", rand);
  // napkins on the far plates
  for (const x of [-0.38, 0.38]) {
    fg.sprite([x, h + 0.01, T.z + T.d / 2 - 0.24], `<path d="M-0.07 0 L0 -0.09 L0.07 0Z" fill="#fffdf8"/><path d="M0 -0.09 L0.07 0 H0.02Z" fill="#e9e2d4"/>`, { layer: ON_TOP });
  }
  // centre piece
  fg.sprite([0, h, T.z + 0.04], vaseFlowersSvg(rand, 0.3, "#e0ac98"), { layer: ON_TOP });
  candle(fg, [-0.16, h, T.z - 0.02], 0.22, 0.28, 0.55);
  candle(fg, [0.17, h, T.z + 0.08], 0.17, 0.28, 0.55);
  fg.sprite([0.5, h, T.z - 0.02], wineGlassSvg(0.22, "#8e2a36"), { layer: ON_TOP });
  fg.sprite([-0.52, h, T.z + 0.06], tumblerSvg(0.11), { layer: ON_TOP });
  // bread basket
  fg.sprite([-0.1, h, T.z - 0.2], `<ellipse cx="0" cy="-0.02" rx="0.1" ry="0.035" fill="${P.woodLight}"/><ellipse cx="-0.03" cy="-0.05" rx="0.05" ry="0.028" fill="#d8a864"/><ellipse cx="0.04" cy="-0.045" rx="0.045" ry="0.025" fill="#c89150"/>`, { layer: ON_TOP });

  eveningGrade(fg, 0.42);
  bokeh(fg, rand, 12, [0, 40, 1600, 360], 10, 30, ["#ffcf85", "#ffd9a0", "#f7b867"], 0.28);

  const body =
    `<rect width="1600" height="1067" fill="#2a211b"/>` +
    `<g filter="${fg.defs.blur(7)}">${bg.render(-Infinity, 1.79)}</g>` +
    fg.render(-Infinity, 1.79) +
    fg.render(1.8, 1.8) +
    `<g filter="${fg.defs.blur(7)}">${bg.render(1.81, Infinity)}</g>` +
    fg.render(1.81, Infinity);
  return svgDoc(fg.defs, body + finish(fg.defs, { vignette: 0.5, grain: 0.2, grade: "#ffb870", gradeOpacity: 0.14 }));
}

/** Daylight view towards tall windows, round banquet tables. */
function windowSide(): string {
  const rand = mulberry32(31);
  const s = makeScene({ pos: [-0.6, 1.5, 0], yaw: 7, fov: 74, horizon: 0.48 }, { haze: "#f6eddc", hazeNear: 3, hazeFar: 14, hazeMax: 0.3, light: [0.2, 0.7, 0.7] });
  const R = { x0: -5, x1: 5, z0: -1, z1: 11, h: 3.5 };
  room(s, { ...R, wall: WALL, floor: FLOOR, floorKind: "planks", plank: 0.24, ceiling: "#f1e9da", wainscot: { h: 0.95, color: P.wood, panels: 1.1 }, skirting: P.woodDark, seed: rand });
  beams(s, R, BEAM, 2.0, [0.2, 0.24], "x");
  const sun: V3 = [0.25, -0.5, -0.85];
  for (const u0 of [-3.9, -1.0, 1.9]) {
    const g = windowOn(s, { side: "back", plane: R.z1, u0, u1: u0 + 1.9, v0: 0.55, v1: 2.95, cols: 3, rows: 4, mood: "day", wall: WALL, curtains: "#e8dcc5", view: "garden" }, Math.round(u0 * 10) + 50);
    lightShaft(s, g, sun, { alpha: 0.3, floorAlpha: 0.55, blur: 16 });
  }
  picture(s, "right", R.x1, 3.0, 4.6, 1.4, 2.4, paintingFill(s));
  picture(s, "left", R.x0, 4.0, 5.4, 1.4, 2.3, paintingFill(s, "#e3d6bb", "#b39868", "#7d6443"));
  for (const z of [2.2, 6.8]) wallSconce(s, [R.x0 + 0.06, 1.95, z]);
  pottedPlant(s, [4.3, 0, 9.8], rand, { h: 1.9, w: 1.1, kind: "olive", pot: P.inkSoft, potR: 0.28 });
  pottedPlant(s, [-4.4, 0, 9.9], rand, { h: 1.3, w: 0.9, kind: "fern", pot: P.terracotta, potR: 0.24 });
  for (const [x, z] of [[-2.4, 4.0], [1.6, 3.6], [-0.6, 7.3], [3.2, 7.0], [-3.6, 7.6]] as const) {
    roundTable(s, x, z, 0.75, rand);
    pendant(s, { x, z, y: 2.3, ceiling: R.h, shade: "#e9dfcb", inner: "#fff4dc", r: 0.3, hShade: 0.28, kind: "drum", glowAlpha: 0.2 });
  }
  return compose(s, { background: WALL, vignette: 0.28, grain: 0.18, grade: "#f0c890", gradeOpacity: 0.12 });
}

export const restaurant: SpaceScenes = {
  folder: "restaurant",
  label: "Restaurant",
  tour: true,
  shots: [
    { name: "hero", title: "Gastraum bei Tageslicht", render: hero },
    { name: "gallery-01", title: "Eingedeckter Tisch bei Kerzenlicht", render: tableDetail },
    { name: "gallery-02", title: "Abendstimmung", render: eveningCorner },
    { name: "gallery-03", title: "Fensterseite mit runden Tafeln", render: windowSide },
  ],
};
