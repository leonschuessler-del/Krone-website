import { darken, lighten, P } from "../lib/color";
import { lookAt, ON_TOP, type Scene, type V3 } from "../lib/persp";
import { beams, bench, bokeh, candle, chair, floorShadow, room, table, tumblerSvg, wallGrid, windowOn } from "../lib/props";
import { mulberry32, type Rand } from "../lib/rand";
import { ellipseGlow, finish, glow, svgDoc } from "../lib/svg";
import { compose, eveningGrade, makeScene, type SpaceScenes } from "./common";

const PANEL = "#4f3826";
const UPPER = "#dcc8a2";
const FLOOR = "#6e5236";
const CEIL = "#5a4128";
const BEAM = "#3a2a1d";
const TILE = "#5d7a57";
const R = { x0: -3.5, x1: 3.5, z0: -1.5, z1: 9.5, h: 2.65 };
const BAR = { x0: 1.6, x1: 2.35, z0: 2.2, z1: 7.6, h: 1.08 };

function lantern(s: Scene, x: number, z: number, y: number, lit = true): void {
  s.group([x, y, z], () => {
    s.rod([x, R.h, z], [x, y + 0.34, z], "#1c1917", 0.012);
  });
  s.sprite(
    [x, y, z],
    `<path d="M-0.09 -0.3 L0 -0.36 L0.09 -0.3Z" fill="#1c1917"/>` +
      `<rect x="-0.08" y="-0.3" width="0.16" height="0.24" fill="${lit ? "#ffd48a" : "#9b8b6c"}" stroke="#1c1917" stroke-width="0.012"/>` +
      `<path d="M0 -0.3 V-0.06 M-0.08 -0.18 H0.08" stroke="#1c1917" stroke-width="0.008"/>` +
      `<path d="M-0.1 -0.06 H0.1 L0.07 -0.02 H-0.07Z" fill="#1c1917"/>`,
    { layer: 1.3 },
  );
  if (!lit) return;
  const c = s.cam.project([x, y + 0.18, z]);
  if (c) {
    const sc = s.cam.scaleAt([x, y, z]);
    s.raw(glow(s.defs, c[0], c[1], 1.5 * sc, "#ffc676", 0.5), 2.2);
    s.raw(glow(s.defs, c[0], c[1], 0.25 * sc, "#fff0cf", 0.8), 2.3);
  }
}

/** Traditional green tiled stove with bench. */
function kachelofen(s: Scene, x0: number, x1: number, z0: number, z1: number): void {
  const base = 1.25;
  const top = 2.05;
  s.group([(x0 + x1) / 2, 1, (z0 + z1) / 2], () => {
    s.box([x0 - 0.05, 0, z0 - 0.05], [x1 + 0.05, 0.12, z1 + 0.05], darken(TILE, 0.45));
    s.box([x0, 0.12, z0], [x1, base, z1], { base: TILE, top: lighten(TILE, 0.1) });
    s.box([x0 - 0.06, base, z0 - 0.06], [x1 + 0.06, base + 0.08, z1 + 0.06], { base: darken(TILE, 0.15) });
    s.box([x0 + 0.15, base + 0.08, z0 + 0.15], [x1 - 0.15, top, z1 - 0.15], { base: TILE, top: lighten(TILE, 0.12) });
    s.box([x0 + 0.08, top, z0 + 0.08], [x1 - 0.08, top + 0.1, z1 - 0.08], { base: darken(TILE, 0.2) });
    // tile joints on the two visible faces
    const tile = 0.2;
    for (let y = 0.12 + tile; y < base; y += tile) {
      s.line([x0, y, z0 - 0.002], [x1, y, z0 - 0.002], lighten(TILE, 0.28), 1.2);
      s.line([x1 + 0.002, y, z0], [x1 + 0.002, y, z1], lighten(TILE, 0.22), 1.2);
    }
    for (let x = x0 + tile; x < x1; x += tile) s.line([x, 0.12, z0 - 0.002], [x, base, z0 - 0.002], lighten(TILE, 0.28), 1.2);
    for (let z = z0 + tile; z < z1; z += tile) s.line([x1 + 0.002, 0.12, z], [x1 + 0.002, base, z], lighten(TILE, 0.22), 1.2);
    for (let y = base + 0.08 + tile; y < top; y += tile) {
      s.line([x0 + 0.15, y, z0 + 0.148], [x1 - 0.15, y, z0 + 0.148], lighten(TILE, 0.28), 1.1);
      s.line([x1 - 0.148, y, z0 + 0.15], [x1 - 0.148, y, z1 - 0.15], lighten(TILE, 0.22), 1.1);
    }
    // oven door (brass)
    s.box([x0 + 0.35, 0.35, z0 - 0.02], [x0 + 0.75, 0.7, z0], { base: P.goldDark, front: P.gold });
  });
  floorShadow(s, x0, z0, x1 + 0.2, z1 + 0.1, 0.4, 7);
}

