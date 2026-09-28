import { darken, lighten, P } from "../lib/color";
import { lookAt, ON_FLAT, ON_TOP, type Scene, type V3 } from "../lib/persp";
import { floorShadow, hangingPanSvg, leafySvg, lightShaft, room, steam, wallGrid, windowOn } from "../lib/props";
import { mulberry32, type Rand } from "../lib/rand";
import { ellipseGlow, glow, pts } from "../lib/svg";
import { compose, makeScene, type SpaceScenes } from "./common";

const STEEL = "#c4c7c5";
const STEEL_TOP = "#e2e4e1";
const TILE = "#f3efe6";
const ACCENT_TILE = "#7f8b6c";
const FLOOR = "#94664f";

interface CounterOpts {
  doors?: "x" | "z";
  top?: string;
  decor?: () => void;
}

/** Stainless counter with doors, toe-kick and optional items on top (same draw group). */
function counter(s: Scene, x0: number, x1: number, z0: number, z1: number, h = 0.9, opts: CounterOpts = {}): void {
  floorShadow(s, x0, z0, x1 + 0.08, z1 + 0.08, 0.3, 5);
  s.group([(x0 + x1) / 2, h / 2, (z0 + z1) / 2], () => {
    s.box([x0 + 0.04, 0, z0 + 0.04], [x1 - 0.04, 0.12, z1 - 0.04], darken(STEEL, 0.45));
    s.box([x0, 0.12, z0], [x1, h - 0.04, z1], { base: STEEL });
    s.box([x0 - 0.02, h - 0.04, z0 - 0.02], [x1 + 0.02, h, z1 + 0.02], { base: STEEL, top: opts.top ?? STEEL_TOP });
    const along = opts.doors ?? (x1 - x0 > z1 - z0 ? "x" : "z");
    if (along === "x") {
      const zf = s.cam.pos[2] < z0 ? z0 - 0.003 : z1 + 0.003;
      for (let x = x0 + 0.6; x < x1 - 0.1; x += 0.6) s.line([x, 0.14, zf], [x, h - 0.06, zf], darken(STEEL, 0.3), 1);
      for (let x = x0 + 0.3; x < x1; x += 0.6) s.line([x - 0.12, h - 0.14, zf], [x + 0.12, h - 0.14, zf], lighten(STEEL, 0.4), 2.2);
    } else {
      const xf = s.cam.pos[0] < x0 ? x0 - 0.003 : x1 + 0.003;
      for (let z = z0 + 0.6; z < z1 - 0.1; z += 0.6) s.line([xf, 0.14, z], [xf, h - 0.06, z], darken(STEEL, 0.3), 1);
      for (let z = z0 + 0.3; z < z1; z += 0.6) s.line([xf, h - 0.14, z - 0.12], [xf, h - 0.14, z + 0.12], lighten(STEEL, 0.4), 2.2);
    }
    opts.decor?.();
  });
}

function pot(s: Scene, p: V3, r: number, h: number, color = STEEL, lid = true, layer = ON_TOP): void {
  s.group(
    [p[0], p[1] + h / 2, p[2]],
    () => {
      s.cyl(p, r, r, h, { side: color, top: lid ? lighten(color, 0.12) : darken(color, 0.45) });
      if (lid) s.cyl([p[0], p[1] + h, p[2]], 0.02, 0.02, 0.03, { side: P.inkSoft, top: P.inkSoft });
      s.box([p[0] - r - 0.05, p[1] + h - 0.05, p[2] - 0.012], [p[0] - r, p[1] + h - 0.03, p[2] + 0.012], darken(color, 0.1));
      s.box([p[0] + r, p[1] + h - 0.05, p[2] - 0.012], [p[0] + r + 0.05, p[1] + h - 0.03, p[2] + 0.012], darken(color, 0.1));
    },
    layer,
  );
}

