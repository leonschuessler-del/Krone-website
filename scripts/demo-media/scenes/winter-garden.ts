import { darken, lighten, P } from "../lib/color";
import { boxwoodSvg, house, wallLantern } from "../lib/architecture";
import { lookAt, ON_TOP, type Scene, type V3 } from "../lib/persp";
import { armchair, candle, chair, floorShadow, placeSetting, pottedPlant, room, stringLights, table, treeSvg, vaseFlowersSvg } from "../lib/props";
import { mulberry32, type Rand } from "../lib/rand";
import { f1, glow, pts } from "../lib/svg";
import { compose, eveningGrade, makeScene, type SpaceScenes } from "./common";

const STEEL = "#343837";
const PARAPET = "#e6dac5";
const FLOOR = "#e2d6c2";
const CLOTH = "#f6f1e6";
const RATTAN = "#c9a878";
const G = { x0: -4.3, x1: 4.3, z0: -1.5, z1: 11, eave: 2.95, ridge: 4.4, par: 0.55 };

type Mood = "day" | "dusk";

function skyAndGarden(s: Scene, mood: Mood, rand: Rand): string {
  const sky =
    mood === "day"
      ? s.defs.linear([[0, "#c9d8d9"], [0.6, "#e8ece2"], [1, "#f6efdf"]])
      : s.defs.linear([[0, "#26324a"], [0.45, "#4a5572"], [0.8, "#9a8290"], [1, "#d9a070"]]);
  const grass = mood === "day" ? "#9fae7c" : "#3b4535";
  s.poly([[-120, -0.01, s.cam.pos[2] + 0.5], [120, -0.01, s.cam.pos[2] + 0.5], [120, -0.01, 200], [-120, -0.01, 200]], s.defs.linear([[0, mood === "day" ? "#c3c9a6" : "#4a4c5c"], [0.35, grass], [1, darken(grass, 0.12)]]), { layer: -1 });
  const colors = mood === "day" ? ["#4f6b3b", "#5f7a47", "#3f5530", "#6d8752"] : ["#232c1e", "#2a3422", "#1d2519", "#303b28"];
  for (const [x, z, h] of [[-12, 30, 8], [-5, 38, 10], [4, 42, 11], [11, 32, 9], [18, 22, 8], [-18, 18, 9], [20, 40, 10], [-1, 50, 11]] as const) {
    s.sprite([x, 0, z], treeSvg(rand, h, h * 0.8, { colors, light: mood === "day" ? "#8fa46c" : "#35402c", trunk: mood === "day" ? "#4a3a2c" : "#1c1814" }), { layer: -0.8 });
  }
  return `<rect width="1600" height="1067" fill="${sky}"/>`;
}

