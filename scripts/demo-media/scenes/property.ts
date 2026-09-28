import { darken, P } from "../lib/color";
import { archDoor, boxwoodSvg, crownSignSvg, house, wallLantern, type HouseSpec } from "../lib/architecture";
import { lookAt, ON_FLAT, ON_TOP, type Scene } from "../lib/persp";
import { bench, floorShadow, stringLights, table, treeSvg } from "../lib/props";
import { mulberry32, type Rand } from "../lib/rand";
import { f1, glow } from "../lib/svg";
import { compose, eveningGrade, makeScene, type SpaceScenes } from "./common";

const WALL = "#efe6d3";
const ROOF = "#b0654a";
const BEAM = "#5a3d2b";
const SHUTTER = "#56654a";

type Mood = "day" | "dusk";

function sky(s: Scene, mood: Mood, rand: Rand): string {
  const g =
    mood === "day"
      ? s.defs.linear([[0, "#cfdcdc"], [0.55, "#e9ebe2"], [1, "#f8f0de"]])
      : s.defs.linear([[0, "#1f2a3f"], [0.5, "#3d4a66"], [0.85, "#8a7a86"], [1, "#d49a6a"]]);
  const out = [`<rect width="1600" height="1067" fill="${g}"/>`];
  if (mood === "day") {
    for (let i = 0; i < 5; i++) {
      const x = rand() * 1600;
      const y = 60 + rand() * 220;
      const w = 120 + rand() * 200;
      out.push(`<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(w)}" ry="${f1(w * 0.18)}" fill="#ffffff" opacity="0.5" filter="${s.defs.blur(10)}"/>`);
    }
  } else {
    for (let i = 0; i < 60; i++) {
      out.push(`<circle cx="${f1(rand() * 1600)}" cy="${f1(rand() * 380)}" r="${f1(0.6 + rand() * 1.2)}" fill="#fff6e0" opacity="${(0.3 + rand() * 0.6).toFixed(2)}"/>`);
    }
    out.push(`<circle cx="1320" cy="140" r="26" fill="#f5ecd6" opacity="0.9"/><circle cx="1332" cy="134" r="24" fill="#2a3550" opacity="0.9"/>`);
  }
  return out.join("");
}

function ground(s: Scene, mood: Mood): void {
  const grass = mood === "day" ? "#9fae7c" : "#3f4a36";
  const far = mood === "day" ? "#c3c9a6" : "#56566a";
  s.poly([[-200, 0, s.cam.pos[2] + 0.5], [200, 0, s.cam.pos[2] + 0.5], [200, 0, 300], [-200, 0, 300]], s.defs.linear([[0, far], [0.4, grass], [1, darken(grass, 0.15)]]), { layer: -1 });
  // distant hills (screen space, just above the horizon)
  const hz = s.cam.project([0, 0, 280]);
  if (hz) {
    const y = hz[1];
    const c1 = mood === "day" ? "#a9b88a" : "#2f3547";
    const c2 = mood === "day" ? "#8fa070" : "#262b3a";
    s.raw(`<path d="M0 ${f1(y - 30)} C 300 ${f1(y - 90)}, 600 ${f1(y - 40)}, 900 ${f1(y - 70)} S 1400 ${f1(y - 30)}, 1600 ${f1(y - 60)} V${f1(y + 4)} H0Z" fill="${c1}" opacity="0.8"/>`, -1.5);
    s.raw(`<path d="M0 ${f1(y - 10)} C 400 ${f1(y - 50)}, 800 ${f1(y - 5)}, 1200 ${f1(y - 35)} S 1500 ${f1(y - 20)}, 1600 ${f1(y - 25)} V${f1(y + 4)} H0Z" fill="${c2}" opacity="0.9"/>`, -1.4);
  }
}

function forecourt(s: Scene, x0: number, x1: number, z0: number, z1: number, mood: Mood): void {
  const base = mood === "day" ? "#d3c6ad" : "#6d665c";
  s.poly([[x0, 0.001, z0], [x1, 0.001, z0], [x1, 0.001, z1], [x0, 0.001, z1]], base, { layer: -0.5 });
  const line = darken(base, 0.12);
  for (let z = z0 + 0.5; z < z1; z += 0.5) s.line([x0, 0.002, z], [x1, 0.002, z], line, 0.8, { layer: -0.45, opacity: 0.7 });
  for (let x = x0 + 0.5; x < x1; x += 0.5) s.line([x, 0.002, z0], [x, 0.002, z1], line, 0.6, { layer: -0.45, opacity: 0.4 });
}

function inn(mood: Mood): HouseSpec {
  const lit = mood === "dusk";
  const gf = [-6.4, -4.2, -2.1, 2.1, 4.2, 6.4].map((x) => ({ x, y: 0.95, w: 1.0, h: 1.45, shutters: SHUTTER }));
  const uf = [-6.4, -4.2, -2.1, 0, 2.1, 4.2, 6.4].map((x) => ({ x, y: 3.95, w: 0.95, h: 1.3, box: true }));
  return {
    x0: -7.8,
    x1: 7.8,
    z0: 0,
    z1: 11,
    eave: 6.3,
    ridge: 11.2,
    ridgeAxis: "x",
    wall: WALL,
    roof: ROOF,
    overhang: 0.45,
    plinth: "#b9ad98",
    fachwerk: { y0: 3.35, y1: 6.3, beam: BEAM, infill: "#f3ead6", bay: 1.3 },
    windows: [...gf, ...uf],
    lit,
    dormers: [-4.2, 0, 4.2],
  };
}