function pan(s: Scene, p: V3, r: number, color = "#3b3633", handleDir: [number, number] = [1, 0], food?: string): void {
  s.group(
    [p[0], p[1] + 0.03, p[2]],
    () => {
      s.cyl(p, r * 0.9, r, 0.05, { side: color, top: darken(color, 0.35) });
      if (food) s.disc([p[0], p[1] + 0.046, p[2]], r * 0.75, food, { layer: ON_FLAT });
      s.rod([p[0] + handleDir[0] * r, p[1] + 0.045, p[2] + handleDir[1] * r], [p[0] + handleDir[0] * (r + 0.22), p[1] + 0.07, p[2] + handleDir[1] * (r + 0.22)], P.inkSoft, 0.022);
    },
    ON_TOP,
  );
}

function burner(s: Scene, x: number, z: number, h: number, r = 0.12): void {
  s.disc([x, h + 0.004, z], r, "#2b2724", { layer: ON_FLAT });
  s.disc([x, h + 0.008, z], r * 0.58, "#48423d", { layer: ON_FLAT, bias: -0.001 });
}

function ceilingPanels(s: Scene, zs: number[], h: number, xw = 0.6, zw = 1.2): void {
  for (const z of zs) {
    const q: V3[] = [
      [-xw / 2, h - 0.01, z],
      [xw / 2, h - 0.01, z],
      [xw / 2, h - 0.01, z + zw],
      [-xw / 2, h - 0.01, z + zw],
    ];
    const pr = s.projectPoly(q);
    if (!pr) continue;
    s.raw(`<polygon points="${pts(pr.pts)}" fill="#fffdf6" stroke="#dcd7cc" stroke-width="2"/>`, 0.55);
    const c = pr.pts.reduce((a, p) => [a[0] + p[0] / pr.pts.length, a[1] + p[1] / pr.pts.length], [0, 0]);
    s.raw(ellipseGlow(s.defs, c[0], c[1], 260, 90, "#fff8e6", 0.35), 2.2);
  }
}

function herbsSvg(rand: Rand, w = 0.25): string {
  return (
    `<ellipse cx="0" cy="-0.02" rx="${w * 0.44}" ry="${w * 0.12}" fill="#e9e3d6"/>` +
    `<g transform="translate(0 -0.04)">${leafySvg(rand, w, w * 0.56, ["#5f7a47", "#6d8752", "#8fa46c"], 28, "round")}</g>`
  );
}

function kitchenRoom(s: Scene, rand: Rand, R: { x0: number; x1: number; z0: number; z1: number; h: number }, back = ACCENT_TILE): void {
  room(s, { ...R, wall: TILE, wallBack: back, floor: FLOOR, floorKind: "tiles", tile: 0.3, ceiling: "#f4f1ea", seed: rand, skirting: "#6f4e3d" });
  wallGrid(s, "left", R.x0, Math.max(R.z0, 0), R.z1, 0.1, 2.2, 0.3, 0.15, "#d9d3c7", 0.7, 0.8, true);
  wallGrid(s, "right", R.x1, Math.max(R.z0, 0), R.z1, 0.1, 2.2, 0.3, 0.15, "#d9d3c7", 0.7, 0.8, true);
  wallGrid(s, "back", R.z1, R.x0, R.x1, 0.1, 2.2, 0.3, 0.15, lighten(back, 0.25), 0.8, 0.8, true);
}

// ---------------------------------------------------------------------------

