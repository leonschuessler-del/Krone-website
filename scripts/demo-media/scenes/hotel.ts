import { darken, lighten, P } from "../lib/color";
import { lookAt, ON_FLAT, ON_TOP, type Scene, type V3 } from "../lib/persp";
import { armchair, beams, chair, floorShadow, lightShaft, paintingFill, picture, pottedPlant, room, table, vaseFlowersSvg, wallGrid, windowOn } from "../lib/props";
import { mulberry32, type Rand } from "../lib/rand";
import { ellipseGlow, glow } from "../lib/svg";
import { compose, makeScene, type SpaceScenes } from "./common";

const WALL = "#efe7d6";
const OAK = "#a98158";
const FLOOR = "#b8946a";
const LINEN = "#f6f1e6";
const SAGE = "#8a9670";
const MOSS = "#5f6c4c";
const R = { x0: -2.3, x1: 2.3, z0: -2.0, z1: 4.8, h: 2.75 };

function bedsideLamp(s: Scene, x: number, y: number, z: number, lit = true): void {
  s.group([x, y + 0.25, z], () => {
    s.cyl([x, y, z], 0.07, 0.05, 0.22, { side: "#d8cbb3", top: "#e6dccb" });
    s.rod([x, y + 0.22, z], [x, y + 0.3, z], P.goldDark, 0.012);
    s.cyl([x, y + 0.3, z], 0.15, 0.11, 0.2, { side: "#f3ead6", bottom: "#fff4dc", top: "#fff8ea" });
  }, ON_TOP);
  if (!lit) return;
  const c = s.cam.project([x, y + 0.4, z]);
  if (c) {
    const sc = s.cam.scaleAt([x, y, z]);
    s.raw(glow(s.defs, c[0], c[1], 0.9 * sc, "#ffd79a", 0.45), 2.2);
    s.raw(ellipseGlow(s.defs, c[0], c[1], 0.16 * sc, 0.1 * sc, "#fff6e2", 0.8), 2.3);
  }
}

function bed(s: Scene, rand: Rand): void {
  const x0 = -0.95;
  const x1 = 0.95;
  const zHead = R.z1 - 0.05;
  const zFoot = zHead - 2.15;
  floorShadow(s, x0 - 0.1, zFoot - 0.1, x1 + 0.15, zHead, 0.3, 8);
  s.group([0, 0.35, (zFoot + zHead) / 2], () => {
    s.box([x0, 0.08, zFoot], [x1, 0.34, zHead], { base: OAK });
    for (const [lx, lz] of [[x0 + 0.05, zFoot + 0.05], [x1 - 0.1, zFoot + 0.05]] as const) s.box([lx, 0, lz], [lx + 0.05, 0.08, lz + 0.05], darken(OAK, 0.2));
    s.box([x0 + 0.03, 0.34, zFoot + 0.03], [x1 - 0.03, 0.56, zHead - 0.02], { base: "#efe9dc" });
    // duvet
    s.box([x0 - 0.04, 0.3, zFoot - 0.02], [x1 + 0.04, 0.64, zHead - 0.62], { base: LINEN, top: "#fbf8f1" });
    s.box([x0 - 0.035, 0.6, zHead - 0.68], [x1 + 0.035, 0.66, zHead - 0.55], { base: "#fbf8f1" });
    // throw at the foot
    s.box([x0 - 0.06, 0.28, zFoot - 0.04], [x1 + 0.06, 0.665, zFoot + 0.38], { base: SAGE, top: lighten(SAGE, 0.1) });
    // pillows
    s.box([x0 + 0.08, 0.56, zHead - 0.45], [-0.03, 0.8, zHead - 0.12], { base: "#fbf8f1" });
    s.box([0.03, 0.56, zHead - 0.45], [x1 - 0.08, 0.8, zHead - 0.12], { base: "#fbf8f1" });
    s.box([-0.55, 0.62, zHead - 0.62], [-0.08, 0.86, zHead - 0.45], { base: SAGE });
    s.box([0.08, 0.62, zHead - 0.62], [0.55, 0.86, zHead - 0.45], { base: "#d8bb7e" });
  });
  // duvet fold lines
  for (let k = 0; k < 4; k++) {
    const z = zFoot + 0.7 + k * 0.28 + rand() * 0.1;
    s.line([x0 - 0.04, 0.645, z], [x1 + 0.04, 0.645, z + 0.05], "#e6ddcc", 1.2, { layer: 1.3, opacity: 0.7 });
  }
}

