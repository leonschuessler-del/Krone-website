import { darken, lighten, P } from "../lib/color";
import { house } from "../lib/architecture";
import { lookAt, ON_TOP, type Scene, type V3 } from "../lib/persp";
import { bench, bokeh, candle, floorShadow, stringLights, table } from "../lib/props";
import { mulberry32, type Rand } from "../lib/rand";
import { f1, finish, svgDoc } from "../lib/svg";
import { compose, eveningGrade, makeScene, type SpaceScenes } from "./common";

const GRAVEL = "#d6c4a0";
const WOOD = "#a57d52";

type Mood = "golden" | "dusk" | "day";

function skyRect(s: Scene, mood: Mood): string {
  const g =
    mood === "golden"
      ? s.defs.linear([[0, "#e9e1c8"], [0.6, "#f6e3bd"], [1, "#f3cf95"]])
      : mood === "dusk"
        ? s.defs.linear([[0, "#1f2a3f"], [0.55, "#435073"], [1, "#b98a78"]])
        : s.defs.linear([[0, "#cfdcdc"], [0.6, "#e9ebe2"], [1, "#f6efdf"]]);
  return `<rect width="1600" height="1067" fill="${g}"/>`;
}

function gravelGround(s: Scene, rand: Rand, mood: Mood): void {
  const base = mood === "dusk" ? "#6f675b" : GRAVEL;
  s.poly([[-60, 0, s.cam.pos[2] + 0.3], [60, 0, s.cam.pos[2] + 0.3], [60, 0, 80], [-60, 0, 80]], s.defs.linear([[0, darken(base, 0.08)], [1, base]]), { layer: -1, noHaze: true });
  const dots: string[] = [];
  for (let i = 0; i < 900; i++) {
    const z = s.cam.pos[2] + 0.8 + Math.pow(rand(), 1.6) * 28;
    const x = s.cam.pos[0] + (rand() - 0.5) * z * 2.2;
    const p = s.cam.project([x, 0, z]);
    if (!p || p[1] > 1067 || p[0] < 0 || p[0] > 1600) continue;
    const r = Math.max(0.5, 0.025 * s.cam.scaleAt([x, 0, z]));
    const c = rand() > 0.5 ? lighten(base, 0.12) : darken(base, 0.14);
    dots.push(`<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(r)}" ry="${f1(r * 0.55)}" fill="${c}"/>`);
  }
  s.raw(`<g opacity="0.8">${dots.join("")}</g>`, -0.9);
}

/** Palmate horse-chestnut leaf (screen space). */
function chestnutLeaf(x: number, y: number, size: number, rot: number, color: string, vein: string): string {
  const leaflets: string[] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = -80 + (i * 160) / (n - 1);
    const len = size * (1 - Math.abs(i - (n - 1) / 2) * 0.13);
    leaflets.push(
      `<g transform="rotate(${a.toFixed(1)})"><path d="M0 0 C ${f1(len * 0.18)} ${f1(-len * 0.3)}, ${f1(len * 0.2)} ${f1(-len * 0.8)}, 0 ${f1(-len)} C ${f1(-len * 0.2)} ${f1(-len * 0.8)}, ${f1(-len * 0.18)} ${f1(-len * 0.3)}, 0 0Z" fill="${color}"/><path d="M0 0 V${f1(-len * 0.92)}" stroke="${vein}" stroke-width="${f1(Math.max(1, size * 0.02))}"/></g>`,
    );
  }
  return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${rot.toFixed(1)})">${leaflets.join("")}</g>`;
}