function hero(): string {
  const rand = mulberry32(41);
  const s = makeScene({ pos: [0.1, 1.62, 0], yaw: 2, fov: 76, horizon: 0.47 }, { haze: "#f3efe6", hazeNear: 3, hazeFar: 16, hazeMax: 0.16, light: [0.1, 0.9, -0.3], shadeDark: 0.34 });
  const R = { x0: -3.2, x1: 3.2, z0: -1, z1: 9.5, h: 3.1 };
  kitchenRoom(s, rand, R);
  const g = windowOn(s, { side: "back", plane: R.z1, u0: -1.1, u1: 1.1, v0: 1.3, v1: 2.6, cols: 3, rows: 2, mood: "day", wall: ACCENT_TILE, sill: "none" }, 3);
  lightShaft(s, g, [0.05, -0.55, -0.83], { alpha: 0.2, floorAlpha: 0.4, blur: 16 });

  // left prep line with wall shelves
  counter(s, R.x0, R.x0 + 0.72, 0.6, 8.8, 0.9, {
    doors: "z",
    decor: () => {
      s.box([R.x0 + 0.1, 0.9, 2.2], [R.x0 + 0.62, 0.93, 2.75], { base: P.woodLight, top: lighten(P.woodLight, 0.1) }, { layer: ON_TOP });
      s.sprite([R.x0 + 0.36, 0.93, 3.2], herbsSvg(rand), { layer: ON_TOP });
      pot(s, [R.x0 + 0.36, 0.9, 5.0], 0.16, 0.22, "#b06a3b");
      s.sprite([R.x0 + 0.4, 0.9, 6.6], `<rect x="-0.12" y="-0.14" width="0.24" height="0.14" fill="#f7f5ef"/><rect x="-0.12" y="-0.14" width="0.24" height="0.02" fill="#e3e0d8"/><rect x="-0.12" y="-0.1" width="0.24" height="0.02" fill="#e3e0d8"/><rect x="-0.12" y="-0.06" width="0.24" height="0.02" fill="#e3e0d8"/>`, { layer: ON_TOP });
    },
  });
  for (let z = 1.2; z < 8.6; z += 2.4) {
    s.box([R.x0, 1.62, z], [R.x0 + 0.38, 1.66, z + 2.0], { base: STEEL, top: STEEL_TOP }, { layer: 0.8 });
    for (let k = 0; k < 4; k++) s.cyl([R.x0 + 0.18, 1.66, z + 0.25 + k * 0.45], 0.1, 0.1, 0.2 + rand() * 0.12, { side: k % 2 ? "#dfe2df" : "#ece7da", top: "#f6f3ec" }, { layer: 0.81 });
  }

  // right cooking line + hood
  counter(s, R.x1 - 0.8, R.x1, 0.8, 8.6, 0.9, {
    doors: "z",
    top: "#b3b6b4",
    decor: () => {
      let i = 0;
      for (let z = 1.9; z < 5.2; z += 0.55) {
        for (const x of [R.x1 - 0.6, R.x1 - 0.22]) {
          burner(s, x, z, 0.9);
          if (i % 3 === 0) pot(s, [x, 0.9, z], 0.15, 0.24);
          else if (i % 3 === 1) pan(s, [x, 0.9, z], 0.13, "#3b3633", [-1, 0], i % 2 ? "#c98d4a" : "#8a9a5b");
          if (i % 3 === 0) steam(s, [x, 1.2, z], rand, 0.6, 0.3);
          i++;
        }
      }
    },
  });
  s.box([R.x1 - 1.05, 2.15, 1.0], [R.x1, 2.75, 8.4], { base: STEEL, bottom: darken(STEEL, 0.3) }, { bias: 6 });
  s.box([R.x1 - 1.08, 2.1, 1.0], [R.x1 - 0.98, 2.2, 8.4], lighten(STEEL, 0.1), { bias: 6 });
  for (let z = 1.6; z < 8.2; z += 1.4) {
    const p: V3 = [R.x1 - 0.6, 2.14, z + 0.3];
    const c = s.cam.project(p);
    if (c) s.raw(ellipseGlow(s.defs, c[0], c[1], 0.35 * s.cam.scaleAt(p), 0.12 * s.cam.scaleAt(p), "#fff4d6", 0.6), 2.2);
  }

  // island with pot rack
  counter(s, -0.85, 0.85, 3.4, 6.6, 0.92, {
    doors: "x",
    decor: () => {
      s.box([-0.6, 0.92, 3.7], [0.1, 0.95, 4.2], { base: P.woodLight, top: lighten(P.woodLight, 0.12) }, { layer: ON_TOP });
      s.sprite([0.45, 0.92, 4.2], herbsSvg(rand), { layer: ON_TOP });
      pot(s, [0.3, 0.92, 5.6], 0.16, 0.26, "#b06a3b", false);
      s.sprite([-0.4, 0.92, 5.2], `<ellipse cx="0" cy="-0.02" rx="0.12" ry="0.03" fill="#f2eee6"/><circle cx="-0.04" cy="-0.05" r="0.035" fill="#e9c46a"/><circle cx="0.03" cy="-0.05" r="0.035" fill="#e2b64f"/><circle cx="0" cy="-0.08" r="0.035" fill="#ecc964"/>`, { layer: ON_TOP });
    },
  });
  for (const x of [-0.7, 0.7]) s.rod([x, R.h, 5.0], [x, 2.25, 5.0], P.steelDark, 0.02, { bias: -3 });
  s.rod([-0.7, 2.25, 5.0], [0.7, 2.25, 5.0], P.steelDark, 0.03, { bias: -3 });
  for (let k = 0; k < 5; k++) {
    s.sprite([-0.5 + k * 0.25, 2.25, 5.0], hangingPanSvg(0.09 + (k % 2) * 0.03, k % 2 ? "#b06a3b" : "#7c7f7d"), { bias: -3 });
  }

  // back wall shelving + counter
  for (const y of [0.45, 1.05]) s.box([-3.0, y, R.z1 - 0.45], [-1.4, y + 0.04, R.z1 - 0.02], { base: STEEL, top: STEEL_TOP }, { layer: 0.8 });
  for (let k = 0; k < 4; k++) pot(s, [-2.8 + k * 0.4, 1.09, R.z1 - 0.25], 0.14, 0.18 + (k % 2) * 0.08, k % 2 ? STEEL : "#b06a3b", true, 0.81);
  for (let k = 0; k < 3; k++) s.cyl([-2.7 + k * 0.5, 0.49, R.z1 - 0.25], 0.18, 0.18, 0.1, { side: "#ece7da", top: "#f6f3ec" }, { layer: 0.81 });
  counter(s, 1.4, 2.4, R.z1 - 0.7, R.z1, 0.9, { doors: "x", decor: () => s.sprite([1.9, 0.9, R.z1 - 0.35], herbsSvg(rand, 0.35), { layer: ON_TOP }) });
  ceilingPanels(s, [1.5, 4.0, 6.5], R.h);
  return compose(s, { background: TILE, vignette: 0.26, grain: 0.14, grade: "#f5e0c0", gradeOpacity: 0.12 });
}

