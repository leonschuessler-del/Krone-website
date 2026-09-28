import { darken, P } from "../lib/color";
import { lookAt, ON_FLAT, ON_TOP, type Scene, type V3 } from "../lib/persp";
import {
  bokeh,
  candle,
  chair,
  chandelier,
  leafySvg,
  lightShaft,
  paintingFill,
  picture,
  placeSetting,
  pottedPlant,
  room,
  table,
  vaseFlowersSvg,
  wallGrid,
  wallSconce,
  windowOn,
} from "../lib/props";
import { mulberry32, type Rand } from "../lib/rand";
import { finish, svgDoc } from "../lib/svg";
import { compose, eveningGrade, makeScene, type SpaceScenes } from "./common";

const WALL = "#ebe3cf";
const PANEL = "#6b4f37";
const FLOOR = "#9c7651";
const VELVET = "#5f6c4c";
const CLOTH = "#f6f1e6";
const R = { x0: -2.7, x1: 2.7, z0: -1.5, z1: 9.6, h: 3.05 };

function candlestick(s: Scene, p: V3, lit: boolean, h = 0.26): void {
  s.sprite(
    p,
    `<path d="M-0.045 0 H0.045 L0.02 -0.03 V-0.14 L0.03 -0.16 H-0.03 L-0.02 -0.14 V-0.03Z" fill="${P.gold}"/>` +
      `<rect x="-0.013" y="${-0.16 - h}" width="0.026" height="${h}" fill="#f6efe0"/>` +
      (lit ? `<path d="M0 ${-0.16 - h - 0.05} C 0.01 ${-0.16 - h - 0.03}, 0.009 ${-0.16 - h - 0.006}, 0 ${-0.16 - h - 0.003} C -0.009 ${-0.16 - h - 0.006}, -0.01 ${-0.16 - h - 0.03}, 0 ${-0.16 - h - 0.05}z" fill="#ffd27a"/>` : ""),
    { layer: ON_TOP },
  );
  if (!lit) return;
  const top: V3 = [p[0], p[1] + 0.16 + h + 0.03, p[2]];
  const c = s.cam.project(top);
  if (c) {
    const sc = s.cam.scaleAt(top);
    s.raw(`<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(0.4 * sc).toFixed(1)}" fill="${s.defs.radial([[0, "#ffc873", 0.5], [0.35, "#ffc873", 0.2], [1, "#ffc873", 0]])}" style="mix-blend-mode:screen"/>`, 2.4);
    s.raw(`<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(0.07 * sc).toFixed(1)}" fill="${s.defs.radial([[0, "#fff4d8", 0.9], [1, "#fff4d8", 0]])}" style="mix-blend-mode:screen"/>`, 2.5);
  }
}

function garland(s: Scene, x: number, z0: number, z1: number, h: number, rand: Rand): void {
  for (let z = z0; z < z1; z += 0.22) {
    s.sprite([x + (rand() - 0.5) * 0.06, h, z], leafySvg(rand, 0.17, 0.05, ["#5f7a47", "#6d8752", "#8fa46c", "#4f5b3d", "#7d9160"], 22, "round"), { layer: ON_TOP - 0.005 });
    if (rand() > 0.6) s.sprite([x + (rand() - 0.5) * 0.1, h, z + 0.1], `<circle cx="0" cy="-0.03" r="0.025" fill="${rand() > 0.5 ? "#f3e3d3" : "#e2b9a1"}"/>`, { layer: ON_TOP - 0.004 });
  }
}

interface FestiveOpts {
  lit: boolean;
  nearChairs?: boolean;
  farChairs?: boolean;
  from?: number;
  to?: number;
}

/** One long festive table along z (split in segments for correct sorting). */
function festiveTable(s: Scene, rand: Rand, o: FestiveOpts): void {
  const w = 1.1;
  const h = 0.76;
  const from = o.from ?? 1.8;
  const to = o.to ?? 8.2;
  const seg = 1.6;
  for (let z = from; z < to - 0.01; z += seg) {
    const zc = z + seg / 2;
    table(s, {
      x: 0,
      z: zc,
      w,
      d: seg,
      cloth: CLOTH,
      drop: 0.5,
      decor: () => {
        s.poly(
          [
            [-0.2, h + 0.003, z],
            [0.2, h + 0.003, z],
            [0.2, h + 0.003, z + seg],
            [-0.2, h + 0.003, z + seg],
          ],
          "#e8dcc2",
          { layer: ON_FLAT - 0.005 },
        );
        for (const pz of [z + 0.4, z + 1.2]) {
          placeSetting(s, -w / 2 + 0.22, h, pz, "+x", rand);
          placeSetting(s, w / 2 - 0.22, h, pz, "-x", rand);
        }
        garland(s, 0, z + 0.05, z + seg, h, rand);
        candlestick(s, [0.05, h, z + 0.8], o.lit);
        if (Math.round((z - from) / seg) % 2 === 1) s.sprite([-0.02, h, z + 0.35], vaseFlowersSvg(rand, 0.3, "#e2b9a1"), { layer: ON_TOP });
      },
    });
  }
  for (let z = from + 0.4; z < to; z += 0.8) {
    if (o.farChairs !== false) chair(s, { x: w / 2 + 0.26, z, facing: "-x", wood: P.woodDark, seat: VELVET, back: "upholstered" });
    if (o.nearChairs !== false) chair(s, { x: -w / 2 - 0.26, z, facing: "+x", wood: P.woodDark, seat: VELVET, back: "upholstered" });
  }
  // head chairs
  chair(s, { x: 0, z: to + 0.3, facing: "-z", wood: P.woodDark, seat: VELVET, back: "upholstered" });
}