function headboardWall(s: Scene): void {
  // vertical oak boards behind the bed
  const z = R.z1 - 0.01;
  s.poly([[-1.6, 0, z], [1.6, 0, z], [1.6, 1.35, z], [-1.6, 1.35, z]], OAK, { layer: 0.3 });
  for (let x = -1.6 + 0.16; x < 1.6; x += 0.16) s.line([x, 0.02, z - 0.001], [x, 1.33, z - 0.001], darken(OAK, 0.18), 1, { layer: 0.31 });
  s.box([-1.65, 1.35, z - 0.06], [1.65, 1.4, z], { base: darken(OAK, 0.1), top: OAK }, { layer: 0.32 });
}

function hotelRoom(s: Scene, rand: Rand, sun = true): void {
  room(s, { ...R, wall: WALL, floor: FLOOR, floorKind: "planks", plank: 0.2, ceiling: "#f4eee2", skirting: "#d9ccb4", seed: rand });
  beams(s, R, "#8a6a45", 1.6, [0.16, 0.18], "x");
  headboardWall(s);
  const g = windowOn(s, { side: "left", plane: R.x0, u0: 1.2, u1: 2.6, v0: 0.8, v1: 2.2, cols: 2, rows: 2, mood: "day", view: "hills", wall: WALL, curtains: "#d9ccb0" }, 17);
  if (sun) lightShaft(s, g, [0.85, -0.55, 0.3], { alpha: 0.26, floorAlpha: 0.55, blur: 14 });
  // rug
  s.poly([[-1.5, 0.004, 1.9], [1.5, 0.004, 1.9], [1.5, 0.004, 4.4], [-1.5, 0.004, 4.4]], "#e3d7bf", { layer: 0.5, stroke: "#cdbf9f", strokeWidth: 2 });
  bed(s, rand);
  for (const x of [-1.3, 1.3]) {
    s.group([x, 0.28, R.z1 - 0.3], () => {
      s.box([x - 0.24, 0, R.z1 - 0.5], [x + 0.24, 0.55, R.z1 - 0.06], { base: OAK, top: lighten(OAK, 0.08) });
      s.line([x - 0.2, 0.3, R.z1 - 0.502], [x + 0.2, 0.3, R.z1 - 0.502], darken(OAK, 0.25), 1);
    });
    bedsideLamp(s, x, 0.55, R.z1 - 0.3);
  }
  picture(s, "back", R.z1, -0.8, 0.8, 1.6, 2.3, paintingFill(s, "#dfe3d6", "#9aa77c", "#667350"), P.goldDark);
  // wardrobe on the right
  s.group([R.x1 - 0.3, 1.1, 0.6], () => {
    s.box([R.x1 - 0.62, 0, -0.3], [R.x1, 2.2, 1.5], { base: OAK, top: lighten(OAK, 0.05) });
    s.line([R.x1 - 0.625, 0.1, 0.6], [R.x1 - 0.625, 2.1, 0.6], darken(OAK, 0.3), 1.2);
    for (const z of [0.5, 0.7]) s.line([R.x1 - 0.63, 1.0, z], [R.x1 - 0.63, 1.3, z], P.goldDark, 2);
  });
  armchair(s, -1.6, 0.9, "+x", SAGE, OAK, 0.75);
  pottedPlant(s, [-1.95, 0, 3.2], rand, { kind: "fern", h: 0.9, w: 0.7, pot: "#d8cbb3", potR: 0.18, potH: 0.32 });
}

// ---------------------------------------------------------------------------

function hero(): string {
  const rand = mulberry32(151);
  const s = makeScene({ pos: [0.35, 1.5, -1.7], yaw: -4, fov: 72, horizon: 0.5 }, { haze: "#f3ecdd", hazeNear: 3, hazeFar: 10, hazeMax: 0.15, light: [-0.7, 0.6, -0.2] });
  hotelRoom(s, rand);
  return compose(s, { background: WALL, vignette: 0.28, grain: 0.16, grade: "#f0c890", gradeOpacity: 0.14 });
}