/** Steel-and-glass conservatory shell (seen from inside). */
function glassHouse(s: Scene, mood: Mood, rand: Rand, sun?: V3): void {
  room(s, { x0: G.x0, x1: G.x1, z0: G.z0, z1: G.z1, h: G.eave, wall: PARAPET, floor: FLOOR, floorKind: "stone", tile: 0.6, ceiling: "#fff", noLeft: true, noRight: true, noBack: true, noCeiling: true, seed: rand });
  // parapets
  s.box([G.x0 - 0.2, 0, G.z0], [G.x0, G.par, G.z1 + 0.2], { base: PARAPET, top: lighten(PARAPET, 0.1) }, { layer: 0.2 });
  s.box([G.x1, 0, G.z0], [G.x1 + 0.2, G.par, G.z1 + 0.2], { base: PARAPET, top: lighten(PARAPET, 0.1) }, { layer: 0.2 });
  s.box([G.x0, 0, G.z1], [G.x1, G.par, G.z1 + 0.2], { base: PARAPET, top: lighten(PARAPET, 0.1) }, { layer: 0.19 });
  const glassTint = mood === "day" ? "#ffffff" : "#ffd9a0";
  // glass panes (faint) + reflections
  const panes: V3[][] = [
    [[G.x0 - 0.1, G.par, G.z0], [G.x0 - 0.1, G.par, G.z1], [G.x0 - 0.1, G.eave, G.z1], [G.x0 - 0.1, G.eave, G.z0]],
    [[G.x1 + 0.1, G.par, G.z0], [G.x1 + 0.1, G.par, G.z1], [G.x1 + 0.1, G.eave, G.z1], [G.x1 + 0.1, G.eave, G.z0]],
    [[G.x0, G.par, G.z1 + 0.1], [G.x1, G.par, G.z1 + 0.1], [G.x1, G.eave, G.z1 + 0.1], [G.x0, G.eave, G.z1 + 0.1]],
  ];
  for (const q of panes) s.poly(q, glassTint, { layer: 0.21, opacity: mood === "day" ? 0.1 : 0.06, stroke: "none" });
  // back gable glass
  s.poly([[G.x0, G.eave, G.z1 + 0.1], [G.x1, G.eave, G.z1 + 0.1], [0, G.ridge, G.z1 + 0.1]], glassTint, { layer: 0.21, opacity: 0.08, stroke: "none" });
  // roof glass
  for (const side of [-1, 1]) {
    const xe = side < 0 ? G.x0 - 0.1 : G.x1 + 0.1;
    s.poly([[xe, G.eave, G.z0], [xe, G.eave, G.z1 + 0.1], [0, G.ridge, G.z1 + 0.1], [0, G.ridge, G.z0]], glassTint, { layer: 0.21, opacity: 0.07, stroke: "none" });
  }
  // mullions on side walls
  const M = 0.07;
  for (let z = Math.ceil(G.z0); z <= G.z1; z += 1) {
    for (const x of [G.x0 - 0.1, G.x1 + 0.1]) s.rod([x, G.par, z], [x, G.eave, z], STEEL, M, { layer: 0.3 });
    // rafters
    s.rod([G.x0 - 0.1, G.eave, z], [0, G.ridge, z], STEEL, 0.08, { layer: 0.31 });
    s.rod([G.x1 + 0.1, G.eave, z], [0, G.ridge, z], STEEL, 0.08, { layer: 0.31 });
  }
  for (const x of [G.x0 - 0.1, G.x1 + 0.1]) {
    s.rod([x, 2.25, G.z0], [x, 2.25, G.z1], STEEL, 0.05, { layer: 0.3 });
    s.rod([x, G.eave, G.z0], [x, G.eave, G.z1], STEEL, 0.12, { layer: 0.32 });
  }
  s.rod([0, G.ridge, G.z0], [0, G.ridge, G.z1], STEEL, 0.14, { layer: 0.32 });
  // back wall mullions
  for (let x = G.x0; x <= G.x1 + 0.01; x += (G.x1 - G.x0) / 8) {
    const topY = G.eave + (G.ridge - G.eave) * (1 - Math.abs(x) / G.x1);
    s.rod([x, G.par, G.z1 + 0.1], [x, topY, G.z1 + 0.1], STEEL, M, { layer: 0.25 });
  }
  s.rod([G.x0, 2.25, G.z1 + 0.1], [G.x1, 2.25, G.z1 + 0.1], STEEL, 0.05, { layer: 0.25 });
  s.rod([G.x0, G.eave, G.z1 + 0.1], [G.x1, G.eave, G.z1 + 0.1], STEEL, 0.1, { layer: 0.25 });
  // sun: mullion + rafter shadows on the floor
  if (sun) {
    const shadow = (a: V3, b: V3) => {
      const hit = (p: V3): V3 => {
        const t = -p[1] / sun[1];
        return [p[0] + sun[0] * t, 0.003, p[2] + sun[2] * t];
      };
      const A = hit(a);
      const B = hit(b);
      const pa = s.cam.project(A);
      const pb = s.cam.project(B);
      if (!pa || !pb) return;
      s.raw(`<line x1="${f1(pa[0])}" y1="${f1(pa[1])}" x2="${f1(pb[0])}" y2="${f1(pb[1])}" stroke="#6b5a45" stroke-width="${f1(Math.max(1, 0.07 * s.cam.scaleAt(A)))}" stroke-opacity="0.22" stroke-linecap="round"/>`, 0.45);
    };
    for (let z = Math.ceil(G.z0); z <= G.z1; z += 1) {
      shadow([G.x0 - 0.1, G.par, z], [G.x0 - 0.1, G.eave, z]);
      shadow([G.x0 - 0.1, G.eave, z], [0, G.ridge, z]);
    }
    // warm sun patch on the floor
    const patch: V3[] = [[G.x0 + 0.5, 0.003, 0.5], [G.x1 - 0.3, 0.003, 0.5], [G.x1 - 0.3, 0.003, G.z1], [G.x0 + 0.5, 0.003, G.z1]];
    const pr = s.projectPoly(patch);
    if (pr) s.raw(`<polygon points="${pts(pr.pts)}" fill="#fff4d8" opacity="0.18" style="mix-blend-mode:screen"/>`, 0.46);
  }
}

