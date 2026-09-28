/**
 * Hero TEST film: a virtual "drone flight" over our own stylised site plan.
 *
 * 1. starts on the full site plan (all space outlines visible = identical to
 *    the last frame, so the clip loops seamlessly) and drifts/zooms towards
 *    the main building while the title fades in and out,
 * 2. visits Restaurant → Bühne → Nebenzimmer → Alte Wirtschaft → Küche →
 *    Wintergarten → Biergarten (polygon + label fade in/out),
 * 3. returns to the top-down view where all outlines appear again – this
 *    matches the interactive map's starting state.
 *
 * Camera path: van Wijk & Nuij "smooth zooming and panning" between views,
 * eased in/out, clamped so the frame never leaves the map.
 */
import type { Browser } from "@playwright/test";
import sharp from "sharp";
import { spaceShapes } from "@/config/floorplan";
import { spaceSeeds } from "@/content/spaces";
import { renderBaseMapSvg } from "@/features/map/render-base-map";
import { WebmEncoder } from "../lib/ffmpeg";
import { fontFaceCss } from "../lib/fonts";

const MAP_W = 1536;
const MAP_H = 1024;

export interface HeroFilmOptions {
  outWebm: string;
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: string;
  crf?: number;
}

interface View {
  cx: number;
  cy: number;
  w: number;
  rot: number;
}

const ORDER = ["restaurant", "stage", "side-room", "old-tavern", "kitchen", "winter-garden", "beer-garden"] as const;
/** gentle, varied camera roll per space (degrees) */
const ROLL: Record<(typeof ORDER)[number], number> = {
  restaurant: -4,
  stage: 2.5,
  "side-room": -1.5,
  "old-tavern": 3.5,
  kitchen: -2.5,
  "winter-garden": 2,
  "beer-garden": -4.5,
};

// ---------------------------------------------------------------------------
// camera maths

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const fade = (t: number, a: number, b: number) => easeSine(clamp01((t - a) / (b - a)));

