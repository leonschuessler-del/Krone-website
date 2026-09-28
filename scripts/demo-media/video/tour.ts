/**
 * Ken-Burns tour: slow pan/zoom across a space's four illustrations with
 * soft cross-fades. The timeline is circular (the last image fades back into
 * the first one mid-motion), so the clip loops seamlessly; frame 0 is a clean
 * frame of the hero image and doubles as the poster.
 */
import type { Browser } from "@playwright/test";
import { fontFaceCss } from "../lib/fonts";
import { WebmEncoder } from "../lib/ffmpeg";
import { BADGE_FILM } from "../lib/render";

export const TOUR_W = 1280;
export const TOUR_H = 720;

export interface TourOptions {
  images: Buffer[];
  outWebm: string;
  fps?: number;
  /** seconds each image is "on" (excluding cross-fade) */
  perImage?: number;
  crossfade?: number;
  bitrate?: string;
  crf?: number;
  label?: string;
}

/** Page script: sets up window.renderFrame(t) drawing onto a canvas. */
const PAGE_SCRIPT = String.raw`
const W = ${TOUR_W}, H = ${TOUR_H};
const cv = document.getElementById("c");
const ctx = cv.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";
window.__imgs = [];
window.setup = async (srcs, cfg) => {
  window.__cfg = cfg;
  window.__imgs = await Promise.all(srcs.map((src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; })));
  await document.fonts.load('600 15px "Source Sans 3"');
};
// Ken-Burns paths per image: [zoomFrom, zoomTo, panXFrom, panXTo, panYFrom, panYTo] (pan in -1..1 of free range)
const PATHS = [
  [1.02, 1.12, -0.5, 0.45, 0.1, -0.1],
  [1.14, 1.03, 0.4, -0.35, -0.4, 0.2],
  [1.03, 1.13, 0.35, -0.4, 0.3, -0.2],
  [1.12, 1.02, -0.45, 0.4, -0.2, 0.35],
];
const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
function drawImage(img, p, alpha, idx) {
  const [z0, z1, x0, x1, y0, y1] = PATHS[idx % PATHS.length];
  const e = p; // linear motion = constant, calm speed
  const z = z0 + (z1 - z0) * e;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  // base crop with the video aspect ratio, fitted inside the image
  let bw = iw, bh = iw * H / W;
  if (bh > ih) { bh = ih; bw = ih * W / H; }
  const cw = bw / z, ch = bh / z;
  const fx = (iw - cw) / 2, fy = (ih - ch) / 2;
  const px = x0 + (x1 - x0) * e, py = y0 + (y1 - y0) * e;
  const sx = iw / 2 - cw / 2 + px * fx;
  const sy = ih / 2 - ch / 2 + py * fy;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, sx, sy, cw, ch, 0, 0, W, H);
  ctx.globalAlpha = 1;
}
function badge(text) {
  const s = W / 1600 * 1.25;
  text = text.toUpperCase();
  ctx.save();
  ctx.font = '600 ' + (12.5 * s).toFixed(1) + 'px "Source Sans 3", Arial, sans-serif';
  const ls = 1.4 * s;
  ctx.letterSpacing = "0px";
  const tw = ctx.measureText(text).width + ls * text.length;
  ctx.letterSpacing = ls.toFixed(2) + "px";
  const padX = 15 * s, h = 29 * s, dot = 6 * s, gap = 9 * s;
  const w = tw + padX * 2 + dot + gap - ls;
  const x = W - 24 * s - w, y = H - 22 * s - h;
  ctx.fillStyle = "rgba(28,25,23,0.58)";
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = "rgba(216,187,126,0.4)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#d8bb7e";
  ctx.beginPath(); ctx.arc(x + padX + dot / 2, y + h / 2, dot / 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f4eee2"; ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX + dot + gap, y + h / 2 + 1);
  ctx.restore();
}
window.renderFrame = (t) => {
  const { perImage: T, crossfade: X, label } = window.__cfg;
  const imgs = window.__imgs;
  const n = imgs.length;
  const D = n * T;
  const half = (T + X) / 2;
  const vis = [];
  for (let i = 0; i < n; i++) {
    let dt = ((t - i * T) % D + D) % D;
    if (dt > D / 2) dt -= D;
    if (Math.abs(dt) > half) continue;
    const p = (dt + half) / (T + X);
    let a = 1;
    if (dt < -(T - X) / 2) a = smooth((dt + half) / X);
    const fadingOut = dt > (T - X) / 2;
    vis.push({ i, p, a, fadingOut });
  }
  // draw the outgoing image first (full alpha), then the incoming one on top
  vis.sort((a, b) => (a.a === 1 && b.a < 1 ? -1 : b.a === 1 && a.a < 1 ? 1 : 0));
  ctx.fillStyle = "#231e1b"; ctx.fillRect(0, 0, W, H);
  for (const v of vis) drawImage(imgs[v.i], v.p, v.a, v.i);
  // soft vignette for a filmic feel
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, "rgba(20,15,10,0)"); g.addColorStop(1, "rgba(20,15,10,0.28)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (label) badge(label);
};
window.grab = (q) => cv.toDataURL("image/jpeg", q).split(",")[1];
window.grabPng = () => cv.toDataURL("image/png").split(",")[1];
`;

export async function renderTour(browser: Browser, o: TourOptions): Promise<{ poster: Buffer; frames: number; seconds: number }> {
  const fps = o.fps ?? 25;
  const perImage = o.perImage ?? 2.4;
  const crossfade = o.crossfade ?? 0.8;
  const page = await browser.newPage({ viewport: { width: TOUR_W, height: TOUR_H }, deviceScaleFactor: 1 });
  try {
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaceCss()} html,body{margin:0;background:#231e1b}</style></head>` +
        `<body><canvas id="c" width="${TOUR_W}" height="${TOUR_H}"></canvas><script>${PAGE_SCRIPT}</script></body></html>`,
    );
    const srcs = o.images.map((b) => `data:image/png;base64,${b.toString("base64")}`);
    await page.evaluate(
      async ([s, cfg]) => {
        await (window as unknown as { setup: (a: string[], c: unknown) => Promise<void> }).setup(s, cfg);
      },
      [srcs, { perImage, crossfade, label: o.label ?? BADGE_FILM }] as const,
    );
    const total = Math.round(o.images.length * perImage * fps);
    const enc = new WebmEncoder(o.outWebm, { fps, bitrate: o.bitrate ?? "1500k", crf: o.crf ?? 12, gop: fps * 4 });
    let poster: Buffer = Buffer.alloc(0);
    for (let f = 0; f < total; f++) {
      const b64 = await page.evaluate(
        ([t, first]) => {
          const w = window as unknown as { renderFrame: (t: number) => void; grab: (q: number) => string; grabPng: () => string };
          w.renderFrame(t);
          return first ? `${w.grab(0.94)}|${w.grabPng()}` : w.grab(0.94);
        },
        [f / fps, f === 0] as const,
      );
      if (f === 0) {
        const [jpg, png] = b64.split("|") as [string, string];
        poster = Buffer.from(png, "base64");
        await enc.write(Buffer.from(jpg, "base64"));
      } else {
        await enc.write(Buffer.from(b64, "base64"));
      }
    }
    await enc.finish();
    return { poster, frames: total, seconds: total / fps };
  } finally {
    await page.close();
  }
}