function roundBanquet(s: Scene, x: number, z: number, rand: Rand, lit: boolean): void {
  const r = 0.75;
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
      s.sprite([x, h, z], vaseFlowersSvg(rand, 0.32, "#e7c9b4", "#e8efe6"), { layer: ON_TOP });
      if (lit) {
        candle(s, [x - 0.18, h, z + 0.1], 0.12, 0.6, 0.45);
        candle(s, [x + 0.18, h, z - 0.1], 0.1, 0.6, 0.45);
      }
    },
  });
  const off = r + 0.24;
  const seat = "#efe6d3";
  chair(s, { x, z: z - off, facing: "+z", wood: RATTAN, seat, back: "slats" });
  chair(s, { x, z: z + off, facing: "-z", wood: RATTAN, seat, back: "slats" });
  chair(s, { x: x - off, z, facing: "+x", wood: RATTAN, seat, back: "slats" });
  chair(s, { x: x + off, z, facing: "-x", wood: RATTAN, seat, back: "slats" });
}

function lounge(s: Scene, x: number, z: number, rand: Rand): void {
  s.disc([x, 0.004, z], 1.3, "#d9c6a4", { layer: 0.5, stroke: "#c7b18b", strokeWidth: 2 });
  armchair(s, x - 0.75, z, "+x", "#efe6d3", RATTAN);
  armchair(s, x + 0.75, z, "-x", "#efe6d3", RATTAN);
  armchair(s, x, z + 0.85, "-z", "#8a9a6a", RATTAN);
  table(s, {
    x,
    z,
    w: 0.6,
    d: 0.6,
    round: true,
    h: 0.45,
    wood: P.woodLight,
    decor: () => {
      s.sprite([x - 0.1, 0.45, z], `<path d="M-0.04 -0.06 H0.04 L0.035 0 H-0.035Z" fill="#fbfaf6"/><path d="M0.04 -0.045 Q 0.065 -0.035 0.038 -0.015" stroke="#fbfaf6" stroke-width="0.01" fill="none"/><ellipse cx="0" cy="0" rx="0.06" ry="0.012" fill="#efe9dc"/>`, { layer: ON_TOP });
      s.sprite([x + 0.12, 0.45, z + 0.05], `<path d="M-0.04 -0.06 H0.04 L0.035 0 H-0.035Z" fill="#fbfaf6"/><ellipse cx="0" cy="0" rx="0.06" ry="0.012" fill="#efe9dc"/>`, { layer: ON_TOP });
      s.sprite([x + 0.02, 0.45, z - 0.12], vaseFlowersSvg(rand, 0.18, "#e7c9b4"), { layer: ON_TOP });
    },
  });
}

function plants(s: Scene, rand: Rand, spots: Array<[number, number, "olive" | "long" | "fern", number]>): void {
  for (const [x, z, kind, h] of spots) {
    floorShadow(s, x - 0.3, z - 0.3, x + 0.4, z + 0.4, 0.2, 6);
    pottedPlant(s, [x, 0, z], rand, { kind, h, w: kind === "olive" ? 1.1 : 1.0, pot: kind === "fern" ? P.terracotta : "#ded3c0", potR: 0.26, potH: 0.5, colors: ["#5f7a47", "#4f5b3d", "#8fa46c", "#6d8752"] });
  }
}