function barCounter(s: Scene, rand: Rand, taps = true): void {
  const { x0, x1, z0, z1, h } = BAR;
  floorShadow(s, x0 - 0.1, z0, x1, z1, 0.4, 6);
  s.group([(x0 + x1) / 2, h / 2, (z0 + z1) / 2], () => {
    s.box([x0, 0, z0], [x1, h - 0.05, z1], { base: "#5a4029" });
    s.box([x0 - 0.08, h - 0.05, z0 - 0.08], [x1 + 0.04, h, z1 + 0.08], { base: "#6b4c31", top: "#7a5838" });
    // raised panels on the guest side
    for (let z = z0 + 0.1; z < z1 - 0.2; z += 0.6) {
      s.poly(
        [
          [x0 - 0.003, 0.2, z],
          [x0 - 0.003, 0.2, z + 0.48],
          [x0 - 0.003, h - 0.18, z + 0.48],
          [x0 - 0.003, h - 0.18, z],
        ],
        "#4a3322",
        { stroke: "#7a5838", strokeWidth: 1.2 },
      );
    }
    // brass foot rail
    s.rod([x0 - 0.12, 0.2, z0], [x0 - 0.12, 0.2, z1], P.gold, 0.035);
    if (taps) {
      for (const tz of [3.6, 5.6]) {
        const tx = (x0 + x1) / 2;
        s.cyl([tx, h, tz], 0.05, 0.05, 0.42, { side: P.gold, top: P.goldLight }, { layer: ON_TOP });
        s.box([tx - 0.05, h + 0.34, tz - 0.3], [tx + 0.05, h + 0.42, tz + 0.3], { base: P.gold, top: P.goldLight }, { layer: ON_TOP });
        for (const dz of [-0.22, 0, 0.22]) {
          s.sprite([tx - 0.05, h + 0.36, tz + dz], `<rect x="-0.018" y="-0.2" width="0.036" height="0.18" rx="0.012" fill="${P.woodDark}"/><rect x="-0.012" y="-0.03" width="0.024" height="0.08" fill="${P.gold}"/>`, { layer: ON_TOP + 0.01 });
        }
      }
      for (const gz of [3.0, 3.3, 6.2]) s.sprite([x0 + 0.1, h, gz], tumblerSvg(0.18, true), { layer: ON_TOP });
    }
  });
  // back bar
  s.box([R.x1 - 0.5, 0, 2.2], [R.x1, 0.95, 8.0], { base: "#4a3322", top: "#5e4630" }, { layer: 0.8 });
  for (const y of [1.35, 1.75, 2.1]) {
    s.box([R.x1 - 0.3, y, 2.4], [R.x1, y + 0.04, 7.8], { base: "#5e4630" }, { layer: 0.81 });
    for (let z = 2.55; z < 7.7; z += 0.19) {
      const col = ["#3f5a3a", "#6e2a30", "#c49a2c", "#e8dfcd", "#2f4a3a"][Math.floor(rand() * 5)] ?? "#3f5a3a";
      s.sprite([R.x1 - 0.15, y + 0.04, z], `<path d="M-0.03 0 V-0.16 Q -0.03 -0.2 -0.01 -0.21 V-0.27 H0.01 V-0.21 Q 0.03 -0.2 0.03 -0.16 V0Z" fill="${col}"/><rect x="-0.03" y="-0.1" width="0.06" height="0.04" fill="#efe2c4" opacity="0.8"/>`, { layer: 0.82 });
    }
  }
}