/** van Wijk & Nuij optimal zoom/pan path (same maths as d3.interpolateZoom). */
function zoomPath(a: View, b: View): (t: number) => View {
  const rho = Math.SQRT2;
  const [ux0, uy0, w0] = [a.cx, a.cy, a.w];
  const [ux1, uy1, w1] = [b.cx, b.cy, b.w];
  const dx = ux1 - ux0;
  const dy = uy1 - uy0;
  const d2 = dx * dx + dy * dy;
  const rot = (t: number) => a.rot + (b.rot - a.rot) * t;
  if (d2 < 1e-9) {
    const S = Math.log(w1 / w0) / rho;
    return (t) => ({ cx: ux0 + t * dx, cy: uy0 + t * dy, w: w0 * Math.exp(rho * t * S), rot: rot(t) });
  }
  const d1 = Math.sqrt(d2);
  const b0 = (w1 * w1 - w0 * w0 + rho ** 4 * d2) / (2 * w0 * rho * rho * d1);
  const b1 = (w1 * w1 - w0 * w0 - rho ** 4 * d2) / (2 * w1 * rho * rho * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (r1 - r0) / rho;
  return (t) => {
    const s = t * S;
    const coshr0 = Math.cosh(r0);
    const u = (w0 / (rho * rho * d1)) * (coshr0 * Math.tanh(rho * s + r0) - Math.sinh(r0));
    return { cx: ux0 + u * dx, cy: uy0 + u * dy, w: (w0 * coshr0) / Math.cosh(rho * s + r0), rot: rot(t) };
  };
}

/** Keeps the (rotated) frame inside the map. Continuous → no jumps. */
function clampView(v: View, aspect: number): View {
  const out = { ...v };
  const a = (out.rot * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  for (let k = 0; k < 2; k++) {
    const hw = out.w / 2;
    const hh = out.w / aspect / 2;
    const ex = hw * c + hh * s;
    const ey = hw * s + hh * c;
    const scale = Math.min(1, MAP_W / 2 / ex, MAP_H / 2 / ey);
    out.w *= scale;
    const ex2 = ex * scale;
    const ey2 = ey * scale;
    out.cx = Math.min(MAP_W - ex2, Math.max(ex2, out.cx));
    out.cy = Math.min(MAP_H - ey2, Math.max(ey2, out.cy));
  }
  return out;
}

function fitPolygon(poly: ReadonlyArray<readonly [number, number]>, aspect: number, roll: number): View {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const bw = maxX - minX;
  const bh = maxY - minY;
  // polygon ≈ 42% of the frame height / 38% of the width, within sane bounds
  const w = Math.max(600, Math.min(1250, Math.max(bw / 0.38, (bh / 0.46) * aspect)));
  // nudge the centre slightly left of the polygon so it sits right of the label card
  return { cx: (minX + maxX) / 2 - w * 0.08, cy: (minY + maxY) / 2 + (w / aspect) * 0.04, w, rot: roll };
}

// ---------------------------------------------------------------------------
// timeline

interface SpaceInfo {
  id: string;
  name: string;
  code: string;
  color: string;
  description: string;
  polygon: Array<[number, number]>;
  label: { x: number; y: number };
}

interface Segment {
  t0: number;
  t1: number;
  at: (u: number) => View;
}

interface Visit {
  id: string;
  arrive: number;
  depart: number;
  /** side of the label card, chosen so it does not cover the polygon */
  side: "left" | "right";
}

function buildTimeline(spaces: SpaceInfo[], aspect: number) {
  const HOME: View = { cx: MAP_W / 2, cy: 508, w: MAP_W, rot: 0 };
  const segments: Segment[] = [];
  const visits: Visit[] = [];
  const HOLD = 1.6;
  let t = 0;
  let current = HOME;
  const byId = new Map(spaces.map((s) => [s.id, s]));
  ORDER.forEach((id, i) => {
    const sp = byId.get(id);
    if (!sp) return;
    const target = clampView(fitPolygon(sp.polygon, aspect, ROLL[id]), aspect);
    // first leg is the slow opening zoom from the full site plan
    const dist = Math.hypot(target.cx - current.cx, target.cy - current.cy) / ((target.w + current.w) / 2);
    const dur = i === 0 ? 4.6 : Math.min(2.0, 1.15 + 0.6 * dist);
    const path = zoomPath(current, target);
    const ease = i === 0 ? easeSine : easeInOut;
    const t0 = t;
    segments.push({ t0, t1: t0 + dur, at: (u) => path(ease(u)) });
    t += dur;
    const arrive = t;
    const drift: View = { ...target, w: target.w * 0.955, rot: target.rot + 0.6 };
    const hold = zoomPath(target, drift);
    segments.push({ t0: t, t1: t + HOLD, at: (u) => hold(easeSine(u)) });
    t += HOLD;
    // polygon centroid in screen space at arrival → put the card on the other side
    const cxm = sp.polygon.reduce((a, p) => a + p[0], 0) / sp.polygon.length;
    const cym = sp.polygon.reduce((a, p) => a + p[1], 0) / sp.polygon.length;
    const r = (target.rot * Math.PI) / 180;
    const sx = 0.5 + (((cxm - target.cx) * Math.cos(r) - (cym - target.cy) * Math.sin(r)) / target.w);
    visits.push({ id, arrive, depart: t, side: sx < 0.42 ? "right" : "left" });
    current = drift;
  });
  const back = zoomPath(current, HOME);
  const RETURN = 2.9;
  segments.push({ t0: t, t1: t + RETURN, at: (u) => back(easeInOut(u)) });
  t += RETURN;
  const outlinesIn = t - 1.55;
  const END_HOLD = 0.7;
  segments.push({ t0: t, t1: t + END_HOLD, at: () => HOME });
  t += END_HOLD;
  return { segments, visits, duration: t, outlinesIn, returnStart: t - END_HOLD - RETURN, HOME };
}

function viewAt(segments: Segment[], t: number, aspect: number): View {
  const seg = segments.find((s) => t >= s.t0 && t < s.t1) ?? segments[segments.length - 1]!;
  const u = seg.t1 > seg.t0 ? clamp01((t - seg.t0) / (seg.t1 - seg.t0)) : 1;
  return clampView(seg.at(u), aspect);
}

// ---------------------------------------------------------------------------
// page (canvas renderer)

const PAGE_SCRIPT = String.raw`
const cv = document.getElementById("c");
const W = cv.width, H = cv.height, S = W / 1920;
const ctx = cv.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";
let MAP = null, DATA = null;
const SERIF = '"Cormorant Garamond", Georgia, serif';
const SANS = '"Source Sans 3", Arial, sans-serif';
window.setup = async (src, data) => {
  DATA = data;
  MAP = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  if (MAP.decode) await MAP.decode();
  await Promise.all([document.fonts.load('600 40px "Cormorant Garamond"'), document.fonts.load('500 40px "Cormorant Garamond"'), document.fonts.load('600 16px "Source Sans 3"'), document.fonts.load('400 16px "Source Sans 3"')]);
};
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")"; }
function toScreen(v, x, y) {
  const k = W / v.w, r = v.rot * Math.PI / 180;
  const dx = (x - v.cx) * k, dy = (y - v.cy) * k;
  return [W / 2 + dx * Math.cos(r) - dy * Math.sin(r), H / 2 + dx * Math.sin(r) + dy * Math.cos(r)];
}
function crown(x, y, size, color, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x - size / 2, y - size * 0.35); ctx.scale(size / 64, size / 64);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.4; ctx.lineJoin = "round";
  const p = new Path2D("M6 34 3 12l14 10L32 4l15 18 14-10-3 22z"); ctx.globalAlpha = alpha * 0.14; ctx.fill(p); ctx.globalAlpha = alpha; ctx.stroke(p);
  ctx.beginPath(); ctx.moveTo(8, 39); ctx.lineTo(56, 39); ctx.stroke();
  for (const [cx, cy, r] of [[3, 11, 2.4], [32, 3.4, 2.6], [61, 11, 2.4], [17.5, 28, 1.6], [32, 27, 2], [46.5, 28, 1.6]]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
function pill(text, x, y, opts) {
  ctx.save();
  if (opts.caps) text = text.toUpperCase();
  ctx.font = opts.font;
  const ls = opts.spacing || 0;
  ctx.letterSpacing = "0px";
  const tw = ctx.measureText(text).width + ls * text.length - ls;
  ctx.letterSpacing = ls + "px";
  const dotW = opts.dot ? opts.h * 0.45 : 0;
  const w = tw + opts.padX * 2 + dotW, h = opts.h;
  const x0 = opts.align === "right" ? x - w : opts.align === "center" ? x - w / 2 : x;
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.fillStyle = opts.bg; ctx.beginPath(); ctx.roundRect(x0, y - h / 2, w, h, opts.radius ?? h / 2); ctx.fill();
  if (opts.border) { ctx.strokeStyle = opts.border; ctx.lineWidth = opts.borderWidth || 1; ctx.stroke(); }
  let tx = x0 + opts.padX;
  if (opts.dot) { ctx.fillStyle = "#d8bb7e"; ctx.beginPath(); ctx.arc(tx + h * 0.1, y, h * 0.1, 0, Math.PI * 2); ctx.fill(); tx += dotW; }
  ctx.fillStyle = opts.color; ctx.textBaseline = "middle"; ctx.textAlign = "left";
  ctx.fillText(text, tx, y + (opts.dy || 0));
  ctx.restore();
  return w;
}
window.renderFrame = (f) => {
  const v = f.view;
  const k = W / v.w;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#cfc9b8"; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.rotate(v.rot * Math.PI / 180); ctx.scale(k, k); ctx.translate(-v.cx, -v.cy);
  ctx.drawImage(MAP, 0, 0, ${MAP_W}, ${MAP_H});
  // polygons
  for (const sp of DATA.spaces) {
    const st = f.polys[sp.id];
    if (!st) continue;
    const path = new Path2D("M" + sp.polygon.map((p) => p[0] + " " + p[1]).join("L") + "Z");
    if (st.map > 0.001) {
      // interactive-map starting state: colour fill 0.26 + coloured outline
      ctx.fillStyle = hexA(sp.color, 0.26 * st.map); ctx.fill(path);
      ctx.strokeStyle = hexA(sp.color, 0.85 * st.map); ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke(path);
    }
    if (st.focus > 0.001) {
      ctx.fillStyle = hexA(sp.color, 0.35 * st.focus); ctx.fill(path);
      ctx.save(); ctx.shadowColor = "rgba(216,187,126," + (0.9 * st.focus) + ")"; ctx.shadowBlur = 18 * S;
      ctx.strokeStyle = "rgba(216,187,126," + st.focus + ")"; ctx.lineWidth = 3.2 * S / k; ctx.lineJoin = "round"; ctx.stroke(path); ctx.restore();
    }
  }
  ctx.restore();
  // vignette
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 1.0);
  g.addColorStop(0, "rgba(24,18,13,0)"); g.addColorStop(1, "rgba(24,18,13,0.32)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // code badges (+ names in the final "map" state)
  for (const sp of DATA.spaces) {
    const st = f.polys[sp.id];
    if (!st) continue;
    const a = Math.max(st.map, st.focus);
    if (a < 0.01) continue;
    const [x, y] = toScreen(v, sp.label.x, sp.label.y);
    ctx.save(); ctx.globalAlpha = a;
    const r = (st.focus > st.map ? 22 : 18) * S;
    ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 10 * S; ctx.shadowOffsetY = 3 * S;
    ctx.fillStyle = st.focus > st.map ? "#c8a562" : "rgba(28,25,23,0.9)";
    ctx.beginPath(); ctx.roundRect(x - Math.max(r, r * 0.55 * sp.code.length), y - r, Math.max(r, r * 0.55 * sp.code.length) * 2, r * 2, r); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = st.focus > st.map ? "#efe2c4" : "rgba(184,144,74,0.8)"; ctx.lineWidth = 1.6 * S; ctx.stroke();
    ctx.fillStyle = st.focus > st.map ? "#1c1917" : "#fbf8f2";
    ctx.font = "600 " + (r * 0.95).toFixed(1) + "px " + SERIF; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(sp.code, x, y + r * 0.05);
    ctx.restore();
    if (st.map > 0.01) {
      pill(sp.name, x, y + r + 16 * S, { font: "600 " + (17 * S).toFixed(1) + "px " + SERIF, h: 26 * S, padX: 10 * S, radius: 6 * S, bg: "rgba(251,248,242,0.92)", color: "#231e1b", align: "center", alpha: st.map });
    }
  }
  // space label card (bottom left, or bottom right when the polygon sits on the left)
  if (f.card && f.card.a > 0.001) {
    const sp = DATA.spaces.find((s) => s.id === f.card.id);
    const right = f.card.side === "right";
    const a = f.card.a, dy = (1 - a) * 14 * S;
    const sg = right ? ctx.createLinearGradient(W, H, W * 0.45, H * 0.45) : ctx.createLinearGradient(0, H, W * 0.55, H * 0.45);
    sg.addColorStop(0, "rgba(20,15,10," + (0.62 * a) + ")"); sg.addColorStop(1, "rgba(20,15,10,0)");
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(0, dy);
    const x = right ? W - 92 * S : 92 * S, base = H - (right ? 150 : 128) * S;
    ctx.textAlign = right ? "right" : "left";
    ctx.fillStyle = "#d8bb7e"; ctx.fillRect(right ? x - 56 * S : x, base - 132 * S, 56 * S, 2 * S);
    ctx.font = "600 " + (19 * S).toFixed(1) + "px " + SANS; ctx.letterSpacing = (4 * S).toFixed(1) + "px"; ctx.fontVariantCaps = "all-small-caps";
    ctx.fillStyle = "#d8bb7e"; ctx.textBaseline = "alphabetic";
    ctx.fillText(f.card.index + " / " + f.card.count + "   ·   " + sp.code, x, base - 96 * S);
    ctx.fontVariantCaps = "normal"; ctx.letterSpacing = "0px";
    ctx.font = "600 " + (86 * S).toFixed(1) + "px " + SERIF; ctx.fillStyle = "#fbf8f2";
    ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 16 * S;
    ctx.fillText(sp.name, right ? x : x - 3 * S, base - 14 * S);
    ctx.shadowColor = "transparent";
    ctx.font = "400 " + (23 * S).toFixed(1) + "px " + SANS; ctx.fillStyle = "rgba(251,248,242,0.82)";
    ctx.fillText(sp.description, x, base + 30 * S);
    ctx.restore();
  }
  // opening title
  if (f.title > 0.001) {
    const a = f.title;
    const tg = ctx.createRadialGradient(W / 2, H * 0.47, 0, W / 2, H * 0.47, W * 0.42);
    tg.addColorStop(0, "rgba(20,15,10," + (0.5 * a) + ")"); tg.addColorStop(1, "rgba(20,15,10,0)");
    ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    const y = H * 0.5 + (1 - a) * 10 * S;
    crown(W / 2, y - 118 * S, 64 * S, "#d8bb7e", a);
    ctx.font = "600 " + (18 * S).toFixed(1) + "px " + SANS; ctx.letterSpacing = (6 * S).toFixed(1) + "px"; ctx.fontVariantCaps = "all-small-caps";
    ctx.fillStyle = "#e9d3a2"; ctx.fillText("Landhotel · Gasthof", W / 2, y - 52 * S);
    ctx.fontVariantCaps = "normal"; ctx.letterSpacing = (2 * S).toFixed(1) + "px";
    ctx.font = "600 " + (84 * S).toFixed(1) + "px " + SERIF; ctx.fillStyle = "#fbf8f2";
    ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 20 * S;
    ctx.fillText("Zur Krone · Leidersbach", W / 2, y + 30 * S);
    ctx.restore();
  }
  // permanent test-film badge
  pill("Testfilm – Platzhalter", W - 30 * S, H - 38 * S, { font: "600 " + (15 * S).toFixed(1) + "px " + SANS, spacing: 1.8 * S, caps: true, h: 36 * S, padX: 17 * S, bg: "rgba(28,25,23,0.62)", border: "rgba(216,187,126,0.45)", color: "#f4eee2", align: "right", dot: true, dy: 1 * S });
};
window.grab = (q) => cv.toDataURL("image/jpeg", q).split(",")[1];
window.grabPng = () => cv.toDataURL("image/png").split(",")[1];
`;

async function rasteriseMap(browser: Browser, scale: number): Promise<Buffer> {
  // the paper grain of the base map is dropped for the film (moving noise
  // costs a lot of bitrate and flickers when scaled)
  const svg = renderBaseMapSvg().replace(/<rect[^>]*filter="url\(#grain\)"[^>]*\/>/, "");
  const page = await browser.newPage({ viewport: { width: MAP_W, height: MAP_H }, deviceScaleFactor: scale });
  try {
    await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;overflow:hidden}svg{display:block}</style></head><body>${svg}</body></html>`);
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: MAP_W, height: MAP_H } });
    return await sharp(png).jpeg({ quality: 93, chromaSubsampling: "4:4:4" }).toBuffer();
  } finally {
    await page.close();
  }
}

export async function renderHeroFilm(browser: Browser, o: HeroFilmOptions): Promise<{ poster: Buffer; frames: number; seconds: number }> {
  const W = o.width ?? 1920;
  const H = o.height ?? 1080;
  const fps = o.fps ?? 25;
  const aspect = W / H;

  const seedById = new Map(spaceSeeds.map((s) => [s.id, s]));
  const spaces: SpaceInfo[] = [];
  for (const shape of spaceShapes) {
    const seed = seedById.get(shape.spaceId);
    if (!seed || !shape.polygon || !shape.labelPosition) continue;
    spaces.push({
      id: seed.id,
      name: seed.name,
      code: seed.code,
      color: seed.color,
      description: (seed.shortDescription ?? "").replace(/\s*\[PLACEHOLDER[^\]]*\]/g, ""),
      polygon: shape.polygon.map((p) => [p[0], p[1]] as [number, number]),
      label: shape.labelPosition,
    });
  }

  const tl = buildTimeline(spaces, aspect);
  console.log(`[demo-media] hero film timeline: ${tl.visits.map((v) => `${v.id} ${v.arrive.toFixed(1)}–${v.depart.toFixed(1)}s (${v.side})`).join(", ")}; total ${tl.duration.toFixed(1)} s`);
  const mapJpeg = await rasteriseMap(browser, W > 1400 ? 4 : 3);

  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  try {
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaceCss()} html,body{margin:0;background:#231e1b}</style></head>` +
        `<body><canvas id="c" width="${W}" height="${H}"></canvas><script>${PAGE_SCRIPT}</script></body></html>`,
    );
    await page.evaluate(
      async ([src, data]) => {
        await (window as unknown as { setup: (s: string, d: unknown) => Promise<void> }).setup(src, data);
      },
      [`data:image/jpeg;base64,${mapJpeg.toString("base64")}`, { spaces }] as const,
    );

    const total = Math.round(tl.duration * fps);
    const enc = new WebmEncoder(o.outWebm, { fps, bitrate: o.bitrate ?? "1900k", crf: o.crf ?? 10, gop: fps * 5 });
    let poster: Buffer = Buffer.alloc(0);
    const visitIndex = new Map(tl.visits.map((v, i) => [v.id, i]));
    for (let fr = 0; fr < total; fr++) {
      const t = fr / fps;
      const view = viewAt(tl.segments, t, aspect);
      // all outlines: visible at the very start (loop match), fade out, fade back in at the end
      const mapState = t < 2 ? 1 - fade(t, 0.5, 2.0) : fade(t, tl.outlinesIn, tl.outlinesIn + 1.5);
      const polys: Record<string, { map: number; focus: number }> = {};
      let card: { id: string; a: number; index: string; count: string; side: string } | null = null;
      for (const sp of spaces) {
        const visit = tl.visits.find((v) => v.id === sp.id);
        let focus = 0;
        if (visit) {
          focus = fade(t, visit.arrive - 0.45, visit.arrive + 0.25) * (1 - fade(t, visit.depart, visit.depart + 0.55));
          const ca = fade(t, visit.arrive - 0.1, visit.arrive + 0.45) * (1 - fade(t, visit.depart - 0.05, visit.depart + 0.4));
          if (ca > 0.001 && (!card || ca > card.a)) {
            card = { id: sp.id, a: ca, index: String((visitIndex.get(sp.id) ?? 0) + 1).padStart(2, "0"), count: String(tl.visits.length).padStart(2, "0"), side: visit.side };
          }
        }
        polys[sp.id] = { map: mapState, focus };
      }
      const title = fade(t, 0.35, 1.35) * (1 - fade(t, 3.3, 4.3));
      const frame = { view, polys, card, title };
      const out = await page.evaluate(
        ([f, first]) => {
          const w = window as unknown as { renderFrame: (f: unknown) => void; grab: (q: number) => string; grabPng: () => string };
          w.renderFrame(f);
          return first ? `${w.grab(0.93)}|${w.grabPng()}` : w.grab(0.93);
        },
        [frame, fr === 0] as const,
      );
      if (fr === 0) {
        const [jpg, png] = out.split("|") as [string, string];
        poster = Buffer.from(png, "base64");
        await enc.write(Buffer.from(jpg, "base64"));
      } else {
        await enc.write(Buffer.from(out, "base64"));
      }
      if (fr % 100 === 0) process.stdout.write(`[demo-media] hero film frame ${fr}/${total}\r`);
    }
    await enc.finish();
    process.stdout.write("\n");
    return { poster, frames: total, seconds: total / fps };
  } finally {
    await page.close();
  }
}