// ---------------------------------------------------------------------------

function hero(): string {
  const rand = mulberry32(111);
  const s = makeScene({ pos: [0.3, 1.55, 0], yaw: -3, fov: 76, horizon: 0.5 }, { haze: "#eef0e6", hazeNear: 3, hazeFar: 25, hazeMax: 0.25, light: [-0.5, 0.8, -0.2] });
  const bg = skyAndGarden(s, "day", rand);
  glassHouse(s, "day", rand, [0.55, -0.75, 0.3]);
  roundBanquet(s, 1.6, 5.8, rand, false);
  roundBanquet(s, -1.2, 8.4, rand, false);
  lounge(s, -2.2, 3.4, rand);
  plants(s, rand, [
    [-3.7, 1.5, "long", 1.9],
    [3.7, 2.2, "olive", 2.0],
    [3.6, 8.6, "long", 1.8],
    [-3.7, 6.2, "olive", 2.1],
    [2.8, 10.3, "fern", 1.0],
    [-3.2, 10.2, "fern", 1.1],
  ]);
  return compose(s, { before: bg, vignette: 0.24, grain: 0.14, grade: "#f0d8a8", gradeOpacity: 0.12 });
}

function loungeDetail(): string {
  const rand = mulberry32(113);
  const s = makeScene(lookAt([-2.3, 0.7, 3.6], 4.4, 12, -30, 52), { haze: "#eef0e6", hazeNear: 3, hazeFar: 25, hazeMax: 0.25, light: [-0.5, 0.8, -0.2] });
  const bg = skyAndGarden(s, "day", rand);
  glassHouse(s, "day", rand, [0.55, -0.75, 0.3]);
  lounge(s, -2.2, 3.6, rand);
  plants(s, rand, [
    [-3.7, 1.9, "long", 1.9],
    [-3.7, 5.6, "olive", 2.1],
    [-0.5, 5.8, "fern", 1.1],
  ]);
  s.raw(`<rect width="1600" height="1067" fill="${s.defs.linear([[0, "#fff4d8", 0.35], [0.6, "#fff4d8", 0]], 0, 0, 1, 0.3)}" style="mix-blend-mode:screen"/>`, 2.1);
  return compose(s, { before: bg, vignette: 0.26, grain: 0.14, grade: "#f0d8a8", gradeOpacity: 0.14 });
}

function eveningBanquet(): string {
  const rand = mulberry32(117);
  const s = makeScene({ pos: [-0.8, 1.6, 0], yaw: 8, fov: 74, horizon: 0.5 }, { haze: "#3a3440", hazeNear: 3, hazeFar: 25, hazeMax: 0.3, light: [0.2, 0.8, -0.4] });
  const bg = skyAndGarden(s, "dusk", rand);
  glassHouse(s, "dusk", rand);
  for (const [x, z] of [[-1.9, 3.4], [1.9, 3.9], [-1.9, 6.6], [1.9, 7.1], [0, 9.4]] as const) roundBanquet(s, x, z, rand, true);
  plants(s, rand, [
    [-3.8, 1.4, "long", 1.9],
    [3.8, 1.8, "olive", 2.0],
    [3.8, 9.6, "long", 1.8],
    [-3.8, 9.4, "olive", 2.0],
  ]);
  eveningGrade(s, 0.42, "#5a4a52");
  for (const z of [1.5, 4.0, 6.5, 9.0]) stringLights(s, [G.x0, G.eave - 0.05, z], [G.x1, G.eave - 0.05, z], 0.5, 14, 0.9);
  stringLights(s, [0, G.ridge - 0.1, G.z0 + 1], [0, G.ridge - 0.1, G.z1], 0.3, 18, 0.8);
  return compose(s, { before: bg, vignette: 0.42, grain: 0.18, grade: "#ffb870", gradeOpacity: 0.12 });
}