/** Canopy of chestnut foliage along the top of the frame (screen space). */
function canopy(s: Scene, rand: Rand, mood: Mood, depthY = 300): void {
  const cols = mood === "dusk" ? ["#1d2618", "#232d1d", "#2a3522", "#1a2115"] : ["#3f5530", "#4f6b3b", "#5f7a47", "#6d8752", "#46602f"];
  const out: string[] = [];
  for (let i = 0; i < 70; i++) {
    const x = rand() * 1700 - 50;
    const y = rand() * depthY * (0.35 + 0.65 * Math.abs(Math.sin(x / 260)));
    const r = 50 + rand() * 90;
    out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${cols[i % cols.length]}"/>`);
  }
  if (mood !== "dusk") {
    for (let i = 0; i < 22; i++) {
      const r = 4 + rand() * 12;
      out.push(`<ellipse cx="${f1(rand() * 1600)}" cy="${f1(rand() * depthY * 0.6)}" rx="${f1(r)}" ry="${f1(r * (0.5 + rand() * 0.5))}" fill="${mood === "golden" ? "#f6e3bd" : "#e9ebe2"}" opacity="${(0.35 + rand() * 0.35).toFixed(2)}"/>`);
    }
  }
  s.raw(`<g filter="${s.defs.blur(1.2)}">${out.join("")}</g>`, 2.0);
  const leaves: string[] = [];
  for (let i = 0; i < 9; i++) {
    const x = i < 4 ? rand() * 420 - 40 : i < 8 ? 1200 + rand() * 440 : 700 + rand() * 200;
    const y = rand() * 120 - 20;
    const size = 90 + rand() * 70;
    const c = cols[(i + 1) % cols.length] ?? "#4f6b3b";
    leaves.push(chestnutLeaf(x, y, size, 150 + rand() * 60, c, darken(c, 0.25)));
  }
  s.raw(leaves.join(""), 2.01);
}

function trunk(s: Scene, x: number, z: number, h = 5.5, r = 0.28, mood: Mood = "golden"): void {
  floorShadow(s, x - 0.6, z - 0.4, x + 1.2, z + 0.6, 0.28, 8);
  const col = mood === "dusk" ? "#2a221b" : "#5a4636";
  s.cyl([x, 0, z], r * 1.15, r * 0.85, h, { side: col }, { layer: 1 });
}

function beerTable(s: Scene, x: number, z: number, rand: Rand, opts: { mugs?: number; lantern?: boolean; axis?: "x" | "z" } = {}): void {
  const axis = opts.axis ?? "z";
  const len = 2.2;
  const w = axis === "z" ? 0.7 : len;
  const d = axis === "z" ? len : 0.7;
  table(s, {
    x,
    z,
    w,
    d,
    wood: WOOD,
    decor: () => {
      for (let i = 0; i < (opts.mugs ?? 0); i++) {
        const t = (i + 0.5) / (opts.mugs ?? 1) - 0.5;
        const px = axis === "z" ? x + (i % 2 ? 0.16 : -0.16) : x + t * (len - 0.4);
        const pz = axis === "z" ? z + t * (len - 0.4) : z + (i % 2 ? 0.16 : -0.16);
        s.sprite([px, 0.76, pz], mugSvg(0.16), { layer: ON_TOP });
      }
      if (opts.lantern) candle(s, [x, 0.76, z], 0.1, 0.8, 0.55, P.goldDark);
      if (rand() > 0.5) s.sprite([x, 0.76, z + (axis === "z" ? 0.4 : 0)], `<ellipse cx="0" cy="-0.01" rx="0.1" ry="0.025" fill="#efe6d4"/><circle cx="-0.03" cy="-0.03" r="0.028" fill="#c95442"/><circle cx="0.03" cy="-0.03" r="0.025" fill="#c95442"/>`, { layer: ON_TOP });
    },
  });
  if (axis === "z") {
    bench(s, x - 0.62, z, len, "z", darken(WOOD, 0.05));
    bench(s, x + 0.62, z, len, "z", darken(WOOD, 0.05));
  } else {
    bench(s, x, z - 0.62, len, "x", darken(WOOD, 0.05));
    bench(s, x, z + 0.62, len, "x", darken(WOOD, 0.05));
  }
}

function mugSvg(h = 0.18): string {
  const w = h * 0.6;
  return (
    `<path d="M${w / 2} ${-h * 0.8} C ${w * 0.95} ${-h * 0.8}, ${w * 0.95} ${-h * 0.25}, ${w / 2} ${-h * 0.25}" stroke="#f4efe2" stroke-opacity="0.85" stroke-width="${h * 0.09}" fill="none"/>` +
    `<rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" rx="${h * 0.04}" fill="#dca544" fill-opacity="0.95" stroke="#fffaf0" stroke-opacity="0.8" stroke-width="${h * 0.03}"/>` +
    `<rect x="${-w / 2}" y="${-h * 1.08}" width="${w}" height="${h * 0.2}" rx="${h * 0.08}" fill="#fbf6ea"/>` +
    `<path d="M${-w * 0.3} ${-h * 0.8} V${-h * 0.12}" stroke="#ffffff" stroke-opacity="0.5" stroke-width="${h * 0.05}"/>` +
    `<path d="M${-w * 0.05} ${-h * 0.75} V${-h * 0.15} M${w * 0.2} ${-h * 0.75} V${-h * 0.15}" stroke="#b5832f" stroke-opacity="0.35" stroke-width="${h * 0.025}"/>`
  );
}