function plateRail(s: Scene, side: "left" | "back", from: number, to: number, rand: Rand): void {
  const y = 1.95;
  if (side === "left") {
    s.box([R.x0, y - 0.03, from], [R.x0 + 0.14, y, to], { base: "#5e4630" }, { layer: 0.5 });
    for (let z = from + 0.2; z < to; z += 0.34) {
      const deco = ["#3f5a7a", "#8e2a36", "#4f6b3b"][Math.floor(rand() * 3)] ?? "#3f5a7a";
      s.sprite([R.x0 + 0.07, y, z], `<circle cx="0" cy="-0.13" r="0.12" fill="#efe6d4"/><circle cx="0" cy="-0.13" r="0.09" fill="none" stroke="${deco}" stroke-width="0.012"/><circle cx="0" cy="-0.13" r="0.035" fill="${deco}" opacity="0.7"/>`, { layer: 0.51 });
    }
  } else {
    s.box([from, y - 0.03, R.z1 - 0.14], [to, y, R.z1], { base: "#5e4630" }, { layer: 0.5 });
    for (let x = from + 0.2; x < to; x += 0.3) {
      s.sprite([x, y, R.z1 - 0.07], `<path d="M-0.05 0 V-0.12 Q -0.05 -0.16 0 -0.16 Q 0.05 -0.16 0.05 -0.12 V0Z" fill="#a9a59c"/><path d="M0.05 -0.12 Q 0.09 -0.1 0.05 -0.05" stroke="#a9a59c" stroke-width="0.012" fill="none"/>`, { layer: 0.51 });
    }
  }
}

function tavernShell(s: Scene, rand: Rand, mood: "day" | "dusk"): void {
  room(s, { ...R, wall: UPPER, floor: FLOOR, floorKind: "planks", plank: 0.28, ceiling: CEIL, wainscot: { h: 1.9, color: PANEL, panels: 0.8 }, skirting: darken(PANEL, 0.3), seed: rand });
  // ceiling boards + beams
  for (let x = R.x0 + 0.25; x < R.x1; x += 0.25) s.line([x, R.h - 0.002, 0.2], [x, R.h - 0.002, R.z1], darken(CEIL, 0.25), 1, { layer: 0.05 });
  beams(s, R, BEAM, 1.3, [0.22, 0.2]);
  wallGrid(s, "left", R.x0, 0, R.z1, 2.0, R.h, 0.6, 1, darken(UPPER, 0.08), 0.8, 0.5, false, 0.31);
  for (const [u0, u1] of [
    [1.2, 2.2],
    [4.2, 5.2],
  ] as const) {
    windowOn(s, { side: "left", plane: R.x0, u0, u1, v0: 1.0, v1: 1.85, cols: 2, rows: 2, mood, view: "butzen", frame: "#3a2a1d", wall: PANEL, sill: "#5e4630", depth: 0.3 });
  }
  plateRail(s, "left", 0.4, 8.0, rand);
  plateRail(s, "back", -3.4, 0.6, rand);
  kachelofen(s, -3.45, -2.2, 7.3, 9.45);
  // stove bench
  bench(s, -1.95, 8.35, 2.0, "z", "#6b4c31", 0.45, 0.36);
  s.box([-2.13, 0.45, 7.45], [-1.77, 0.5, 9.3], { base: "#a4553a", top: "#b8664a" }, { layer: 1 });
  barCounter(s, rand);
  // door in back wall
  s.box([1.0, 0, R.z1 - 0.06], [2.0, 2.1, R.z1], { base: "#3a2a1d" }, { layer: 0.45 });
  s.box([1.1, 0, R.z1 - 0.08], [1.9, 2.0, R.z1 - 0.06], { base: "#5a4029" }, { layer: 0.46 });
}