/** Range with copper & steel pans, steam, hood lip above. */
function rangeDetail(): string {
  const rand = mulberry32(43);
  const s = makeScene(lookAt([0, 1.02, 1.12], 2.7, 38, 0, 50, { horizon: 0.6 }), { light: [-0.3, 0.9, -0.3], shadeDark: 0.32 });
  const R = { x0: -3, x1: 3, z0: -2, z1: 1.5, h: 3 };
  room(s, { ...R, wall: ACCENT_TILE, floor: FLOOR, floorKind: "tiles", ceiling: "#f4f1ea", noLeft: true, noRight: true });
  wallGrid(s, "back", R.z1, R.x0, R.x1, 0.9, 2.3, 0.3, 0.15, lighten(ACCENT_TILE, 0.25), 1, 0.85, true);
  const h = 0.9;
  counter(s, -2.4, 2.4, 0.7, 1.5, h, {
    doors: "x",
    top: "#b3b6b4",
    decor: () => {
      const spots: Array<[number, number]> = [[-1.35, 0.95], [-0.45, 1.2], [0.45, 0.95], [1.35, 1.2]];
      for (const [x, z] of spots) burner(s, x, z, h, 0.16);
      pot(s, [-1.35, h, 0.95], 0.2, 0.28, "#b06a3b");
      pan(s, [-0.45, h, 1.2], 0.18, "#3b3633", [0.25, -1], "#c98d4a");
      pot(s, [0.45, h, 0.95], 0.17, 0.2, STEEL, false);
      s.disc([0.45, h + 0.19, 0.95], 0.15, "#d9b36a", { layer: ON_TOP + 0.01 });
      pan(s, [1.35, h, 1.2], 0.18, "#b06a3b", [0.35, -1], "#8a9a5b");
      s.box([-2.2, h, 0.85], [-1.8, h + 0.03, 1.3], { base: P.woodLight, top: lighten(P.woodLight, 0.1) }, { layer: ON_TOP });
      s.sprite([2.0, h, 1.0], herbsSvg(rand, 0.3), { layer: ON_TOP });
    },
  });
  for (const [x, z] of [[-1.35, 0.95], [0.45, 0.95], [1.35, 1.2], [-0.45, 1.2]] as const) steam(s, [x, h + 0.3, z], rand, 0.6, 0.3);
  for (const [x, z] of [[-1.35, 0.95], [-0.45, 1.2], [0.45, 0.95], [1.35, 1.2]] as const) {
    const p: V3 = [x, h + 0.01, z - 0.2];
    const c = s.cam.project(p);
    if (c) s.raw(ellipseGlow(s.defs, c[0], c[1], 0.3 * s.cam.scaleAt(p), 0.05 * s.cam.scaleAt(p), "#8fb8ff", 0.3), 2.2);
  }
  // stainless backsplash shelf with salt boxes & oil
  s.box([-2.4, 1.18, 1.3], [2.4, 1.21, 1.5], { base: STEEL, top: STEEL_TOP }, { layer: 0.8 });
  for (let k = 0; k < 9; k++) {
    const x = -2.1 + k * 0.52;
    const col = ["#efe9dc", "#b06a3b", "#dfe2df", "#8e9a4a", "#efe9dc", "#c98d4a", "#dfe2df", "#efe9dc", "#b06a3b"][k] ?? "#efe9dc";
    s.sprite([x, 1.21, 1.4], k % 3 === 1 ? `<path d="M-0.035 0 V-0.17 Q -0.035 -0.2 -0.012 -0.21 V-0.26 H0.012 V-0.21 Q 0.035 -0.2 0.035 -0.17 V0Z" fill="${col}" opacity="0.92"/>` : `<rect x="-0.05" y="-0.11" width="0.1" height="0.11" rx="0.012" fill="${col}" stroke="#cfc8ba" stroke-width="0.003"/>`, { layer: 0.85 });
  }
  return compose(s, { background: TILE, vignette: 0.34, grain: 0.14, grade: "#f5e0c0", gradeOpacity: 0.12 });
}