function pretzelSvg(k = 0.22): string {
  const p = (x: number, y: number) => `${(x * k).toFixed(4)} ${(y * k).toFixed(4)}`;
  const d = `M${p(-0.28, 0.25)} C ${p(-0.55, 0.05)} ${p(-0.45, -0.42)} ${p(-0.12, -0.4)} C ${p(0, -0.39)} ${p(0, -0.3)} ${p(0, -0.3)} C ${p(0, -0.3)} ${p(0, -0.39)} ${p(0.12, -0.4)} C ${p(0.45, -0.42)} ${p(0.55, 0.05)} ${p(0.28, 0.25)} M${p(-0.28, 0.25)} C ${p(-0.1, 0.1)} ${p(0.05, -0.05)} ${p(0.1, -0.2)} M${p(0.28, 0.25)} C ${p(0.1, 0.1)} ${p(-0.05, -0.05)} ${p(-0.1, -0.2)} M${p(-0.28, 0.25)} Q ${p(-0.2, 0.33)} ${p(-0.08, 0.3)} M${p(0.28, 0.25)} Q ${p(0.2, 0.33)} ${p(0.08, 0.3)}`;
  const salt: string[] = [];
  for (const [x, y] of [[-0.35, -0.1], [-0.2, -0.33], [0.2, -0.34], [0.36, -0.08], [-0.05, 0.02], [0.08, 0.08], [-0.3, 0.12]] as const) {
    salt.push(`<rect x="${(x * k).toFixed(4)}" y="${(y * k).toFixed(4)}" width="${(0.03 * k).toFixed(4)}" height="${(0.025 * k).toFixed(4)}" fill="#fffdf8"/>`);
  }
  return `<path d="${d}" stroke="#8e4f22" stroke-width="${(0.14 * k).toFixed(4)}" fill="none" stroke-linecap="round"/><path d="${d}" stroke="#b86f35" stroke-width="${(0.08 * k).toFixed(4)}" fill="none" stroke-linecap="round" transform="translate(${(-0.012 * k).toFixed(4)} ${(-0.012 * k).toFixed(4)})"/>${salt.join("")}`;
}

function parasol(s: Scene, x: number, z: number, r = 1.6, h = 2.4, color = "#f1e8d6"): void {
  s.group([x, h / 2, z], () => {
    s.rod([x, 0, z], [x, h + 0.2, z], "#6b5a45", 0.05);
    s.cyl([x, h - 0.35, z], r, 0.06, 0.55, { side: color, bottom: darken(color, 0.12) });
  }, 1, -0.5);
}

function inn(s: Scene, mood: Mood, x0: number, z0: number): void {
  house(s, { x0, x1: x0 + 14, z0, z1: z0 + 10, eave: 6.2, ridge: 11, ridgeAxis: "x", wall: "#ede3cf", roof: "#b0654a", overhang: 0.45, plinth: "#b9ad98", fachwerk: { y0: 3.3, y1: 6.2, beam: "#5a3d2b", infill: "#f3ead6", bay: 1.3 }, lit: mood === "dusk", windows: [1.5, 3.7, 5.9, 8.1, 10.3, 12.5].flatMap((dx) => [{ x: x0 + dx, y: 0.95, w: 0.95, h: 1.4, shutters: "#56654a" }, { x: x0 + dx, y: 3.95, w: 0.9, h: 1.25, box: true }]) });
}

function dappledLight(s: Scene, rand: Rand, color = "#fff1c8", alpha = 0.35): void {
  const out: string[] = [];
  for (let i = 0; i < 26; i++) {
    const z = s.cam.pos[2] + 1.5 + rand() * 14;
    const x = s.cam.pos[0] + (rand() - 0.5) * z * 1.6;
    const pr = s.projectPoly(s.ring([x, 0.01, z], 0.5 + rand() * 0.9, 16, 0.35 + rand() * 0.4));
    if (!pr) continue;
    out.push(`<polygon points="${pr.pts.map((p) => `${f1(p[0])},${f1(p[1])}`).join(" ")}" fill="${color}" opacity="${(alpha * (0.5 + rand() * 0.5)).toFixed(2)}"/>`);
  }
  s.raw(`<g filter="${s.defs.blur(6)}" style="mix-blend-mode:soft-light">${out.join("")}</g>`, 0.5);
}