function woodTable(s: Scene, x: number, z: number, w: number, d: number, rand: Rand, opts: { lit?: boolean; beers?: number } = {}): void {
  table(s, {
    x,
    z,
    w,
    d,
    wood: "#7a5838",
    decor: () => {
      if (opts.lit) candle(s, [x, 0.76, z], 0.1, 0.5, 0.45, P.goldDark);
      for (let i = 0; i < (opts.beers ?? 0); i++) s.sprite([x - w / 2 + 0.25 + i * 0.35, 0.76, z + (i % 2 ? 0.18 : -0.18)], tumblerSvg(0.18, true), { layer: ON_TOP });
      if (rand() > 0.5) s.sprite([x + 0.3, 0.76, z], `<ellipse cx="0" cy="-0.01" rx="0.07" ry="0.02" fill="#e9e1cf"/><rect x="-0.02" y="-0.07" width="0.04" height="0.06" rx="0.01" fill="#efe6d4"/>`, { layer: ON_TOP });
    },
  });
}

// ---------------------------------------------------------------------------

function hero(): string {
  const rand = mulberry32(91);
  const s = makeScene({ pos: [0.45, 1.5, 0], yaw: 4, fov: 74, horizon: 0.5 }, { haze: "#3a2a1d", hazeNear: 3, hazeFar: 12, hazeMax: 0.25, light: [0.2, 0.8, -0.5] });
  tavernShell(s, rand, "dusk");
  // tables along the left wall with wall benches + chairs
  for (const z of [1.8, 4.6]) {
    bench(s, R.x0 + 0.3, z, 1.8, "z", "#6b4c31", 0.45, 0.4);
    woodTable(s, -2.5, z, 0.8, 1.5, rand, { lit: true, beers: 2 });
    chair(s, { x: -1.75, z: z - 0.4, facing: "-x", wood: "#5e4630", back: "heart" });
    chair(s, { x: -1.75, z: z + 0.4, facing: "-x", wood: "#5e4630", back: "heart" });
  }
  woodTable(s, -0.3, 6.6, 1.3, 0.8, rand, { lit: true, beers: 1 });
  chair(s, { x: -0.6, z: 6.0, facing: "+z", wood: "#5e4630", back: "heart" });
  chair(s, { x: 0.0, z: 6.0, facing: "+z", wood: "#5e4630", back: "heart" });
  chair(s, { x: -0.6, z: 7.2, facing: "-z", wood: "#5e4630", back: "heart" });
  // bar stools
  for (const z of [3.0, 4.2, 5.4, 6.6]) {
    s.sprite([1.25, 0, z], `<path d="M-0.14 0 L-0.09 -0.72 M0.14 0 L0.09 -0.72 M-0.04 0 L-0.03 -0.72 M0.04 0 L0.03 -0.72" stroke="#3a2a1d" stroke-width="0.03"/><path d="M-0.12 -0.28 H0.12" stroke="#3a2a1d" stroke-width="0.02"/><ellipse cx="0" cy="-0.74" rx="0.18" ry="0.05" fill="#7a5838"/><rect x="-0.18" y="-0.76" width="0.36" height="0.035" fill="#5e4630"/>`);
  }
  for (const [x, z] of [[-2.5, 1.8], [-2.5, 4.6], [-0.3, 6.6], [2.0, 3.4], [2.0, 5.8]] as const) lantern(s, x, z, 1.75);
  eveningGrade(s, 0.4, "#6b5140");
  return compose(s, { background: "#2a1f17", vignette: 0.45, grain: 0.2, grade: "#ffb870", gradeOpacity: 0.16 });
}