/** The pass: heat lamps, plated dishes, ticket rail. */
function pass(): string {
  const rand = mulberry32(47);
  const s = makeScene({ pos: [-1.0, 1.62, -1.6], yaw: 12, pitch: 6, fov: 62, horizon: 0.5 }, { haze: "#efe9de", hazeNear: 3, hazeFar: 12, hazeMax: 0.18, shadeDark: 0.34 });
  const R = { x0: -3.4, x1: 3.4, z0: -2.4, z1: 7, h: 3.0 };
  kitchenRoom(s, rand, R, "#3f3a35");
  windowOn(s, { side: "left", plane: R.x0, u0: 3.0, u1: 5.0, v0: 1.2, v1: 2.5, mood: "day", cols: 3, rows: 2, wall: TILE, sill: "none" }, 8);
  // kitchen behind the pass
  counter(s, -3.4, -2.7, 2.6, 6.8, 0.9, { doors: "z" });
  counter(s, 2.6, 3.4, 2.6, 6.8, 0.9, {
    doors: "z",
    top: "#b3b6b4",
    decor: () => {
      pot(s, [3.0, 0.9, 3.4], 0.16, 0.26);
      pot(s, [3.0, 0.9, 4.4], 0.14, 0.2, "#b06a3b");
    },
  });
  steam(s, [3.0, 1.2, 3.4], rand, 0.5, 0.25);
  counter(s, -1.2, 1.2, 4.0, 5.0, 0.9, { doors: "x", decor: () => s.sprite([0.3, 0.9, 4.5], herbsSvg(rand, 0.35), { layer: ON_TOP }) });
  s.box([2.3, 2.1, 2.5], [3.4, 2.7, 6.8], { base: STEEL, bottom: darken(STEEL, 0.25) }, { bias: 4 });
  s.rod([-0.8, 2.3, 4.5], [0.8, 2.3, 4.5], P.steelDark, 0.025);
  for (let k = 0; k < 4; k++) s.sprite([-0.6 + k * 0.4, 2.3, 4.5], hangingPanSvg(0.1, k % 2 ? "#b06a3b" : "#7c7f7d"));
  ceilingPanels(s, [2.5, 5.0], R.h);

  // pass counter across the frame
  const dishes: Array<[number, string, string]> = [
    [-1.8, "#8a9a5b", "#a4553a"],
    [-0.9, "#c98d4a", "#6f9a68"],
    [0.0, "#b0662b", "#e8dfcd"],
    [0.9, "#6f9a68", "#c49a2c"],
    [1.8, "#a4553a", "#8a9a5b"],
  ];
  counter(s, -2.6, 2.8, 1.2, 1.9, 1.0, {
    doors: "x",
    top: "#eef0ed",
    decor: () => {
      for (const [x, a, b] of dishes) {
        s.disc([x, 1.004, 1.55], 0.16, "#fbfaf6", { layer: ON_FLAT, stroke: "#dcd8cf", strokeWidth: 1 });
        s.disc([x - 0.03, 1.008, 1.55], 0.065, a, { layer: ON_FLAT, bias: -0.01 });
        s.disc([x + 0.05, 1.01, 1.52], 0.04, b, { layer: ON_FLAT, bias: -0.02 });
        s.sprite([x + 0.01, 1.01, 1.57], `<path d="M-0.02 0 Q 0 -0.05 0.02 0" fill="#5f7a47"/><circle cx="0.03" cy="-0.01" r="0.01" fill="#a4553a"/>`, { layer: ON_TOP });
      }
      s.sprite([2.45, 1.0, 1.4], `<ellipse cx="0" cy="-0.005" rx="0.05" ry="0.012" fill="${P.goldDark}"/><path d="M-0.04 -0.01 Q -0.04 -0.07 0 -0.075 Q 0.04 -0.07 0.04 -0.01Z" fill="${P.gold}"/><circle cx="0" cy="-0.08" r="0.008" fill="${P.goldDark}"/>`, { layer: ON_TOP });
    },
  });
  // heat lamp gantry
  s.box([-2.6, 1.9, 1.35], [2.8, 1.98, 1.75], { base: STEEL, bottom: darken(STEEL, 0.2) }, { bias: -1 });
  for (const x of [-2.5, 2.7]) s.box([x - 0.04, 1.0, 1.5], [x + 0.04, 1.9, 1.58], STEEL, { bias: -1 });
  for (let x = -1.8; x < 2.6; x += 0.9) {
    s.cyl([x, 1.78, 1.55], 0.1, 0.06, 0.12, { side: STEEL, bottom: "#ffb36b" }, { bias: -1.1 });
    const p: V3 = [x, 1.78, 1.55];
    const c = s.cam.project(p);
    if (c) {
      const sc = s.cam.scaleAt(p);
      s.raw(glow(s.defs, c[0], c[1] + 0.15 * sc, 0.45 * sc, "#ff9c52", 0.35), 2.2);
      const d = s.cam.project([x, 1.0, 1.55]);
      if (d) s.raw(ellipseGlow(s.defs, d[0], d[1], 0.3 * sc, 0.08 * sc, "#ffb36b", 0.45), 2.2);
    }
  }
  // ticket rail
  s.box([-2.5, 1.7, 1.33], [2.7, 1.74, 1.37], { base: STEEL, bottom: darken(STEEL, 0.2) }, { bias: -2 });
  for (let x = -2.2; x < 2.4; x += 0.42 + rand() * 0.2) {
    s.sprite([x, 1.72, 1.35], `<rect x="-0.045" y="0" width="0.09" height="${(0.12 + rand() * 0.06).toFixed(3)}" fill="#fbf8f2" stroke="#e1dbcf" stroke-width="0.003"/><path d="M-0.03 0.03 H0.03 M-0.03 0.05 H0.02 M-0.03 0.07 H0.03" stroke="#b8b0a2" stroke-width="0.004"/>`, { bias: -2.1 });
  }
  return compose(s, { background: TILE, vignette: 0.32, grain: 0.14, grade: "#f5d6b0", gradeOpacity: 0.14 });
}

