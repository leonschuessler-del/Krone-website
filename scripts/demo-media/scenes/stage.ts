import { darken, lighten, P } from "../lib/color";
import { lookAt, ON_TOP, type Scene, type V3 } from "../lib/persp";
import { bokeh, candle, chair, floorShadow, room, table } from "../lib/props";
import { mulberry32, type Rand } from "../lib/rand";
import { ellipseGlow, finish, glow, hull, pts, svgDoc, type P2 } from "../lib/svg";
import { compose, eveningGrade, makeScene, type SpaceScenes } from "./common";

const WALL = "#4a4038";
const FLOOR = "#6b513a";
const CURTAIN = "#7a2430";
const BACKDROP = "#2d2724";
const STAGE_H = 0.55;
const R = { x0: -4.2, x1: 4.2, z0: -2, z1: 11.5, h: 3.8 };
const STAGE_Z = 7.6;

/** Repeating fold gradient for velvet curtains. */
function folds(s: Scene, color: string, period = 0.05): string {
  const id = s.defs.ensure(`folds|${color}|${period}`, (id) => {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="${period}" y2="0" spreadMethod="repeat">
      <stop offset="0" stop-color="${darken(color, 0.35)}"/><stop offset="0.35" stop-color="${lighten(color, 0.12)}"/>
      <stop offset="0.55" stop-color="${color}"/><stop offset="1" stop-color="${darken(color, 0.35)}"/></linearGradient>`;
  });
  return `url(#${id})`;
}

function curtainQuad(s: Scene, x0: number, x1: number, y0: number, y1: number, z: number, color: string, period = 0.05, layer = 0.7): void {
  const pr = s.projectPoly([
    [x0, y0, z],
    [x1, y0, z],
    [x1, y1, z],
    [x0, y1, z],
  ]);
  if (!pr) return;
  s.raw(`<polygon points="${pts(pr.pts)}" fill="${folds(s, color, period)}"/>`, layer);
}

/** Light cone from a fixture to an ellipse on the stage floor. */
function spotCone(s: Scene, from: V3, to: V3, r: number, color = "#ffe2b0", alpha = 0.3): void {
  const a = s.cam.project(from);
  const ring = s.ring(to, r, 24, r * 0.7).map((p) => s.cam.project(p)).filter((p): p is P2 => !!p);
  if (!a || ring.length < 3) return;
  const shape = hull([a, ...ring]);
  const cx = ring.reduce((acc, p) => acc + p[0], 0) / ring.length;
  const cy = ring.reduce((acc, p) => acc + p[1], 0) / ring.length;
  const g = s.defs.linear([[0, color, alpha], [1, color, alpha * 0.25]], a[0], a[1], cx, cy, true);
  s.raw(`<polygon points="${pts(shape)}" fill="${g}" filter="${s.defs.blur(8)}" style="mix-blend-mode:screen"/>`, 2.1);
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  s.raw(ellipseGlow(s.defs, cx, cy, (Math.max(...xs) - Math.min(...xs)) / 2, (Math.max(...ys) - Math.min(...ys)) / 2, color, 0.55), 2.15);
  s.raw(glow(s.defs, a[0], a[1], 40, "#fff6e0", 0.9), 2.3);
}

function micStandSvg(): string {
  return (
    `<path d="M-0.22 0 L0 -0.06 L0.22 0 M0 -0.06 L0 0.02" stroke="#1c1917" stroke-width="0.02" fill="none" stroke-linecap="round"/>` +
    `<rect x="-0.012" y="-1.42" width="0.024" height="1.36" fill="#2b2522"/>` +
    `<rect x="-0.02" y="-0.9" width="0.04" height="0.06" rx="0.01" fill="#3b332d"/>` +
    `<path d="M0 -1.42 L0.12 -1.5" stroke="#2b2522" stroke-width="0.02" stroke-linecap="round"/>` +
    `<g transform="translate(0.12 -1.5) rotate(-30)"><rect x="-0.018" y="-0.1" width="0.036" height="0.12" rx="0.012" fill="#1c1917"/>` +
    `<ellipse cx="0" cy="-0.13" rx="0.032" ry="0.045" fill="#8e9392"/><ellipse cx="-0.008" cy="-0.14" rx="0.012" ry="0.02" fill="#dfe2df" opacity="0.7"/></g>`
  );
}

function stoolSvg(): string {
  return (
    `<path d="M-0.16 0 L-0.1 -0.72 M0.16 0 L0.1 -0.72 M-0.04 0 L-0.03 -0.72 M0.04 0 L0.03 -0.72" stroke="${P.woodDark}" stroke-width="0.025"/>` +
    `<path d="M-0.13 -0.28 H0.13" stroke="${P.woodDark}" stroke-width="0.018"/>` +
    `<ellipse cx="0" cy="-0.74" rx="0.19" ry="0.045" fill="${P.wood}"/><rect x="-0.19" y="-0.76" width="0.38" height="0.03" fill="${P.woodDark}"/>`
  );
}

function uprightPiano(s: Scene, x: number, z: number, y = STAGE_H): void {
  s.group([x, y + 0.6, z], () => {
    s.box([x - 0.75, y, z - 0.32], [x + 0.75, y + 1.25, z + 0.32], { base: "#1f1b19", top: "#2e2825" });
    s.box([x - 0.72, y + 0.72, z - 0.52], [x + 0.72, y + 0.8, z - 0.32], { base: "#f4f1ea", top: "#fbfaf6", front: "#e8e3d8" });
    for (let k = 0; k < 20; k++) {
      const kx = x - 0.66 + k * 0.07;
      s.box([kx, y + 0.8, z - 0.5], [kx + 0.035, y + 0.815, z - 0.4], "#1c1917");
    }
    s.box([x - 0.75, y + 0.8, z - 0.34], [x + 0.75, y + 1.25, z - 0.3], { base: "#241f1c" });
    s.box([x - 0.7, y, z - 0.5], [x - 0.62, y + 0.72, z - 0.32], "#1f1b19");
    s.box([x + 0.62, y, z - 0.5], [x + 0.7, y + 0.72, z - 0.32], "#1f1b19");
  });
}

function speaker(s: Scene, x: number, z: number, y: number): void {
  s.group([x, y + 0.4, z], () => {
    s.rod([x, 0, z], [x, y, z], "#2b2522", 0.035);
    s.box([x - 0.25, y, z - 0.2], [x + 0.25, y + 0.75, z + 0.2], { base: "#262120" });
  });
}

function bistroTable(s: Scene, x: number, z: number, rand: Rand, lit = true): void {
  table(s, {
    x,
    z,
    w: 0.7,
    d: 0.7,
    round: true,
    wood: "#3b2c21",
    decor: () => {
      if (lit) candle(s, [x, 0.76, z], 0.08, 0.5, 0.55, "#d8bb7e");
      if (rand() > 0.4) s.sprite([x + 0.15, 0.76, z - 0.1], `<path d="M-0.035 -0.2 C -0.035 -0.12, -0.01 -0.1, 0 -0.1 C 0.01 -0.1, 0.035 -0.12, 0.035 -0.2Z" fill="#ffffff" fill-opacity="0.3" stroke="#ffffff" stroke-opacity="0.7" stroke-width="0.003"/><path d="M-0.03 -0.16 C -0.028 -0.12, 0.028 -0.12, 0.03 -0.16Z" fill="#8e2a36"/><rect x="-0.003" y="-0.1" width="0.006" height="0.1" fill="#f4f1ea"/>`, { layer: ON_TOP });
    },
  });
  chair(s, { x, z: z - 0.55, facing: "+z", wood: "#2b2522", seat: "#6b2a30", back: "slats" });
  chair(s, { x: x - 0.55, z: z + 0.05, facing: "+x", wood: "#2b2522", seat: "#6b2a30", back: "slats" });
  chair(s, { x: x + 0.55, z: z + 0.05, facing: "-x", wood: "#2b2522", seat: "#6b2a30", back: "slats" });
}

interface StageOpts {
  rand: Rand;
  spots?: boolean;
}

/** Stage, curtains, truss and spots (common to all views). */
function stageSet(s: Scene, o: StageOpts): void {
  const sx0 = -3.4;
  const sx1 = 3.4;
  // platform
  floorShadow(s, sx0, STAGE_Z - 0.2, sx1, STAGE_Z + 0.3, 0.4, 8);
  s.box([sx0, 0, STAGE_Z], [sx1, STAGE_H, R.z1], { base: "#2a2320", top: "#4a3a2c", front: "#221c19" }, { layer: 0.62 });
  for (let x = sx0 + 0.3; x < sx1; x += 0.3) s.line([x, 0.02, STAGE_Z - 0.003], [x, STAGE_H - 0.02, STAGE_Z - 0.003], "#3a302a", 1.2, { layer: 0.63 });
  s.box([-0.9, 0, STAGE_Z - 0.35], [0.9, STAGE_H / 2, STAGE_Z], { base: "#2a2320", top: "#4a3a2c" }, { layer: 0.64 });
  // stage floor boards
  for (let x = sx0 + 0.2; x < sx1; x += 0.2) s.line([x, STAGE_H + 0.001, STAGE_Z], [x, STAGE_H + 0.001, R.z1], "#3d3026", 0.8, { layer: 0.65, opacity: 0.7 });
  // backdrop + side curtains + valance
  curtainQuad(s, sx0, sx1, STAGE_H, R.h, R.z1 - 0.05, BACKDROP, 0.04, 0.66);
  curtainQuad(s, sx0 - 0.9, sx0 + 0.75, 0, R.h, STAGE_Z + 0.1, CURTAIN, 0.12, 0.72);
  curtainQuad(s, sx1 - 0.75, sx1 + 0.9, 0, R.h, STAGE_Z + 0.1, CURTAIN, 0.12, 0.72);
  // swag valance
  const top = R.h;
  const pts3: V3[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const x = sx0 - 0.9 + (sx1 - sx0 + 1.8) * t;
    const sag = 0.25 * Math.abs(Math.sin(t * Math.PI * 3));
    pts3.push([x, top - 0.5 - sag, STAGE_Z + 0.05]);
  }
  const outline = [[sx0 - 0.9, top, STAGE_Z + 0.05] as V3, ...pts3, [sx1 + 0.9, top, STAGE_Z + 0.05] as V3];
  const pr = s.projectPoly(outline);
  if (pr) s.raw(`<polygon points="${pts(pr.pts)}" fill="${folds(s, darken(CURTAIN, 0.05), 0.02)}"/>`, 0.73);
  // gold trim line along the valance
  const trim = pts3.map((p) => s.cam.project(p)).filter((p): p is P2 => !!p);
  s.raw(`<polyline points="${pts(trim)}" fill="none" stroke="${P.gold}" stroke-width="3" stroke-opacity="0.85"/>`, 0.74);
  // mic, stool, piano, speakers
  s.sprite([0.1, STAGE_H, STAGE_Z + 1.2], micStandSvg(), { layer: 0.8 });
  s.sprite([0.75, STAGE_H, STAGE_Z + 1.6], stoolSvg(), { layer: 0.79 });
  uprightPiano(s, 2.1, STAGE_Z + 2.6);
  speaker(s, -3.7, STAGE_Z - 0.6, 1.9);
  speaker(s, 3.7, STAGE_Z - 0.6, 1.9);
  // truss
  s.box([-3.8, 3.25, STAGE_Z - 0.9], [3.8, 3.4, STAGE_Z - 0.75], { base: "#2b2522" }, { layer: 0.9 });
  for (let x = -3.8; x < 3.8; x += 0.3) s.line([x, 3.25, STAGE_Z - 0.82], [x + 0.3, 3.4, STAGE_Z - 0.82], "#4a423c", 1, { layer: 0.91 });
  if (o.spots !== false) {
    const fixtures: Array<[number, V3, string]> = [
      [-2.4, [-1.3, STAGE_H, STAGE_Z + 1.8], "#ffd9a8"],
      [-0.8, [0.1, STAGE_H, STAGE_Z + 1.2], "#fff0d4"],
      [0.8, [0.2, STAGE_H, STAGE_Z + 1.4], "#fff0d4"],
      [2.4, [1.8, STAGE_H, STAGE_Z + 2.2], "#f3c9d4"],
    ];
    for (const [x, target, col] of fixtures) {
      s.cyl([x, 3.08, STAGE_Z - 0.82], 0.1, 0.1, 0.18, { side: "#1c1917", bottom: "#fff6e0" }, { layer: 0.92 });
      spotCone(s, [x, 3.08, STAGE_Z - 0.82], target, 0.75, col, 0.28);
    }
  }
}

function hall(s: Scene, rand: Rand): void {
  room(s, { ...R, wall: WALL, floor: FLOOR, floorKind: "planks", plank: 0.2, ceiling: "#2e2825", seed: rand, skirting: "#2b2522" });
  // acoustic wall panels
  for (const side of ["left", "right"] as const) {
    const x = side === "left" ? R.x0 + 0.01 : R.x1 - 0.01;
    for (let z = 0.5; z < STAGE_Z - 1; z += 1.6) {
      s.poly([[x, 0.9, z], [x, 0.9, z + 1.3], [x, 2.9, z + 1.3], [x, 2.9, z]], side === "left" ? "#564a40" : "#4d423a", { layer: 0.3, stroke: "#6a5b4e", strokeWidth: 1 });
    }
  }
  for (const z of [1.5, 4.5]) {
    for (const x of [R.x0 + 0.06, R.x1 - 0.06]) {
      const p: V3 = [x, 2.4, z];
      const c = s.cam.project(p);
      if (c) s.raw(ellipseGlow(s.defs, c[0], c[1], 0.35 * s.cam.scaleAt(p), 0.8 * s.cam.scaleAt(p), "#ffc987", 0.4), 2.2);
    }
  }
}

// ---------------------------------------------------------------------------

function hero(): string {
  const rand = mulberry32(81);
  const s = makeScene({ pos: [0.3, 1.45, 0], yaw: -1, fov: 70, horizon: 0.47 }, { haze: "#2b2320", hazeNear: 4, hazeFar: 14, hazeMax: 0.25, light: [0, 0.6, 0.8] });
  hall(s, rand);
  stageSet(s, { rand });
  for (const [x, z] of [[-2.4, 2.4], [0.2, 2.2], [2.6, 2.6], [-1.2, 4.6], [1.5, 4.8], [-3.0, 5.2], [3.2, 5.4]] as const) bistroTable(s, x, z, rand);
  eveningGrade(s, 0.55, "#4a3a30");
  s.raw(`<rect width="1600" height="1067" fill="${s.defs.radial([[0, "#ffd9a8", 0.18], [1, "#ffd9a8", 0]], 0.5, 0.5, 0.5)}" style="mix-blend-mode:screen"/>`, 2.05);
  return compose(s, { background: "#1c1917", vignette: 0.5, grain: 0.2, grade: "#ffb870", gradeOpacity: 0.1 });
}

/** Large vocal microphone drawn in screen space (for the close-up). */
function bigMic(s: Scene, cx: number, cy: number, k: number): string {
  const mesh = s.defs.ensure("mic-mesh", (id) =>
    `<pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#9ea3a2"/><path d="M0 0.5H7M0.5 0V7" stroke="#5f6463" stroke-width="1.2"/></pattern>`,
  );
  const sheen = s.defs.radial([[0, "#ffffff", 0.75], [0.5, "#ffffff", 0.1], [1, "#ffffff", 0]], 0.35, 0.3, 0.6);
  const body = s.defs.linear([[0, "#111", 1], [0.35, "#3a3634", 1], [0.6, "#1c1917", 1], [1, "#0c0a09", 1]], 0, 0, 1, 0);
  const n = (v: number) => (v * k).toFixed(1);
  return `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(-28)">
    <rect x="${n(-6)}" y="${n(60)}" width="${n(12)}" height="${n(600)}" fill="#1f1b19"/>
    <path d="M${n(-26)} ${n(40)} L${n(-20)} ${n(96)} H${n(20)} L${n(26)} ${n(40)}Z" fill="#2b2522"/>
    <rect x="${n(-22)} " y="${n(-60)}" width="${n(44)}" height="${n(110)}" rx="${n(10)}" fill="${body}"/>
    <path d="M${n(-30)} ${n(-66)} Q 0 ${n(-80)} ${n(30)} ${n(-66)} L${n(24)} ${n(-54)} H${n(-24)}Z" fill="#5f6463"/>
    <rect x="${n(-31)}" y="${n(-72)}" width="${n(62)}" height="${n(10)}" rx="${n(4)}" fill="#b8bcbb"/>
    <ellipse cx="0" cy="${n(-118)}" rx="${n(48)}" ry="${n(52)}" fill="url(#${mesh})"/>
    <ellipse cx="0" cy="${n(-118)}" rx="${n(48)}" ry="${n(52)}" fill="${sheen}"/>
    <ellipse cx="0" cy="${n(-118)}" rx="${n(48)}" ry="${n(52)}" fill="none" stroke="#d6d9d8" stroke-width="${n(3)}"/>
    <path d="M${n(-46)} ${n(-104)} Q 0 ${n(-92)} ${n(46)} ${n(-104)}" stroke="#d6d9d8" stroke-width="${n(3)}" fill="none"/>
    <path d="M${n(-8)} ${n(-40)} V${n(30)}" stroke="#ffffff" stroke-opacity="0.18" stroke-width="${n(5)}"/>
  </g>`;
}

/** Microphone close-up, stage and spots out of focus. */
function micDetail(): string {
  const rand = mulberry32(83);
  const cam = lookAt([0.3, STAGE_H + 1.45, STAGE_Z + 1.2], 2.4, 6, 18, 50, { horizon: 0.45 });
  const fg = makeScene(cam, {});
  const bg = makeScene(cam, { haze: "#2b2320", hazeNear: 2, hazeFar: 10, hazeMax: 0.2 }, fg.defs);
  hall(bg, rand);
  stageSet(bg, { rand });
  eveningGrade(bg, 0.45, "#4a3a30");
  bokeh(fg, rand, 20, [0, 0, 1600, 640], 18, 64, ["#ffd9a8", "#fff0d4", "#f3c9d4", "#ffcf85"], 0.32);
  const mic = bigMic(fg, 930, 520, 1.9);
  const rim = glow(fg.defs, 1010, 310, 260, "#fff0d4", 0.28);
  const body =
    `<rect width="1600" height="1067" fill="#1c1917"/>` +
    `<g filter="${fg.defs.blur(10)}">${bg.render()}</g>` +
    fg.render() +
    rim +
    mic;
  return svgDoc(fg.defs, body + finish(fg.defs, { vignette: 0.55, grain: 0.2, grade: "#ffb870", gradeOpacity: 0.12 }));
}

/** Side angle with piano, speakers and truss. */
function sideAngle(): string {
  const rand = mulberry32(87);
  const s = makeScene({ pos: [-3.5, 1.65, 3.4], yaw: 34, fov: 70, horizon: 0.5 }, { haze: "#2b2320", hazeNear: 3, hazeFar: 13, hazeMax: 0.22, light: [0.3, 0.6, 0.7] });
  hall(s, rand);
  stageSet(s, { rand });
  for (const [x, z] of [[-1.6, 4.6], [0.9, 4.9], [2.8, 3.8], [0.3, 2.3], [2.6, 1.4]] as const) bistroTable(s, x, z, rand);
  eveningGrade(s, 0.55, "#4a3a30");
  return compose(s, { background: "#1c1917", vignette: 0.5, grain: 0.2, grade: "#ffb870", gradeOpacity: 0.1 });
}

/** View from the stage into the room: candle-lit tables, bar at the back. */
function fromStage(): string {
  const rand = mulberry32(89);
  const s = makeScene({ pos: [-0.4, 2.05, 9.4], yaw: 180, pitch: 6, fov: 72, horizon: 0.5 }, { haze: "#2b2320", hazeNear: 3, hazeFar: 13, hazeMax: 0.25, light: [0, 0.7, -0.7] });
  hall(s, rand);
  // wall behind the audience (z0 side)
  const z = -1.2;
  s.poly([[R.x0, 0, z], [R.x1, 0, z], [R.x1, R.h, z], [R.x0, R.h, z]], s.shade(WALL, [0, 0, 1]), { layer: 0.25 });
  // bar with glowing back shelves
  s.box([-2.6, 0, z + 0.9], [0.6, 1.1, z + 1.5], { base: P.woodDark, top: "#6b513a" }, { layer: 0.9 });
  for (const y of [1.3, 1.7, 2.1]) {
    s.box([-2.6, y, z + 0.02], [0.6, y + 0.04, z + 0.3], { base: "#3a2c21" }, { layer: 0.4 });
    for (let x = -2.4; x < 0.5; x += 0.18) s.sprite([x, y + 0.04, z + 0.15], `<path d="M-0.03 0 V-0.16 Q -0.03 -0.2 -0.01 -0.21 V-0.26 H0.01 V-0.21 Q 0.03 -0.2 0.03 -0.16 V0Z" fill="${["#3f5a3a", "#8e2a36", "#c49a2c", "#e8dfcd"][Math.floor(rand() * 4)]}" opacity="0.9"/>`, { layer: 0.41 });
    const c = s.cam.project([-1.0, y + 0.2, z + 0.1]);
    if (c) s.raw(ellipseGlow(s.defs, c[0], c[1], 220, 40, "#ffc987", 0.45), 2.2);
  }
  // door with exit light
  s.box([2.0, 0, z], [3.1, 2.2, z + 0.06], { base: "#2b2522" }, { layer: 0.3 });
  for (const [x, zz] of [[-2.2, 2.0], [0.4, 1.8], [2.6, 2.3], [-1.0, 4.2], [1.6, 4.6], [-3.1, 5.0], [3.2, 5.3]] as const) bistroTable(s, x, zz, rand);
  // stage edge in the foreground
  s.box([-4.2, 0, STAGE_Z], [4.2, STAGE_H, R.z1], { base: "#2a2320", top: "#4a3a2c" }, { layer: 1.4 });
  s.sprite([0.2, STAGE_H, 8.3], stoolSvg(), { layer: 1.45 });
  eveningGrade(s, 0.55, "#4a3a30");
  // spot flares from the truss above the camera
  for (const x of [-2.6, -0.9, 0.8, 2.5]) {
    const p: V3 = [x, 3.1, STAGE_Z - 0.8];
    const cc = s.cam.project(p);
    if (cc) {
      s.raw(glow(s.defs, cc[0], Math.min(cc[1], 30), 180, "#fff0d4", 0.35), 2.6);
    }
  }
  s.raw(`<rect width="1600" height="1067" fill="${s.defs.linear([[0, "#ffe2b0", 0.22], [0.5, "#ffe2b0", 0]])}" style="mix-blend-mode:screen"/>`, 2.55);
  return compose(s, { background: "#1c1917", vignette: 0.5, grain: 0.2, grade: "#ffb870", gradeOpacity: 0.1 });
}

export const stage: SpaceScenes = {
  folder: "stage",
  label: "Bühne",
  tour: true,
  shots: [
    { name: "hero", title: "Bühne mit Vorhang und Spots", render: hero },
    { name: "gallery-01", title: "Mikrofon im Scheinwerferlicht", render: micDetail },
    { name: "gallery-02", title: "Seitlicher Blick mit Klavier", render: sideAngle },
    { name: "gallery-03", title: "Blick von der Bühne in den Saal", render: fromStage },
  ],
};