// ---------------------------------------------------------------------------

function hero(): string {
  const rand = mulberry32(131);
  const s = makeScene({ pos: [0.6, 1.6, 0], yaw: 6, fov: 72, horizon: 0.52 }, { haze: "#f2dfb8", hazeNear: 5, hazeFar: 30, hazeMax: 0.4, light: [0.6, 0.6, 0.5] });
  const bg = skyRect(s, "golden");
  gravelGround(s, rand, "golden");
  inn(s, "golden", -9, 24);
  // hedge line
  s.box([-30, 0, 20], [30, 1.3, 21], { base: "#5f7a47", top: "#6d8752" }, { layer: 0.9 });
  dappledLight(s, rand);
  for (const [x, z] of [[-3.4, 3.2], [3.6, 4.2], [-2.6, 10.5], [4.4, 12.5], [-6.5, 16], [0.4, 18]] as const) trunk(s, x, z, 6.5, 0.3);
  for (const [x, z, m] of [[-1.6, 3.4, 3], [1.9, 4.6, 2], [-1.4, 7.4, 2], [2.0, 8.4, 3], [-1.2, 11.6, 1], [2.2, 12.6, 2], [-0.8, 15.4, 0], [2.6, 16.2, 1]] as const) beerTable(s, x, z, rand, { mugs: m });
  parasol(s, 2.0, 8.4, 1.7, 2.45);
  for (const [a, b] of [
    [[-3.4, 4.4, 3.2], [3.6, 4.6, 4.2]],
    [[3.6, 4.6, 4.2], [-2.6, 4.4, 10.5]],
    [[-2.6, 4.4, 10.5], [4.4, 4.5, 12.5]],
    [[4.4, 4.5, 12.5], [-6.5, 4.5, 16]],
  ] as Array<[V3, V3]>) stringLights(s, a, b, 0.6, 16, 0.55);
  canopy(s, rand, "golden", 260);
  // golden low sun from the right
  s.raw(`<rect width="1600" height="1067" fill="${s.defs.linear([[0, "#ffd89a", 0], [0.65, "#ffd89a", 0.12], [1, "#ffc76e", 0.4]], 0, 0, 1, 0.2)}" style="mix-blend-mode:screen"/>`, 2.2);
  return compose(s, { before: bg, vignette: 0.32, grain: 0.18, grade: "#f5c27e", gradeOpacity: 0.16 });
}