/** Mise en place: cutting board with vegetables, knife strip, shelf with jars. */
function miseEnPlace(): string {
  const rand = mulberry32(53);
  const s = makeScene(lookAt([0.1, 1.02, 1.02], 1.75, 36, 0, 50, { horizon: 0.6 }), { light: [-0.5, 0.8, -0.4], shadeDark: 0.3 });
  const R = { x0: -3, x1: 3, z0: -2, z1: 1.3, h: 3 };
  room(s, { ...R, wall: TILE, floor: FLOOR, floorKind: "tiles", ceiling: "#f4f1ea", noLeft: true, noRight: true });
  wallGrid(s, "back", R.z1, R.x0, R.x1, 0.92, 2.6, 0.3, 0.15, "#d9d3c7", 1.1, 0.9, true);
  const h = 0.9;
  counter(s, -3, 3, 0.55, 1.3, h, {
    doors: "x",
    decor: () => {
      s.box([-0.55, h, 0.7], [0.35, h + 0.035, 1.15], { base: P.woodLight, top: "#c9a171" }, { layer: ON_TOP - 0.005 });
      const veg = (x: number, z: number, svg: string) => s.sprite([x, h + 0.035, z], svg, { layer: ON_TOP });
      veg(-0.35, 0.95, `<circle cx="0" cy="-0.045" r="0.045" fill="#b8452f"/><circle cx="-0.015" cy="-0.06" r="0.012" fill="#ffffff" opacity="0.35"/><path d="M-0.012 -0.09 L0 -0.078 L0.014 -0.09" stroke="#5f7a47" stroke-width="0.008" fill="none"/>`);
      veg(-0.24, 1.0, `<circle cx="0" cy="-0.04" r="0.04" fill="#c4533a"/><path d="M-0.01 -0.08 L0 -0.07 L0.012 -0.08" stroke="#5f7a47" stroke-width="0.008" fill="none"/>`);
      veg(-0.05, 0.9, `<ellipse cx="0" cy="-0.02" rx="0.07" ry="0.02" fill="#e9c46a"/><ellipse cx="0.07" cy="-0.02" rx="0.012" ry="0.02" fill="#f4e3b5"/>`);
      veg(0.15, 0.98, `<g transform="translate(0 -0.02)">${leafySvg(rand, 0.18, 0.1, ["#5f7a47", "#6d8752", "#8fa46c"], 24, "round")}</g>`);
      veg(0.05, 1.08, `<ellipse cx="0" cy="-0.035" rx="0.06" ry="0.035" fill="#efe1c0"/><ellipse cx="0" cy="-0.04" rx="0.04" ry="0.02" fill="#f7eedb"/>`);
      s.poly([[-0.1, h + 0.037, 0.78], [0.2, h + 0.037, 0.8], [0.2, h + 0.037, 0.83], [-0.1, h + 0.037, 0.82]], "#dfe2df", { layer: ON_TOP - 0.004, stroke: "#a9adaa", strokeWidth: 0.6 });
      s.poly([[0.2, h + 0.037, 0.8], [0.32, h + 0.037, 0.81], [0.32, h + 0.037, 0.83], [0.2, h + 0.037, 0.83]], P.inkSoft, { layer: ON_TOP - 0.004 });
      s.cyl([0.75, h, 0.95], 0.1, 0.16, 0.09, { side: "#f2eee6", top: "#e0c27a" }, { layer: ON_TOP });
      s.cyl([1.15, h, 1.05], 0.08, 0.12, 0.07, { side: "#f2eee6", top: "#a4553a" }, { layer: ON_TOP });
      pot(s, [-0.85, h, 1.02], 0.17, 0.2, "#b06a3b", false);
      s.disc([-0.85, h + 0.16, 1.02], 0.15, "#d9b36a", { layer: ON_TOP + 0.01 });
      s.sprite([1.55, h, 1.1], `<path d="M-0.035 0 V-0.17 Q -0.035 -0.2 -0.012 -0.21 V-0.26 H0.012 V-0.21 Q 0.035 -0.2 0.035 -0.17 V0Z" fill="#8e9a4a" opacity="0.9"/><rect x="-0.035" y="-0.12" width="0.07" height="0.05" fill="#efe2c4"/>`, { layer: ON_TOP });
      s.sprite([1.72, h, 1.12], `<rect x="-0.035" y="-0.09" width="0.07" height="0.09" rx="0.01" fill="#f4f1ea" stroke="#d6d0c4" stroke-width="0.003"/>`, { layer: ON_TOP });
      s.sprite([-1.8, h, 1.05], `<ellipse cx="0" cy="-0.02" rx="0.16" ry="0.035" fill="#f2eee6"/><circle cx="-0.05" cy="-0.05" r="0.04" fill="#e9c46a"/><circle cx="0.04" cy="-0.05" r="0.04" fill="#e2b64f"/><circle cx="0" cy="-0.085" r="0.04" fill="#ecc964"/>`, { layer: ON_TOP });
    },
  });
  // magnetic knife strip on the wall
  s.box([-0.7, 1.18, R.z1 - 0.03], [0.5, 1.23, R.z1], { base: "#3b3633" }, { layer: 0.8 });
  for (let k = 0; k < 7; k++) {
    const x = -0.6 + k * 0.17;
    const len = 0.18 + (k % 3) * 0.05;
    s.sprite([x, 1.23, R.z1 - 0.035], `<rect x="-0.012" y="-0.1" width="0.024" height="0.11" rx="0.006" fill="${k % 2 ? P.woodDark : P.inkSoft}"/><path d="M-0.014 0.01 H0.014 L0.01 ${len} Q 0 ${len + 0.02} -0.014 ${len - 0.03}Z" fill="#dfe2df"/>`, { layer: 0.85 });
  }
  // jars along the back of the counter
  const jarCols = ["#c98d4a", "#a4553a", "#e8dfcd", "#6f9a68", "#d8bb7e"];
  for (let k = 0; k < 5; k++) {
    const x = 0.55 + k * 0.22;
    s.sprite([x, h, 1.22], `<rect x="-0.06" y="-0.17" width="0.12" height="0.17" rx="0.02" fill="#ffffff" fill-opacity="0.45" stroke="#ffffff" stroke-opacity="0.7" stroke-width="0.004"/><rect x="-0.055" y="-0.11" width="0.11" height="0.105" rx="0.015" fill="${jarCols[k % jarCols.length]}"/><rect x="-0.062" y="-0.2" width="0.124" height="0.035" rx="0.006" fill="${k % 2 ? P.woodDark : P.steelDark}"/>`, { layer: 1.6 });
  }
  s.raw(`<rect width="1600" height="1067" fill="${s.defs.linear([[0, "#fff6e0", 0.35], [0.6, "#fff6e0", 0]], 0, 0, 1, 0.3)}" style="mix-blend-mode:screen"/>`, 2.1);
  return compose(s, { background: TILE, vignette: 0.32, grain: 0.14, grade: "#f5e0c0", gradeOpacity: 0.12 });
}

export const kitchen: SpaceScenes = {
  folder: "kitchen",
  label: "Küche",
  tour: true,
  shots: [
    { name: "hero", title: "Profiküche mit Kochlinie und Haube", render: hero },
    { name: "gallery-01", title: "Herd mit Töpfen und Pfannen", render: rangeDetail },
    { name: "gallery-02", title: "Pass mit Wärmelampen", render: pass },
    { name: "gallery-03", title: "Mise en place", render: miseEnPlace },
  ],
};