/** Bathroom: stone tiles, oak vanity, round mirror, freestanding tub. */
function bathroom(): string {
  const rand = mulberry32(153);
  const STONE = "#ddd4c5";
  const s = makeScene({ pos: [0.2, 1.5, -0.6], yaw: 4, fov: 70, horizon: 0.5 }, { haze: "#f3ecdd", hazeNear: 2, hazeFar: 8, hazeMax: 0.12, light: [0.6, 0.6, -0.4] });
  const B = { x0: -1.8, x1: 1.9, z0: -1, z1: 3.2, h: 2.6 };
  room(s, { ...B, wall: STONE, floor: "#c9bfae", floorKind: "stone", tile: 0.6, ceiling: "#f4eee2", seed: rand });
  wallGrid(s, "back", B.z1, B.x0, B.x1, 0, 2.4, 0.6, 0.3, darken(STONE, 0.08), 0.8, 0.8, true);
  wallGrid(s, "left", B.x0, 0, B.z1, 0, 2.4, 0.6, 0.3, darken(STONE, 0.08), 0.8, 0.8, true);
  wallGrid(s, "right", B.x1, 0, B.z1, 0, 2.4, 0.6, 0.3, darken(STONE, 0.08), 0.8, 0.8, true);
  const g = windowOn(s, { side: "right", plane: B.x1, u0: 1.6, u1: 2.7, v0: 1.0, v1: 2.2, cols: 1, rows: 2, mood: "day", view: "hills", wall: STONE, sill: "#efe8dc" }, 19);
  lightShaft(s, g, [-0.85, -0.55, -0.2], { alpha: 0.24, floorAlpha: 0.5, blur: 14 });
  // vanity with vessel basin
  s.group([-0.9, 0.45, B.z1 - 0.3], () => {
    s.box([-1.6, 0.2, B.z1 - 0.55], [-0.2, 0.85, B.z1 - 0.02], { base: OAK, top: lighten(OAK, 0.1) });
    s.line([-0.9, 0.24, B.z1 - 0.552], [-0.9, 0.82, B.z1 - 0.552], darken(OAK, 0.3), 1.2);
    s.cyl([-0.9, 0.85, B.z1 - 0.28], 0.14, 0.22, 0.14, { side: "#fbfaf6", top: "#e9e6de", oval: 0.75 }, { layer: ON_TOP });
    s.rod([-0.9, 1.05, B.z1 - 0.03], [-0.9, 1.05, B.z1 - 0.2], "#3b3633", 0.025, { layer: ON_TOP + 0.01 });
    s.box([-1.5, 0.85, B.z1 - 0.45], [-1.25, 0.95, B.z1 - 0.15], { base: "#f4efe4" }, { layer: ON_TOP });
    s.box([-1.5, 0.95, B.z1 - 0.45], [-1.25, 1.03, B.z1 - 0.15], { base: SAGE }, { layer: ON_TOP + 0.001 });
    s.sprite([-0.45, 0.85, B.z1 - 0.2], vaseFlowersSvg(rand, 0.2, "#efe2c4"), { layer: ON_TOP });
  });
  // round mirror
  s.planar([-0.9, 1.7, B.z1 - 0.015], [1, 0, 0], [0, 1, 0], `<circle cx="0" cy="0" r="0.4" fill="${P.goldDark}"/><circle cx="0" cy="0" r="0.37" fill="${s.defs.linear([[0, "#eef0ec"], [1, "#c9cfcb"]], 0, 0, 1, 1)}"/><path d="M-0.2 -0.22 L0.05 -0.3" stroke="#ffffff" stroke-width="0.02" opacity="0.7"/>`, { layer: 0.5 });
  // wall lights beside the mirror
  for (const x of [-1.45, -0.35]) {
    s.planar([x, 1.75, B.z1 - 0.02], [1, 0, 0], [0, 1, 0], `<rect x="-0.04" y="-0.12" width="0.08" height="0.24" rx="0.03" fill="#fff4dc"/>`, { layer: 0.5 });
    const c = s.cam.project([x, 1.75, B.z1 - 0.02]);
    if (c) s.raw(ellipseGlow(s.defs, c[0], c[1], 60, 110, "#ffd79a", 0.4), 2.2);
  }
  // freestanding tub under the window
  floorShadow(s, 0.3, 1.2, 1.8, 2.9, 0.25, 8);
  s.group([1.1, 0.3, 2.05], () => {
    s.cyl([1.1, 0, 2.05], 0.6, 0.72, 0.58, { side: "#fbfaf6", top: "#efece5", oval: 1.25 });
    s.cyl([1.1, 0.5, 2.05], 0.6, 0.6, 0.08, { side: "#fbfaf6", top: "#d9e4e6", oval: 1.2 }, { layer: ON_TOP });
  });
  s.rod([1.75, 0, 2.9], [1.75, 1.05, 2.9], "#3b3633", 0.03);
  s.rod([1.75, 1.05, 2.9], [1.55, 1.05, 2.9], "#3b3633", 0.025);
  // towel ladder
  s.rod([-1.7, 0, 0.8], [-1.7, 1.6, 1.0], OAK, 0.04, { layer: 0.8 });
  s.rod([-1.7, 0, 1.4], [-1.7, 1.6, 1.6], OAK, 0.04, { layer: 0.8 });
  s.poly([[-1.66, 0.7, 0.9], [-1.66, 0.7, 1.5], [-1.66, 1.3, 1.55], [-1.66, 1.3, 0.95]], "#f6f1e6", { layer: 0.81 });
  pottedPlant(s, [1.55, 0, 0.3], rand, { kind: "long", h: 1.1, w: 0.7, pot: "#efe8dc", potR: 0.2, potH: 0.36 });
  return compose(s, { background: STONE, vignette: 0.26, grain: 0.14, grade: "#f0d8a8", gradeOpacity: 0.12 });
}