/** Inn facade dressing: door, lettering, crown sign, lanterns, planters. */
function dressFacade(s: Scene, mood: Mood): void {
  const lit = mood === "dusk";
  s.group([0, 1.5, -0.2], () => {
    archDoor(s, 0, 0, 1.5, 2.65, "#5a3d28", lit);
    // steps
    s.box([-1.2, 0, -0.9], [1.2, 0.16, 0], { base: "#c9bda6", top: "#ddd2bd" }, { layer: ON_TOP });
    s.box([-1.0, 0.16, -0.5], [1.0, 0.3, 0], { base: "#c9bda6", top: "#ddd2bd" }, { layer: ON_TOP + 0.001 });
    // lettering "ZUR KRONE" between the floors
    s.planar(
      [0, 3.02, -0.015],
      [1, 0, 0],
      [0, 1, 0],
      `<text x="0" y="0" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-weight="600" font-size="0.42" letter-spacing="0.1" fill="${P.goldDark}">ZUR KRONE</text>`,
      { layer: ON_FLAT + 0.01 },
    );
  });
  // crown sign on bracket (perpendicular to the facade)
  s.planar([2.0, 3.12, -0.02], [0, 0, -1], [0, 1, 0], crownSignSvg(1.1), { layer: 1.4 });
  wallLantern(s, [-1.35, 2.35, -0.05], lit);
  wallLantern(s, [1.05, 2.35, -0.05], lit);
  for (const x of [-1.5, 1.5]) s.sprite([x, 0.16, -0.75], boxwoodSvg(0.3), { layer: 1.35 });
}

function sideTrees(s: Scene, rand: Rand, mood: Mood, spots: Array<[number, number, number]>): void {
  const colors = mood === "day" ? ["#4f6b3b", "#5f7a47", "#3f5530", "#6d8752"] : ["#26301f", "#2c3824", "#1f281a", "#34402a"];
  for (const [x, z, h] of spots) {
    floorShadow(s, x - h * 0.3, z - h * 0.15, x + h * 0.4, z + h * 0.2, 0.25, 10);
    s.sprite([x, 0, z], treeSvg(rand, h, h * 0.8, { colors, light: mood === "day" ? "#8fa46c" : "#3f4a36", trunk: mood === "day" ? "#4a3a2c" : "#1f1a15" }));
  }
}

// ---------------------------------------------------------------------------

function facadeShot(mood: Mood, seed: number): string {
  const rand = mulberry32(seed);
  const s = makeScene({ pos: [-5.5, 1.7, -17], yaw: 16, pitch: -4, fov: 58, horizon: 0.56 }, { haze: mood === "day" ? "#e8eadf" : "#2a3042", hazeNear: 12, hazeFar: 60, hazeMax: 0.35, light: [-0.5, 0.7, -0.6] });
  const bg = sky(s, mood, rand);
  ground(s, mood);
  forecourt(s, -10, 10, -7, 0, mood);
  house(s, inn(mood));
  dressFacade(s, mood);
  // neighbouring barn to the right
  house(s, { x0: 9.5, x1: 16, z0: 2, z1: 12, eave: 4.2, ridge: 8.6, ridgeAxis: "z", wall: "#e4dccb", roof: "#9c5a44", overhang: 0.35, lit: mood === "dusk", windows: [{ x: 12.75, y: 1.0, w: 1.1, h: 1.3 }] });
  sideTrees(s, rand, mood, [[-11, -2, 9], [-13.5, 4, 11], [18.5, 0, 10], [-9.5, -8, 7]]);
  bench(s, 5.2, -1.2, 1.8, "x", "#7a5838", 0.45, 0.4);
  for (const x of [-4.2, 4.2]) s.sprite([x, 0, -0.6], boxwoodSvg(0.28, "#8a7a66"), { layer: 1.3 });
  if (mood === "dusk") {
    eveningGrade(s, 0.35, "#4a4a5a");
    for (const x of [-9, 9]) {
      s.sprite([x, 0, -6], `<rect x="-0.04" y="-3.2" width="0.08" height="3.2" fill="#1c1917"/><rect x="-0.14" y="-3.6" width="0.28" height="0.4" fill="#ffd48a" stroke="#1c1917" stroke-width="0.03"/>`);
      const c = s.cam.project([x, 3.4, -6]);
      if (c) s.raw(glow(s.defs, c[0], c[1], 2.2 * s.cam.scaleAt([x, 3.4, -6]), "#ffc676", 0.5), 2.3);
    }
  }
  return compose(s, { before: bg, vignette: mood === "day" ? 0.25 : 0.45, grain: 0.16, grade: mood === "day" ? "#f0c890" : "#ffb870", gradeOpacity: mood === "day" ? 0.12 : 0.1 });
}