function sideRoomShell(s: Scene, rand: Rand, mood: "day" | "dusk"): V3[][] {
  room(s, { ...R, wall: WALL, floor: FLOOR, floorKind: "planks", plank: 0.18, ceiling: "#f1eadb", wainscot: { h: 1.3, color: PANEL, panels: 0.9 }, skirting: darken(PANEL, 0.3), seed: rand });
  // subtle striped wallpaper above the panelling
  wallGrid(s, "left", R.x0, 0, R.z1, 1.36, R.h - 0.2, 0.16, 5, darken(WALL, 0.06), 1, 0.6, false, 0.31);
  wallGrid(s, "right", R.x1, 0, R.z1, 1.36, R.h - 0.2, 0.16, 5, darken(WALL, 0.06), 1, 0.6, false, 0.31);
  wallGrid(s, "back", R.z1, R.x0, R.x1, 1.36, R.h - 0.2, 0.16, 5, darken(WALL, 0.06), 1, 0.6, false, 0.31);
  // cornice
  for (const side of ["left", "right"] as const) {
    const x = side === "left" ? R.x0 : R.x1;
    s.poly([[x, R.h - 0.18, R.z0], [x, R.h - 0.18, R.z1], [x, R.h, R.z1], [x, R.h, R.z0]], "#f6f0e2", { layer: 0.32 });
  }
  s.poly([[R.x0, R.h - 0.18, R.z1], [R.x1, R.h - 0.18, R.z1], [R.x1, R.h, R.z1], [R.x0, R.h, R.z1]], "#f6f0e2", { layer: 0.32 });
  const glasses: V3[][] = [];
  for (const [u0, u1] of [
    [1.4, 2.8],
    [4.6, 6.0],
  ] as const) {
    glasses.push(windowOn(s, { side: "left", plane: R.x0, u0, u1, v0: 1.0, v1: 2.55, cols: 2, rows: 3, mood, wall: WALL, curtains: "#8c9270", view: "garden" }, Math.round(u0 * 7)));
  }
  // back wall: sideboard, painting, sconces
  s.box([-1.1, 0, R.z1 - 0.48], [1.1, 0.88, R.z1 - 0.02], { base: PANEL, top: darken(PANEL, 0.1) });
  picture(s, "back", R.z1, -0.9, 0.9, 1.35, 2.45, paintingFill(s, "#d9dccb", "#8e9a6a", "#56603f"), P.gold);
  wallSconce(s, [-1.5, 1.95, R.z1 - 0.06], "#ffd79a");
  wallSconce(s, [1.5, 1.95, R.z1 - 0.06], "#ffd79a");
  s.sprite([-0.6, 0.88, R.z1 - 0.25], vaseFlowersSvg(rand, 0.4, "#e2b9a1"), { layer: 1.2 });
  picture(s, "right", R.x1, 2.0, 3.2, 1.5, 2.4, paintingFill(s, "#e3d6bb", "#b39868", "#7d6443"), P.gold);
  picture(s, "right", R.x1, 5.2, 6.4, 1.5, 2.4, paintingFill(s), P.gold);
  for (const z of [4.2, 7.6]) wallSconce(s, [R.x1 - 0.06, 1.9, z]);
  pottedPlant(s, [2.1, 0, R.z1 - 0.45], rand, { h: 1.7, w: 0.9, kind: "olive", pot: P.inkSoft, potR: 0.24 });
  return glasses;
}

// ---------------------------------------------------------------------------

function hero(): string {
  const rand = mulberry32(61);
  const s = makeScene({ pos: [0.35, 1.58, 0.1], yaw: -2, fov: 72, horizon: 0.48 }, { haze: "#3a2c22", hazeNear: 4, hazeFar: 14, hazeMax: 0.2, light: [0.2, 0.9, -0.4] });
  sideRoomShell(s, rand, "dusk");
  festiveTable(s, rand, { lit: true });
  chandelier(s, 0, 2.25, 3.6, R.h, 8, 0.45);
  chandelier(s, 0, 2.25, 6.6, R.h, 8, 0.45);
  eveningGrade(s, 0.52);
  return compose(s, { background: "#2a211b", vignette: 0.42, grain: 0.18, grade: "#ffb870", gradeOpacity: 0.14 });
}