/** Beer taps close-up with a freshly drawn beer. */
function tapDetail(): string {
  const rand = mulberry32(93);
  const cam = lookAt([BAR.x0 + 0.4, BAR.h + 0.28, 4.4], 1.45, 12, 82, 46, { horizon: 0.5 });
  const fg = makeScene(cam, { light: [-0.6, 0.7, -0.3] });
  const bg = makeScene(cam, { haze: "#3a2a1d", hazeNear: 1, hazeFar: 6, hazeMax: 0.2 }, fg.defs);
  tavernShell(bg, rand, "dusk");
  lantern(bg, 2.2, 5.4, 1.8);
  eveningGrade(bg, 0.38, "#6b5140");
  // foreground: counter top, tap tower, glass
  const { x0, x1, h } = BAR;
  fg.box([x0 - 0.08, h - 0.08, 3.4], [x1 + 0.04, h, 5.6], { base: "#6b4c31", top: "#7a5838" });
  const tx = (x0 + x1) / 2 + 0.1;
  const tz = 4.3;
  fg.box([tx - 0.16, h, tz - 0.12], [tx + 0.04, h + 0.015, tz + 0.4], { base: "#6f7473", top: "#8e9392" }, { layer: ON_TOP });
  for (let z = tz - 0.09; z < tz + 0.38; z += 0.04) fg.line([tx - 0.14, h + 0.016, z], [tx + 0.02, h + 0.016, z], "#555a59", 1, { layer: ON_TOP + 0.001 });
  fg.cyl([tx, h, tz + 0.1], 0.07, 0.07, 0.5, { side: P.gold, top: P.goldLight }, { layer: ON_TOP + 0.002 });
  fg.box([tx - 0.07, h + 0.42, tz - 0.25], [tx + 0.07, h + 0.52, tz + 0.45], { base: P.gold, top: P.goldLight }, { layer: ON_TOP + 0.003 });
  for (const dz of [-0.15, 0.1, 0.35]) {
    fg.sprite([tx - 0.08, h + 0.44, tz + dz], `<rect x="-0.02" y="-0.24" width="0.04" height="0.22" rx="0.015" fill="${P.woodDark}"/><rect x="-0.012" y="-0.03" width="0.024" height="0.06" fill="${P.goldLight}"/><path d="M-0.012 0.03 H0.012 V0.08 Q 0 0.1 -0.012 0.08Z" fill="${P.gold}"/>`, { layer: ON_TOP + 0.01 });
  }
  // glass under the middle tap with stream
  const gp: V3 = [tx - 0.08, h + 0.021, tz + 0.1];
  fg.sprite(gp, `<path d="M-0.045 -0.25 L-0.035 0 H0.035 L0.045 -0.25Z" fill="#d9a441" fill-opacity="0.9" stroke="#ffffff" stroke-opacity="0.7" stroke-width="0.003"/><path d="M-0.046 -0.25 H0.046 L0.045 -0.21 H-0.045Z" fill="#fbf6ea"/><ellipse cx="0" cy="-0.255" rx="0.05" ry="0.012" fill="#fffaf0"/><path d="M-0.03 -0.23 L-0.024 -0.02" stroke="#ffffff" stroke-opacity="0.6" stroke-width="0.005"/><rect x="-0.002" y="-0.37" width="0.004" height="0.12" fill="#e8b551" opacity="0.9"/>`, { layer: ON_TOP + 0.02 });
  fg.sprite([tx - 0.02, h + 0.021, tz + 0.55], tumblerSvg(0.2, true), { layer: ON_TOP + 0.02 });
  const g = fg.cam.project([tx, h + 0.4, tz]);
  if (g) fg.raw(glow(fg.defs, g[0] - 40, g[1] - 60, 260, "#ffe6b8", 0.25), 2.2);
  bokeh(fg, rand, 14, [0, 0, 1600, 500], 12, 38, ["#ffc676", "#ffd9a0", "#f7b867"], 0.28);
  const body =
    `<rect width="1600" height="1067" fill="#2a1f17"/>` +
    `<g filter="${fg.defs.blur(8)}">${bg.render()}</g>` +
    fg.render();
  return svgDoc(fg.defs, body + finish(fg.defs, { vignette: 0.5, grain: 0.2, grade: "#ffb870", gradeOpacity: 0.16 }));
}