function facadeDay(): string {
  return facadeShot("day", 101);
}

function facadeEvening(): string {
  return facadeShot("dusk", 101);
}

/** Entrance close-up: arched door, crown sign, lanterns, planters. */
function entrance(): string {
  const rand = mulberry32(103);
  const s = makeScene(lookAt([0.35, 2.1, 0], 6.6, 1, 14, 50, { horizon: 0.5 }), { light: [-0.5, 0.7, -0.6] });
  const bg = sky(s, "day", rand);
  ground(s, "day");
  forecourt(s, -10, 10, -9, 0, "day");
  house(s, inn("day"));
  dressFacade(s, "day");
  s.sprite([-3.2, 0, -1.2], boxwoodSvg(0.42, "#8a7a66"), { layer: 1.3 });
  s.sprite([3.4, 0, -1.2], boxwoodSvg(0.42, "#8a7a66"), { layer: 1.3 });
  // sunlight wash from the left
  s.raw(`<rect width="1600" height="1067" fill="${s.defs.linear([[0, "#fff3d6", 0.3], [0.7, "#fff3d6", 0]], 0, 0, 1, 0.4)}" style="mix-blend-mode:screen"/>`, 2.1);
  return compose(s, { before: bg, vignette: 0.28, grain: 0.16, grade: "#f0c890", gradeOpacity: 0.14 });
}

/** Garden with lawn, chestnuts, flower bed and the inn's gable behind. */
function garden(): string {
  const rand = mulberry32(107);
  const s = makeScene({ pos: [3.5, 1.6, -16], yaw: -8, pitch: -2, fov: 64, horizon: 0.56 }, { haze: "#e8eadf", hazeNear: 12, hazeFar: 60, hazeMax: 0.35, light: [-0.5, 0.7, -0.6] });
  const bg = sky(s, "day", rand);
  ground(s, "day");
  house(s, { x0: -5.5, x1: 5.5, z0: 6, z1: 20, eave: 6.3, ridge: 11.5, ridgeAxis: "z", wall: WALL, roof: ROOF, overhang: 0.45, plinth: "#b9ad98", fachwerk: { y0: 3.35, y1: 6.3, beam: BEAM, infill: "#f3ead6", bay: 1.1 }, windows: [-3.3, -1.1, 1.1, 3.3].flatMap((x) => [{ x, y: 0.95, w: 0.95, h: 1.4, shutters: SHUTTER }, { x, y: 3.95, w: 0.9, h: 1.25, box: true }]) });
  // gravel path
  s.poly([[-0.9, 0.002, -12], [0.9, 0.002, -12], [1.3, 0.002, 6], [-1.3, 0.002, 6]], "#d8c9a8", { layer: -0.5 });
  // flower beds either side of the path
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -6 : 1.6;
    const x1 = side < 0 ? -1.6 : 6;
    s.poly([[x0, 0.003, -6], [x1, 0.003, -6], [x1, 0.003, -3.5], [x0, 0.003, -3.5]], "#6b5a45", { layer: -0.45 });
    for (let i = 0; i < 70; i++) {
      const x = x0 + 0.2 + rand() * (x1 - x0 - 0.4);
      const z = -5.8 + rand() * 2.1;
      const col = ["#c95442", "#e8c6b0", "#efe2c4", "#b8402f", "#d8bb7e", "#8a5a8a"][Math.floor(rand() * 6)] ?? "#c95442";
      s.sprite([x, 0, z], `<path d="M0 0 V-0.35" stroke="#5f7a47" stroke-width="0.02"/><circle cx="0" cy="-0.38" r="0.07" fill="${col}"/><ellipse cx="-0.05" cy="-0.15" rx="0.06" ry="0.025" fill="#6d8752"/>`, { layer: 1 });
    }
  }
  sideTrees(s, rand, "day", [[-9, -2, 11], [9.5, 1, 12], [-12, 8, 10], [12, 9, 9]]);
  bench(s, -4.2, -8.5, 1.8, "x", "#7a5838", 0.45, 0.4);
  // beer-garden table hint under the right tree
  table(s, { x: 7.2, z: -1.5, w: 2.2, d: 0.6, wood: "#8a6a45" });
  bench(s, 7.2, -2.1, 2.2, "x", "#8a6a45");
  bench(s, 7.2, -0.9, 2.2, "x", "#8a6a45");
  stringLights(s, [-9, 4.2, -2], [9.5, 4.6, 1], 0.8, 18, 0.4);
  return compose(s, { before: bg, vignette: 0.26, grain: 0.16, grade: "#f0c890", gradeOpacity: 0.14 });
}

export const property: SpaceScenes = {
  folder: "property",
  label: "Zur Krone",
  tour: false,
  shots: [
    { name: "gallery-01", title: "Fassade mit Fachwerk und Ziegeldach", render: facadeDay },
    { name: "gallery-02", title: "Eingang mit Kronen-Schild", render: entrance },
    { name: "gallery-03", title: "Abendstimmung", render: facadeEvening },
    { name: "gallery-04", title: "Garten", render: garden },
  ],
};