/** Festive place setting close-up, rest of the table out of focus. */
function tableDetail(): string {
  const rand = mulberry32(67);
  const cam = lookAt([0.05, 0.82, 2.8], 1.9, 22, -10, 48);
  const fg = makeScene(cam, { light: [0.2, 0.9, -0.4], shadeDark: 0.22 });
  const bg = makeScene(cam, { haze: "#3a2c22", hazeNear: 3, hazeFar: 12, hazeMax: 0.3 }, fg.defs);
  sideRoomShell(bg, rand, "dusk");
  festiveTable(bg, rand, { lit: true, from: 3.4, to: 8.2 });
  chandelier(bg, 0, 2.25, 3.9, R.h, 8, 0.45);
  chandelier(bg, 0, 2.25, 6.6, R.h, 8, 0.45);
  festiveTable(fg, rand, { lit: true, from: 1.8, to: 3.4 });
  // name card
  fg.sprite([0.28, 0.76, 2.42], `<path d="M-0.05 0 L-0.045 -0.045 H0.045 L0.05 0Z" fill="#fffdf8" stroke="#e6dccb" stroke-width="0.002"/><path d="M-0.03 -0.022 H0.03" stroke="${P.gold}" stroke-width="0.003"/><circle cx="0" cy="-0.032" r="0.004" fill="${P.gold}"/>`, { layer: 1.6 });
  eveningGrade(fg, 0.45);
  bokeh(fg, rand, 14, [0, 30, 1600, 380], 10, 34, ["#ffcf85", "#ffd9a0", "#f7b867"], 0.28);
  const body =
    `<rect width="1600" height="1067" fill="#2a211b"/>` +
    `<g filter="${fg.defs.blur(6)}">${bg.render(-Infinity, 1.79)}</g>` +
    fg.render(-Infinity, 1.79) +
    fg.render(1.8, 1.8) +
    `<g filter="${fg.defs.blur(6)}">${bg.render(1.81, Infinity)}</g>` +
    fg.render(1.81, Infinity);
  return svgDoc(fg.defs, body + finish(fg.defs, { vignette: 0.48, grain: 0.18, grade: "#ffb870", gradeOpacity: 0.14 }));
}

/** Daylight view from a corner. */
function daylightCorner(): string {
  const rand = mulberry32(71);
  const s = makeScene({ pos: [2.2, 1.52, 0.2], yaw: -27, fov: 74, horizon: 0.5 }, { haze: "#f3ead9", hazeNear: 3, hazeFar: 13, hazeMax: 0.22, light: [0.8, 0.6, 0.1] });
  const glasses = sideRoomShell(s, rand, "day");
  for (const g of glasses) lightShaft(s, g, [0.85, -0.6, 0.2], { alpha: 0.24, floorAlpha: 0.5, blur: 14 });
  festiveTable(s, rand, { lit: false });
  chandelier(s, 0, 2.25, 3.6, R.h, 8, 0.45);
  chandelier(s, 0, 2.25, 6.6, R.h, 8, 0.45);
  return compose(s, { background: WALL, vignette: 0.3, grain: 0.16, grade: "#f0c890", gradeOpacity: 0.14 });
}

/** Straight-on view across the table towards the panelled long wall. */
function elevation(): string {
  const rand = mulberry32(73);
  const s = makeScene({ pos: [-2.55, 2.15, 5.0], yaw: 90, pitch: 21, fov: 80, horizon: 0.44 }, { haze: "#efe4cf", hazeNear: 2, hazeFar: 8, hazeMax: 0.15, light: [-0.5, 0.8, -0.3] });
  sideRoomShell(s, rand, "day");
  festiveTable(s, rand, { lit: true, nearChairs: false, from: 0.2, to: 9.4 });
  chandelier(s, 0, 2.2, 3.4, R.h, 8, 0.45);
  chandelier(s, 0, 2.2, 6.6, R.h, 8, 0.45);
  s.raw(`<rect width="1600" height="1067" fill="${s.defs.linear([[0, "#3a2a1c", 0.35], [0.5, "#3a2a1c", 0], [1, "#3a2a1c", 0.35]], 0, 0, 1, 0)}" style="mix-blend-mode:multiply"/>`, 1.8);
  return compose(s, { background: WALL, vignette: 0.36, grain: 0.16, grade: "#f5c27e", gradeOpacity: 0.18 });
}

export const sideRoom: SpaceScenes = {
  folder: "side-room",
  label: "Nebenzimmer",
  tour: true,
  shots: [
    { name: "hero", title: "Festlich gedeckte lange Tafel", render: hero },
    { name: "gallery-01", title: "Gedeck mit Tischkarte und Girlande", render: tableDetail },
    { name: "gallery-02", title: "Nebenzimmer bei Tageslicht", render: daylightCorner },
    { name: "gallery-03", title: "Blick auf die holzvertäfelte Wand", render: elevation },
  ],
};