/** Tiled stove corner with bench and bullseye window. */
function stoveCorner(): string {
  const rand = mulberry32(95);
  const s = makeScene({ pos: [0.6, 1.5, 4.2], yaw: -36, fov: 70, horizon: 0.5 }, { haze: "#3a2a1d", hazeNear: 3, hazeFar: 10, hazeMax: 0.2, light: [0.5, 0.8, -0.3] });
  tavernShell(s, rand, "dusk");
  windowOn(s, { side: "back", plane: R.z1, u0: -1.8, u1: -0.9, v0: 1.0, v1: 1.85, cols: 2, rows: 2, mood: "dusk", view: "butzen", frame: "#3a2a1d", wall: PANEL, sill: "#5e4630", depth: 0.3 });
  woodTable(s, -1.0, 6.4, 0.9, 0.9, rand, { lit: true, beers: 2 });
  chair(s, { x: -0.3, z: 6.4, facing: "-x", wood: "#5e4630", back: "heart" });
  chair(s, { x: -1.0, z: 5.7, facing: "+z", wood: "#5e4630", back: "heart" });
  lantern(s, -1.0, 6.4, 1.75);
  lantern(s, -2.8, 6.2, 1.9);
  // cat-free cushions & a folded blanket on the bench
  s.box([-2.1, 0.5, 8.0], [-1.8, 0.62, 8.5], { base: "#efe2c4" }, { layer: 1 });
  eveningGrade(s, 0.38, "#6b5140");
  const c = s.cam.project([-2.8, 0.55, 7.2]);
  if (c) s.raw(ellipseGlow(s.defs, c[0], c[1], 220, 120, "#ff9d52", 0.22), 2.2);
  return compose(s, { background: "#2a1f17", vignette: 0.45, grain: 0.2, grade: "#ffb870", gradeOpacity: 0.16 });
}

/** Regulars' table (Stammtisch) by the wall. */
function stammtisch(): string {
  const rand = mulberry32(97);
  const s = makeScene({ pos: [1.2, 1.45, 1.6], yaw: -48, fov: 68, horizon: 0.5 }, { haze: "#3a2a1d", hazeNear: 3, hazeFar: 10, hazeMax: 0.2, light: [0.5, 0.8, -0.3] });
  tavernShell(s, rand, "dusk");
  bench(s, R.x0 + 0.3, 4.6, 2.2, "z", "#6b4c31", 0.45, 0.4);
  for (let z = 3.7; z < 5.6; z += 0.6) s.box([R.x0 + 0.12, 0.45, z], [R.x0 + 0.48, 0.52, z + 0.5], { base: "#a4553a", top: "#b8664a" }, { layer: 1, bias: -0.1 });
  woodTable(s, -2.45, 4.6, 0.9, 1.9, rand, { lit: false, beers: 3 });
  for (const z of [3.9, 4.6, 5.3]) chair(s, { x: -1.6, z, facing: "-x", wood: "#5e4630", back: "heart" });
  // wrought iron Stammtisch sign on the table
  s.sprite(
    [-2.4, 0.76, 4.6],
    `<path d="M-0.08 0 H0.08 M0 0 V-0.34" stroke="#1c1917" stroke-width="0.012"/>` +
      `<path d="M0 -0.34 C -0.06 -0.4, -0.12 -0.36, -0.1 -0.3 M0 -0.34 C 0.06 -0.4, 0.12 -0.36, 0.1 -0.3" stroke="#1c1917" stroke-width="0.008" fill="none"/>` +
      `<rect x="-0.13" y="-0.3" width="0.26" height="0.09" rx="0.01" fill="#2b2522" stroke="${P.gold}" stroke-width="0.005"/>` +
      `<text x="0" y="-0.238" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="0.052" font-weight="600" fill="${P.goldLight}" letter-spacing="0.004">Stammtisch</text>`,
    { layer: 1.3 },
  );
  lantern(s, -2.45, 4.6, 1.75);
  lantern(s, -2.5, 1.8, 1.85);
  eveningGrade(s, 0.38, "#6b5140");
  return compose(s, { background: "#2a1f17", vignette: 0.45, grain: 0.2, grade: "#ffb870", gradeOpacity: 0.16 });
}

export const oldTavern: SpaceScenes = {
  folder: "old-tavern",
  label: "Alte Wirtschaft",
  tour: true,
  shots: [
    { name: "hero", title: "Historische Gaststube mit Theke und Kachelofen", render: hero },
    { name: "gallery-01", title: "Zapfhähne an der Theke", render: tapDetail },
    { name: "gallery-02", title: "Kachelofen mit Ofenbank", render: stoveCorner },
    { name: "gallery-03", title: "Stammtisch", render: stammtisch },
  ],
};