/** Maß and pretzel on a beer table, garden out of focus. */
function tableDetail(): string {
  const rand = mulberry32(137);
  const cam = lookAt([0.05, 0.84, 1.72], 1.45, 26, -6, 46, { horizon: 0.5 });
  const fg = makeScene(cam, { light: [0.6, 0.7, -0.2] });
  const bg = makeScene(cam, { haze: "#f2dfb8", hazeNear: 3, hazeFar: 20, hazeMax: 0.4 }, fg.defs);
  gravelGround(bg, rand, "golden");
  inn(bg, "golden", -8, 22);
  for (const [x, z] of [[-2.8, 5], [2.6, 7], [-1.5, 12]] as const) trunk(bg, x, z, 6.5, 0.3);
  for (const [x, z] of [[-1.6, 5.4], [1.8, 6.8], [0, 10]] as const) beerTable(bg, x, z, rand, { mugs: 2 });
  // foreground table top (planks)
  const T = { x0: -1.2, x1: 1.2, z0: 0.9, z1: 2.4, h: 0.76 };
  fg.box([T.x0, T.h - 0.05, T.z0], [T.x1, T.h, T.z1], { base: WOOD, top: "#b58a5c" });
  for (let x = T.x0 + 0.3; x < T.x1; x += 0.3) fg.line([x, T.h + 0.001, T.z0], [x, T.h + 0.001, T.z1], darken("#b58a5c", 0.2), 1.2);
  const mugAt = (x: number, z: number, h = 0.21) => {
    fg.disc([x + 0.02, T.h + 0.001, z + 0.02], 0.075, "#3a2a1c", { layer: 1.004, opacity: 0.25 });
    fg.sprite([x, T.h, z], mugSvg(h), { layer: ON_TOP + z * 0.001 });
  };
  // wooden board with radishes & Obatzda
  fg.box([-0.62, T.h, 1.45], [-0.12, T.h + 0.025, 1.8], { base: P.woodLight, top: "#c9a171" }, { layer: 1.005 });
  fg.sprite([-0.47, T.h + 0.025, 1.62], `<ellipse cx="0" cy="-0.03" rx="0.07" ry="0.035" fill="#e7b75c"/><ellipse cx="-0.02" cy="-0.045" rx="0.03" ry="0.012" fill="#f2cf85"/><path d="M-0.03 -0.06 L0 -0.075 L0.03 -0.058" stroke="#5f7a47" stroke-width="0.006" fill="none"/>`, { layer: ON_TOP });
  fg.sprite([-0.25, T.h + 0.025, 1.6], `<circle cx="-0.03" cy="-0.022" r="0.022" fill="#c95442"/><circle cx="0.02" cy="-0.02" r="0.02" fill="#b8402f"/><circle cx="0.045" cy="-0.03" r="0.016" fill="#efe6d4"/><path d="M-0.03 -0.044 L-0.035 -0.07 M0.02 -0.04 L0.03 -0.065" stroke="#5f7a47" stroke-width="0.006"/>`, { layer: ON_TOP });
  // pretzel on paper
  fg.disc([0.22, T.h + 0.002, 1.42], 0.14, "#f6f1e6", { layer: 1.006 });
  fg.planar([0.22, T.h + 0.012, 1.42], [1, 0, 0], [0, 0, 1], pretzelSvg(0.26), { layer: ON_TOP - 0.005 });
  mugAt(-0.12, 2.02);
  mugAt(0.3, 1.9);
  mugAt(0.62, 2.12);
  const body =
    skyRect(fg, "golden") +
    `<g filter="${fg.defs.blur(7)}">${bg.render()}</g>` +
    fg.render();
  const extra: string[] = [];
  // canopy + bokeh
  const tmp = makeScene(cam, {}, fg.defs);
  canopy(tmp, rand, "golden", 220);
  bokeh(tmp, rand, 16, [0, 120, 1600, 520], 12, 36, ["#ffd89a", "#fff1c8", "#ffc76e"], 0.35);
  extra.push(`<g filter="${fg.defs.blur(4)}">${tmp.render()}</g>`);
  extra.push(`<rect width="1600" height="1067" fill="${fg.defs.linear([[0, "#ffd89a", 0], [0.6, "#ffd89a", 0.1], [1, "#ffc76e", 0.35]], 0, 0, 1, 0.2)}" style="mix-blend-mode:screen"/>`);
  return svgDoc(fg.defs, body + extra.join("") + finish(fg.defs, { vignette: 0.4, grain: 0.18, grade: "#f5c27e", gradeOpacity: 0.16 }));
}

/** Blue hour: string lights and candle lanterns. */
function blueHour(): string {
  const rand = mulberry32(139);
  const s = makeScene({ pos: [-0.8, 1.55, 0], yaw: 10, fov: 72, horizon: 0.52 }, { haze: "#2a3042", hazeNear: 5, hazeFar: 30, hazeMax: 0.4, light: [0.2, 0.8, -0.5] });
  const bg = skyRect(s, "dusk");
  gravelGround(s, rand, "dusk");
  inn(s, "dusk", -10, 24);
  s.box([-30, 0, 20], [30, 1.3, 21], { base: "#2c3824", top: "#34402a" }, { layer: 0.9 });
  for (const [x, z] of [[-3.2, 3.6], [3.8, 4.4], [-2.4, 10.8], [4.6, 12.2], [-6.5, 16], [0.8, 18]] as const) trunk(s, x, z, 6.5, 0.3, "dusk");
  for (const [x, z, m] of [[-1.2, 3.6, 2], [2.2, 4.8, 3], [-1.0, 7.8, 2], [2.4, 8.8, 1], [-0.8, 12.0, 2], [2.6, 12.8, 0]] as const) beerTable(s, x, z, rand, { mugs: m, lantern: true });
  eveningGrade(s, 0.5, "#4a4a5e");
  for (const [a, b] of [
    [[-3.2, 4.4, 3.6], [3.8, 4.6, 4.4]],
    [[3.8, 4.6, 4.4], [-2.4, 4.4, 10.8]],
    [[-2.4, 4.4, 10.8], [4.6, 4.5, 12.2]],
    [[4.6, 4.5, 12.2], [-6.5, 4.5, 16]],
    [[-3.2, 4.4, 3.6], [-6.5, 4.5, 16]],
  ] as Array<[V3, V3]>) stringLights(s, a, b, 0.6, 18, 1);
  canopy(s, rand, "dusk", 240);
  return compose(s, { before: bg, vignette: 0.45, grain: 0.18, grade: "#ffb870", gradeOpacity: 0.1 });
}