/** Breakfast tray on the bed. */
function breakfast(): string {
  const rand = mulberry32(157);
  const s = makeScene(lookAt([0.05, 0.66, 3.55], 1.2, 38, -8, 46, { horizon: 0.55 }), { light: [-0.6, 0.7, -0.2], shadeDark: 0.2 });
  hotelRoom(s, rand, false);
  const y = 0.665;
  // tray
  const T = { x0: -0.33, x1: 0.33, z0: 3.32, z1: 3.77 };
  s.box([T.x0, y, T.z0], [T.x1, y + 0.02, T.z1], { base: OAK, top: lighten(OAK, 0.12) }, { layer: 1.4 });
  for (const [a, b] of [[[T.x0, T.z0], [T.x1, T.z0 + 0.03]], [[T.x0, T.z1 - 0.03], [T.x1, T.z1]], [[T.x0, T.z0], [T.x0 + 0.03, T.z1]], [[T.x1 - 0.03, T.z0], [T.x1, T.z1]]] as Array<[[number, number], [number, number]]>) {
    s.box([a[0], y + 0.02, a[1]], [b[0], y + 0.06, b[1]], { base: OAK, top: lighten(OAK, 0.05) }, { layer: 1.41 });
  }
  const t = y + 0.02;
  s.disc([-0.14, t + 0.002, 3.6], 0.09, "#fbfaf6", { layer: 1.42 });
  s.sprite([-0.14, t + 0.004, 3.6], `<path d="M-0.045 -0.06 H0.045 L0.038 0 H-0.038Z" fill="#fbfaf6"/><ellipse cx="0" cy="-0.06" rx="0.045" ry="0.012" fill="#6b4630"/><path d="M0.045 -0.048 Q 0.07 -0.038 0.04 -0.016" stroke="#fbfaf6" stroke-width="0.01" fill="none"/>`, { layer: 1.45 });
  s.disc([0.12, t + 0.002, 3.52], 0.1, "#fbfaf6", { layer: 1.42 });
  s.sprite([0.12, t + 0.004, 3.52], `<path d="M-0.08 -0.005 C -0.07 -0.05, -0.02 -0.065, 0 -0.065 C 0.02 -0.065, 0.07 -0.05, 0.08 -0.005 C 0.05 -0.02, 0.02 -0.025, 0 -0.025 C -0.02 -0.025, -0.05 -0.02, -0.08 -0.005Z" fill="#d49a4a"/><path d="M-0.04 -0.05 L-0.03 -0.02 M0 -0.062 V-0.028 M0.04 -0.05 L0.03 -0.02" stroke="#b77a33" stroke-width="0.006"/>`, { layer: 1.46 });
  s.sprite([0.22, t, 3.7], `<path d="M-0.03 -0.12 L-0.025 0 H0.025 L0.03 -0.12Z" fill="#f0a23a" fill-opacity="0.9" stroke="#ffffff" stroke-opacity="0.7" stroke-width="0.003"/>`, { layer: 1.47 });
  s.sprite([0.0, t, 3.72], `<rect x="-0.025" y="-0.06" width="0.05" height="0.06" rx="0.008" fill="#8e2a36" opacity="0.9"/><rect x="-0.027" y="-0.075" width="0.054" height="0.016" rx="0.004" fill="#efe2c4"/>`, { layer: 1.47 });
  s.sprite([-0.26, t, 3.72], vaseFlowersSvg(rand, 0.14, "#e3b9a4"), { layer: 1.47 });
  s.planar([-0.05, t + 0.001, 3.42], [1, 0, 0], [0, 0, 1], `<rect x="-0.06" y="-0.03" width="0.12" height="0.06" fill="#f6f1e6" stroke="#e3dccd" stroke-width="0.002"/><path d="M-0.04 -0.01 H0.04" stroke="${P.gold}" stroke-width="0.004"/>`, { layer: 1.43 });
  s.raw(`<rect width="1600" height="1067" fill="${s.defs.linear([[0, "#fff4d8", 0.4], [0.6, "#fff4d8", 0]], 0, 0, 1, 0.3)}" style="mix-blend-mode:screen"/>`, 2.1);
  return compose(s, { background: WALL, vignette: 0.3, grain: 0.16, grade: "#f0c890", gradeOpacity: 0.14 });
}