/** Exterior at dusk: the glass pavilion glowing in the garden. */
function exteriorDusk(): string {
  const rand = mulberry32(119);
  const s = makeScene({ pos: [5.2, 1.65, -10.5], yaw: -18, pitch: -3, fov: 62, horizon: 0.55 }, { haze: "#2a3042", hazeNear: 10, hazeFar: 50, hazeMax: 0.35, light: [-0.4, 0.7, -0.6] });
  const bg = skyAndGarden(s, "dusk", rand);
  // stars
  const stars: string[] = [];
  for (let i = 0; i < 50; i++) stars.push(`<circle cx="${f1(rand() * 1600)}" cy="${f1(rand() * 300)}" r="${f1(0.6 + rand())}" fill="#fff6e0" opacity="${(0.3 + rand() * 0.5).toFixed(2)}"/>`);
  // main building behind
  house(s, { x0: -7, x1: 7, z0: 9.2, z1: 18, eave: 6.3, ridge: 10.5, ridgeAxis: "x", hip: true, wall: "#e3d9c6", roof: "#a4553a", overhang: 0.4, lit: true, windows: [-5, -2.6, 2.6, 5].flatMap((x) => [{ x, y: 3.9, w: 0.95, h: 1.25 }]) });
  // pavilion (x -4.3..4.3, z 0..9)
  const Z0 = 0;
  const Z1 = 9.2;
  // interior content visible through the glass
  for (const [x, z] of [[-2.0, 2.8], [1.9, 3.2], [-1.6, 6.4], [2.2, 6.8]] as const) roundBanquet(s, x, z, rand, true);
  pottedPlant(s, [-3.6, 0, 1.2], rand, { kind: "long", h: 1.9, pot: "#ded3c0", potR: 0.26, potH: 0.5 });
  pottedPlant(s, [3.6, 0, 1.4], rand, { kind: "olive", h: 2.0, pot: "#ded3c0", potR: 0.26, potH: 0.5 });
  // warm interior light fill
  s.poly([[G.x0, 0.01, Z0], [G.x1, 0.01, Z0], [G.x1, 0.01, Z1], [G.x0, 0.01, Z1]], "#e9c895", { layer: 0.3 });
  s.poly([[G.x0, 0, Z1], [G.x1, 0, Z1], [G.x1, G.eave + 1, Z1], [G.x0, G.eave + 1, Z1]], "#d9a870", { layer: 0.31 });
  // parapets
  s.box([G.x0 - 0.2, 0, Z0 - 0.2], [G.x1 + 0.2, G.par, Z0], { base: PARAPET }, { layer: 1.45 });
  s.box([G.x1, 0, Z0], [G.x1 + 0.2, G.par, Z1], { base: PARAPET }, { layer: 1.44 });
  // glass (front + right side + roof), warm glow
  const glassFill = s.defs.linear([[0, "#ffd9a0", 0.32], [1, "#ffb870", 0.12]]);
  const front: V3[] = [[G.x0, G.par, Z0 - 0.1], [G.x1, G.par, Z0 - 0.1], [G.x1, G.eave, Z0 - 0.1], [G.x0, G.eave, Z0 - 0.1]];
  const side: V3[] = [[G.x1 + 0.1, G.par, Z0], [G.x1 + 0.1, G.par, Z1], [G.x1 + 0.1, G.eave, Z1], [G.x1 + 0.1, G.eave, Z0]];
  const gable: V3[] = [[G.x0, G.eave, Z0 - 0.1], [G.x1, G.eave, Z0 - 0.1], [0, G.ridge, Z0 - 0.1]];
  const roofR: V3[] = [[G.x1 + 0.1, G.eave, Z0 - 0.1], [G.x1 + 0.1, G.eave, Z1], [0, G.ridge, Z1], [0, G.ridge, Z0 - 0.1]];
  for (const q of [roofR, side, front, gable]) {
    const pr = s.projectPoly(q);
    if (pr) s.raw(`<polygon points="${pts(pr.pts)}" fill="${glassFill}"/>`, 1.5);
  }
  // steel frame
  for (let x = G.x0; x <= G.x1 + 0.01; x += (G.x1 - G.x0) / 8) {
    const topY = G.eave + (G.ridge - G.eave) * (1 - Math.abs(x) / G.x1);
    s.rod([x, G.par, Z0 - 0.1], [x, topY, Z0 - 0.1], STEEL, 0.07, { layer: 1.6 });
  }
  for (let z = Z0; z <= Z1; z += 1.15) {
    s.rod([G.x1 + 0.1, G.par, z], [G.x1 + 0.1, G.eave, z], STEEL, 0.07, { layer: 1.58 });
    s.rod([G.x1 + 0.1, G.eave, z], [0, G.ridge, z], STEEL, 0.07, { layer: 1.57 });
  }
  s.rod([G.x0, G.eave, Z0 - 0.1], [G.x1 + 0.1, G.eave, Z0 - 0.1], STEEL, 0.12, { layer: 1.61 });
  s.rod([G.x1 + 0.1, G.eave, Z0 - 0.1], [G.x1 + 0.1, G.eave, Z1], STEEL, 0.12, { layer: 1.61 });
  s.rod([0, G.ridge, Z0 - 0.1], [0, G.ridge, Z1], STEEL, 0.12, { layer: 1.61 });
  s.rod([G.x0, G.eave, Z0 - 0.1], [0, G.ridge, Z0 - 0.1], STEEL, 0.1, { layer: 1.61 });
  s.rod([G.x1 + 0.1, G.eave, Z0 - 0.1], [0, G.ridge, Z0 - 0.1], STEEL, 0.1, { layer: 1.61 });
  s.rod([G.x0, 2.25, Z0 - 0.1], [G.x1, 2.25, Z0 - 0.1], STEEL, 0.05, { layer: 1.6 });
  // inner string lights
  for (const z of [1.5, 4.5, 7.5]) stringLights(s, [G.x0 + 0.2, G.eave - 0.1, z], [G.x1 - 0.2, G.eave - 0.1, z], 0.45, 12, 0.9);
  // path, lanterns, boxwood
  s.poly([[-0.8, 0.002, -14], [0.8, 0.002, -14], [0.8, 0.002, Z0 - 0.2], [-0.8, 0.002, Z0 - 0.2]], "#8a8070", { layer: -0.5 });
  for (const z of [-8, -4.5]) {
    for (const x of [-1.2, 1.2]) {
      s.sprite([x, 0, z], `<rect x="-0.03" y="-0.7" width="0.06" height="0.7" fill="#1c1917"/><rect x="-0.08" y="-0.9" width="0.16" height="0.2" fill="#ffd48a" stroke="#1c1917" stroke-width="0.02"/>`);
      const c = s.cam.project([x, 0.8, z]);
      if (c) s.raw(glow(s.defs, c[0], c[1], 1.0 * s.cam.scaleAt([x, 0.8, z]), "#ffc676", 0.55), 2.3);
    }
  }
  for (const x of [-3.2, 3.4]) s.sprite([x, 0, -1.2], boxwoodSvg(0.4, "#6d665c"), { layer: 1.7 });
  wallLantern(s, [-1.0, 2.1, Z0 - 0.15], true);
  eveningGrade(s, 0.3, "#5a5060");
  // glow spilling from the pavilion
  const c = s.cam.project([0, 1.4, 3]);
  if (c) s.raw(glow(s.defs, c[0], c[1], 700, "#ffc676", 0.28), 2.2);
  return compose(s, { before: bg + stars.join(""), vignette: 0.45, grain: 0.18, grade: "#ffb870", gradeOpacity: 0.1 });
}

export const winterGarden: SpaceScenes = {
  folder: "winter-garden",
  label: "Wintergarten",
  tour: true,
  shots: [
    { name: "hero", title: "Lichtdurchfluteter Wintergarten", render: hero },
    { name: "gallery-01", title: "Lounge-Ecke im Sonnenlicht", render: loungeDetail },
    { name: "gallery-02", title: "Bankett zur blauen Stunde", render: eveningBanquet },
    { name: "gallery-03", title: "Wintergarten von außen am Abend", render: exteriorDusk },
  ],
};