/** Daylight wide view from the side with the serving hut. */
function sideView(): string {
  const rand = mulberry32(141);
  const s = makeScene({ pos: [-7.5, 1.7, 1.5], yaw: 38, fov: 70, horizon: 0.52 }, { haze: "#eef0e6", hazeNear: 5, hazeFar: 35, hazeMax: 0.35, light: [-0.4, 0.8, -0.3] });
  const bg = skyRect(s, "day");
  gravelGround(s, rand, "day");
  inn(s, "day", -2, 22);
  // serving hut (Ausschank)
  const H = { x0: 3.2, x1: 7.2, z0: 9.5, z1: 12 };
  s.group([(H.x0 + H.x1) / 2, 1.3, (H.z0 + H.z1) / 2], () => {
    s.box([H.x0, 0, H.z0], [H.x1, 2.6, H.z1], { base: "#8a6a45" });
    s.box([H.x0 - 0.1, 0.95, H.z0 - 0.3], [H.x1 + 0.1, 1.05, H.z0 + 0.1], { base: "#6b4c31", top: "#7a5838" }, { layer: 1.01 });
    s.poly([[H.x0, 1.05, H.z0 - 0.01], [H.x1, 1.05, H.z0 - 0.01], [H.x1, 2.2, H.z0 - 0.01], [H.x0, 2.2, H.z0 - 0.01]], "#3a2c21", { layer: 1.005 });
    for (let x = H.x0 + 0.3; x < H.x1 - 0.2; x += 0.35) s.sprite([x, 1.05, H.z0 - 0.1], mugSvg(0.14), { layer: 1.015 });
    s.poly([[H.x0 - 0.2, 2.6, H.z0], [H.x1 + 0.2, 2.6, H.z0], [H.x1 + 0.2, 2.3, H.z0 - 0.8], [H.x0 - 0.2, 2.3, H.z0 - 0.8]], "#f1e8d6", { layer: 1.02 });
    for (let x = H.x0 - 0.2; x < H.x1 + 0.2; x += 0.55) s.poly([[x, 2.6, H.z0], [x + 0.275, 2.6, H.z0], [x + 0.275, 2.3, H.z0 - 0.8], [x, 2.3, H.z0 - 0.8]], "#56654a", { layer: 1.021 });
    s.box([H.x0 - 0.2, 2.6, H.z0 - 0.1], [H.x1 + 0.2, 3.05, H.z1 + 0.1], { base: "#6b4c31", top: "#7a5838" }, { layer: 1.03 });
    s.planar([(H.x0 + H.x1) / 2, 2.73, H.z0 - 0.12], [1, 0, 0], [0, 1, 0], `<text x="0" y="0" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-weight="600" font-size="0.26" letter-spacing="0.05" fill="${P.goldLight}">Ausschank</text>`, { layer: 1.04 });
  });
  for (const [x, z] of [[-2.4, 5.2], [-0.4, 2.2], [-3.5, 12], [9.5, 6.5], [10.5, 14], [-6, 18]] as const) trunk(s, x, z, 6.5, 0.32, "day");
  for (const [x, z, m] of [[0.6, 4.6, 2], [-1.2, 8.0, 3], [-2.2, 11.4, 1], [4.8, 5.4, 2]] as const) beerTable(s, x, z, rand, { mugs: m, axis: "x" });
  parasol(s, -1.2, 8.0, 1.8, 2.5, "#f1e8d6");
  parasol(s, 4.8, 5.4, 1.7, 2.45, "#e9dcc2");
  dappledLight(s, rand, "#fff6dc", 0.3);
  canopy(s, rand, "day", 230);
  return compose(s, { before: bg, vignette: 0.28, grain: 0.16, grade: "#f0d8a8", gradeOpacity: 0.12 });
}

export const beerGarden: SpaceScenes = {
  folder: "beer-garden",
  label: "Biergarten",
  tour: true,
  shots: [
    { name: "hero", title: "Biergarten unter Kastanien", render: hero },
    { name: "gallery-01", title: "Maß und Brezn", render: tableDetail },
    { name: "gallery-02", title: "Lichterketten zur blauen Stunde", render: blueHour },
    { name: "gallery-03", title: "Ausschank und Sonnenschirme", render: sideView },
  ],
};