/** Desk by the window with a view of the green hills. */
function windowDesk(): string {
  const rand = mulberry32(159);
  const s = makeScene({ pos: [1.3, 1.45, 0.9], yaw: -104, fov: 66, horizon: 0.5 }, { haze: "#f3ecdd", hazeNear: 3, hazeFar: 10, hazeMax: 0.12, light: [-0.7, 0.6, -0.2] });
  hotelRoom(s, rand);
  const g = windowOn(s, { side: "left", plane: R.x0, u0: -1.2, u1: 0.2, v0: 0.9, v1: 2.2, cols: 2, rows: 2, mood: "day", view: "hills", wall: WALL, curtains: "#d9ccb0" }, 23);
  lightShaft(s, g, [0.85, -0.55, 0.3], { alpha: 0.26, floorAlpha: 0.5, blur: 14 });
  table(s, {
    x: -1.95,
    z: -0.5,
    w: 0.6,
    d: 1.3,
    wood: OAK,
    decor: () => {
      s.planar([-1.9, 0.762, -0.6], [0, 0, 1], [1, 0, 0], `<rect x="-0.12" y="-0.08" width="0.24" height="0.16" fill="#f6f1e6"/><path d="M-0.09 -0.04 H0.08 M-0.09 0 H0.06 M-0.09 0.04 H0.07" stroke="#c9bfae" stroke-width="0.006"/>`, { layer: ON_FLAT });
      s.sprite([-1.85, 0.76, -0.15], `<path d="M-0.035 -0.07 H0.035 L0.03 0 H-0.03Z" fill="#fbfaf6"/><ellipse cx="0" cy="-0.07" rx="0.035" ry="0.01" fill="#6b4630"/>`, { layer: ON_TOP });
      s.group([-2.05, 1.0, -1.0], () => {
        s.cyl([-2.05, 0.76, -1.0], 0.07, 0.05, 0.3, { side: "#d8cbb3" });
        s.cyl([-2.05, 1.06, -1.0], 0.15, 0.1, 0.18, { side: "#f3ead6", bottom: "#fff4dc" });
      }, ON_TOP);
      s.sprite([-2.1, 0.76, 0.0], vaseFlowersSvg(rand, 0.22, "#e3b9a4"), { layer: ON_TOP });
    },
  });
  chair(s, { x: -1.35, z: -0.5, facing: "-x", wood: OAK, seat: SAGE, back: "upholstered" });
  return compose(s, { background: WALL, vignette: 0.28, grain: 0.16, grade: "#f0c890", gradeOpacity: 0.14 });
}

export const hotel: SpaceScenes = {
  folder: "hotel",
  label: "Hotel",
  tour: true,
  shots: [
    { name: "hero", title: "Gemütliches Landhotel-Zimmer", render: hero },
    { name: "gallery-01", title: "Bad mit freistehender Wanne", render: bathroom },
    { name: "gallery-02", title: "Frühstück im Bett", render: breakfast },
    { name: "gallery-03", title: "Schreibtisch am Fenster", render: windowDesk },
  ],
};
