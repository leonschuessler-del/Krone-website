import { FINALE_START_CAMERA, WIDE_CAMERA, type TourChapter } from "@/config/tour";
import { plotOutline } from "@/config/floorplan";
import {
  cameraTransform,
  chapterScrollTarget,
  chapterSpans,
  computeFrame,
  fitTransform,
  lerpTransform,
  overviewCamera,
  plannerProgress,
  type FreeArea,
  type TourFrame,
} from "./tour-timeline";

/**
 * DOM driver of the scroll film, framework-agnostic: the React component and
 * the static preview render the same markup and both mount this player.
 *
 * Markup contract (all inside the tour <section>):
 *   canvas[data-tour-canvas]          image sequences are drawn here
 *   img[data-tour-poster]             first frame until the canvas has drawn
 *   [data-tour-caption="i"]           caption per chapter (the last one is the planner panel)
 *   [data-tour-aerial][data-k]        finale photo (+ [data-tour-areas] overlay)
 *   [data-tour-backdrop]              blurred photo behind the planner
 *   [data-tour-labels] > [data-x][data-y]  area buttons, positioned on the photo
 *   [data-tour-planner]               planner panel (measured to place the photo beside it)
 *   [data-tour-rail="i"]              chapter buttons (jump)
 *   [data-tour-start]                 "start tour" button (jump to chapter 1)
 *   [data-tour-jump=planner]          jump to the planner (also links to #karte / #grundriss)
 *   [data-tour-hint] [data-tour-skip] [data-tour-progress]
 *
 * Performance rules (the film must never stall the page):
 *   - per animation frame only cheap work: one or two drawImage calls of an
 *     already decoded frame, and style writes only for values that changed
 *   - the canvas is redrawn only when what it shows changed
 *   - decoding happens off the main thread, a few packs ahead of the playhead
 */

export interface TourPlayerOptions {
  chapters: readonly TourChapter[];
  map: { width: number; height: number };
  /** media URLs in the config start with "/"; the static preview needs them relative */
  resolveUrl?: (src: string) => string;
  onActive?: (index: number) => void;
}

/** frames per pack file (vertical strip) – must match tools/media/film3.py */
export const PACK = 6;
/** frame sets: 16:9 for landscape screens, 9:16 crop for portrait screens */
export type FrameSet = "d" | "m";
export const pickSet = (vw: number, vh: number): FrameSet => (vw / Math.max(1, vh) < 1 ? "m" : "d");
/** pixel size of one frame per set – must match tools/media/film3.py (SETS) */
export const FRAME_SIZE: Record<FrameSet, { w: number; h: number }> = { d: { w: 1920, h: 1080 }, m: { w: 720, h: 1280 } };

export const packIndex = (f: number) => Math.floor(f / PACK);
export const packCount = (frames: number) => Math.ceil(frames / PACK);
const packUrl = (dir: string, set: FrameSet, p: number) => `${dir}${set}/p${String(p).padStart(2, "0")}.webp`;
export const posterUrl = (dir: string, set: FrameSet) => `${dir}${set}/poster.webp`;

/**
 * Backing-store scale of the canvas (canvas px per CSS px): the screen's
 * pixel ratio, but never more pixels than the frames have ("cover" fit).
 * A 2880×1800 canvas showing a 1920-px frame only costs fill rate and
 * memory – the compositor scales the smaller canvas up for free.
 */
export function canvasScale(cssW: number, cssH: number, dpr: number, frame: { w: number; h: number }): number {
  if (cssW <= 0 || cssH <= 0) return 1;
  const native = Math.min(frame.w / cssW, frame.h / cssH);
  return Math.max(0.5, Math.min(dpr || 1, 2, native));
}

/**
 * Download window, nearest first: `ahead` packs from each playhead in scroll
 * direction (running on into the following chapters), two packs behind, the
 * first pack of the next chapter (so a cut never waits) and the last pack of
 * the chapter behind (quick turn-around). Never the whole film at once – a
 * phone would otherwise load ~80 MB on arrival, and every far-away pack would
 * compete with the ones needed right now. The window moves with the playhead.
 */
export function fetchWindow(packs: readonly number[], heads: ReadonlyMap<number, number>, dir: number, ahead = 10): Array<[number, number]> {
  const d = dir < 0 ? -1 : 1;
  const out: Array<[number, number]> = [];
  const seen = new Set<string>();
  const push = (c: number, p: number) => {
    const k = `${c}:${p}`;
    if (c < 0 || c >= packs.length || p < 0 || p >= packs[c]! || seen.has(k)) return;
    seen.add(k);
    out.push([c, p]);
  };
  const keys = [...heads.keys()];
  if (keys.length === 0) return out;
  // the front playhead first: during a crossfade that is the incoming clip
  const ordered = [...heads].sort((a, b) => (b[0] - a[0]) * d);
  for (const [c0, pos] of ordered) {
    let c = c0;
    let p = packIndex(Math.max(0, Math.round(pos)));
    for (let k = 0; k < ahead; k++) {
      push(c, p);
      if (k > 0 && k <= 2) push(c0, packIndex(Math.max(0, Math.round(pos))) - k * d);
      p += d;
      if (p < 0 || p >= (packs[c] ?? 0)) {
        c += d;
        if (c < 0 || c >= packs.length) break;
        p = d > 0 ? 0 : packs[c]! - 1;
      }
    }
  }
  const front = d > 0 ? Math.max(...keys) : Math.min(...keys);
  const back = d > 0 ? Math.min(...keys) : Math.max(...keys);
  const next = front + d;
  if (next >= 0 && next < packs.length) push(next, d > 0 ? 0 : packs[next]! - 1);
  const behind = back - d;
  if (behind >= 0 && behind < packs.length) push(behind, d > 0 ? packs[behind]! - 1 : 0);
  return out;
}

/** Hosts a canvas element can draw. */
type Drawable = ImageBitmap | HTMLImageElement;
interface Source {
  img: Drawable;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}
/** a decoded pack: one bitmap per frame (or the whole strip where cropping is unsupported) */
interface Decoded {
  frames: ImageBitmap[];
  strip: boolean;
}

/** Map URLs to plot hash targets that should open the planner inside the film. */
const PLANNER_HASHES = new Set(["#karte", "#grundriss", "#raumplaner"]);

/** Bounding box of the plot (map units), with a little air around it. */
const PLOT_BOX = (() => {
  const xs = plotOutline.map((p) => p[0]);
  const ys = plotOutline.map((p) => p[1]);
  const pad = 24;
  return { x0: Math.min(...xs) - pad, y0: Math.min(...ys) - pad, x1: Math.max(...xs) + pad, y1: Math.max(...ys) + pad };
})();

/**
 * Frame store, built so the film is always sharp AND always moving – without
 * ever stalling the main thread:
 *  - packs are fetched (as Blobs, or <img> where fetch is not allowed) only in
 *    a window around the playhead (see fetchWindow); far-away packs are
 *    released again and come back from the HTTP cache when needed
 *  - packs around the playhead are decoded in a small worker (createImageBitmap)
 *    and cut there into one bitmap per frame, which are handed over without
 *    copying. The main thread never decodes or copies pixels, and the GPU only
 *    uploads the frame on screen instead of a whole 6-frame strip (~50 MB on
 *    desktop) – that upload was the visible hitch at every pack change.
 *    Without workers (or if one cannot start) the same happens on the page.
 *  - drawing never decodes; until a frame is ready the nearest decoded frame
 *    of the chapter stays on screen (never a blurred stand-in)
 *  - the store measures how many frames per second it can decode; the player
 *    caps the film's speed to that rate, so a fast flick plays as one
 *    continuous, even movement instead of jumping from held frame to held frame
 */
/**
 * Decoder worker, inlined (no extra bundle entry – works in the app, in the
 * static preview and when embedded elsewhere): Blob → strip → one bitmap per
 * frame, transferred back to the page.
 */
const DECODER_SOURCE = `
self.onmessage = async (e) => {
  const { id, blob, rows } = e.data;
  try {
    const strip = await createImageBitmap(blob);
    let frames = [strip];
    if (rows > 1) {
      const fh = Math.round(strip.height / rows);
      frames = await Promise.all(Array.from({ length: rows }, (_, k) => createImageBitmap(strip, 0, k * fh, strip.width, fh)));
      strip.close();
    }
    self.postMessage({ id, frames }, frames);
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};`;

class Decoder {
  private worker: Worker | null = null;
  private url = "";
  private seq = 0;
  private pending = new Map<number, { resolve: (f: ImageBitmap[]) => void; reject: (e: Error) => void }>();

  constructor() {
    if (typeof Worker === "undefined" || typeof Blob === "undefined" || typeof URL?.createObjectURL !== "function") return;
    try {
      this.url = URL.createObjectURL(new Blob([DECODER_SOURCE], { type: "text/javascript" }));
      this.worker = new Worker(this.url);
      this.worker.onmessage = (e: MessageEvent<{ id: number; frames?: ImageBitmap[]; error?: string }>) => {
        const job = this.pending.get(e.data.id);
        if (!job) return e.data.frames?.forEach((b) => b.close());
        this.pending.delete(e.data.id);
        if (e.data.frames) job.resolve(e.data.frames);
        else {
          // e.g. createImageBitmap missing in workers (old Safari): decode on the page from now on
          this.stop();
          job.reject(new Error(e.data.error ?? "decode failed"));
        }
      };
      this.worker.onerror = () => this.stop();
    } catch {
      this.stop();
    }
  }

  get available() {
    return this.worker !== null;
  }

  decode(blob: Blob, rows: number): Promise<ImageBitmap[]> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error("no worker"));
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, blob, rows });
    });
  }

  stop() {
    this.worker?.terminate();
    this.worker = null;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = "";
    for (const job of this.pending.values()) job.reject(new Error("worker stopped"));
    this.pending.clear();
  }
}

class FrameStore {
  private decoder = new Decoder();
  private blobs = new Map<string, Blob | HTMLImageElement>();
  private loading = new Set<string>();
  private decoded = new Map<string, Decoded>();
  private decoding = new Set<string>();
  private posters = new Map<number, HTMLImageElement>();
  private heads = new Map<number, number>();
  private dir = 1;
  private disposed = false;
  private canBitmap = typeof createImageBitmap === "function";
  private useFetch = typeof fetch === "function" && typeof createImageBitmap === "function";
  private canCrop = true;
  private packs: number[];
  /** decoded frames per second (smoothed) – the film's speed limit */
  rate: number;
  /** bumps whenever something new became drawable (the player redraws then) */
  version = 0;
  private wanted = new Set<string>();
  /** pack last drawn per chapter – kept until a closer one is decoded */
  private shown = new Map<number, string>();

  constructor(
    private chapters: readonly TourChapter[],
    private url: (src: string) => string,
    readonly set: FrameSet,
    private onReady: () => void,
  ) {
    this.rate = set === "m" ? 90 : 120;
    this.packs = chapters.map((c) => packCount(c.frames.count));
    this.poster(0);
  }

  /** chapter posters (first frame): loaded when the film gets near the chapter */
  private poster(c: number) {
    if (this.disposed || c < 0 || c >= this.chapters.length || this.posters.has(c)) return;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      img.decode().then(
        () => this.ready(),
        () => this.ready(),
      );
    };
    img.src = this.url(posterUrl(this.chapters[c]!.frames.dir, this.set));
    this.posters.set(c, img);
  }

  private ready() {
    if (this.disposed) return;
    this.version++;
    this.onReady();
  }

  dispose() {
    this.disposed = true;
    this.decoder.stop();
    for (const d of this.decoded.values()) d.frames.forEach((b) => b.close());
    this.decoded.clear();
    this.blobs.clear();
  }

  /** Where each visible layer is (chapter → fractional frame) and the scroll direction. */
  update(heads: Map<number, number>, direction: number) {
    this.heads = heads;
    if (direction) this.dir = direction;
    for (const c of heads.keys()) {
      this.poster(c);
      this.poster(c + this.dir);
    }
    this.pump();
    this.decodeWindow();
  }

  private pump() {
    if (this.disposed) return;
    // ~60 frames (desktop) / ~48 frames (phone) ahead: several seconds of film
    const order = fetchWindow(this.packs, this.heads, this.dir, this.set === "m" ? 8 : 10);
    // release compressed packs that left the window (the HTTP cache keeps them)
    if (this.blobs.size > order.length + 12) {
      const keep = new Set(order.map(([c, p]) => `${c}:${p}`));
      for (const k of [...this.blobs.keys()]) if (!keep.has(k) && !this.decoding.has(k)) this.blobs.delete(k);
    }
    const max = this.set === "m" ? 3 : 4;
    for (const [c, p] of order) {
      if (this.loading.size >= max) return;
      const key = `${c}:${p}`;
      if (this.blobs.has(key) || this.loading.has(key) || this.decoded.has(key)) continue;
      this.load(c, p, key);
    }
  }

  private load(c: number, p: number, key: string) {
    const src = this.url(packUrl(this.chapters[c]!.frames.dir, this.set, p));
    this.loading.add(key);
    const done = (data: Blob | HTMLImageElement | null) => {
      this.loading.delete(key);
      if (this.disposed) return;
      if (data) this.blobs.set(key, data);
      if (data instanceof HTMLImageElement) this.ready();
      this.decodeWindow();
      this.pump();
    };
    if (this.useFetch) {
      fetch(src)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then(done, () => {
          // fetch not permitted here (embedding policy): fall back to <img>
          this.useFetch = false;
          this.loading.delete(key);
          this.pump();
        });
    } else {
      const img = new Image();
      img.decoding = "async";
      // decode before the strip is first drawn – never on the scroll path
      img.onload = () => {
        img.decode().then(
          () => done(img),
          () => done(img),
        );
      };
      img.onerror = () => done(null);
      img.src = src;
    }
  }

  /** Fallback without the worker: cut a decoded strip into one bitmap per frame on the page. */
  private async split(strip: ImageBitmap, rows: number): Promise<Decoded> {
    if (!this.canCrop || rows <= 1) return { frames: [strip], strip: rows > 1 };
    const fh = Math.round(strip.height / rows);
    try {
      const frames = await Promise.all(Array.from({ length: rows }, (_, k) => createImageBitmap(strip, 0, k * fh, strip.width, fh)));
      strip.close();
      return { frames, strip: false };
    } catch {
      this.canCrop = false;
      return { frames: [strip], strip: true };
    }
  }

  /** Decode the packs around the playheads (a few ahead) and release the ones out of reach. */
  private decodeWindow() {
    if (this.disposed) return;
    const two = this.heads.size > 1;
    // a decoded frame costs w×h×4 bytes: ~8 MB (desktop) / ~4.7 MB (phone)
    const AHEAD = this.set === "m" ? (two ? 2 : 3) : two ? 2 : 4;
    const BEHIND = 1;
    const order: Array<[number, number]> = [];
    for (const [c, pos] of this.heads) {
      const total = this.packs[c]!;
      const cur = packIndex(Math.max(0, Math.round(pos)));
      for (let d = 0; d <= AHEAD; d++) {
        const ahead = cur + d * this.dir;
        if (ahead >= 0 && ahead < total) order.push([c, ahead]);
        if (d > 0 && d <= BEHIND) {
          const back = cur - d * this.dir;
          if (back >= 0 && back < total) order.push([c, back]);
        }
      }
    }
    // the first pack of the next chapter, so the cut never waits
    const keys = [...this.heads.keys()];
    if (keys.length) {
      const next = this.dir > 0 ? Math.max(...keys) + 1 : Math.min(...keys) - 1;
      if (next >= 0 && next < this.chapters.length) order.push([next, this.dir > 0 ? 0 : this.packs[next]! - 1]);
    }
    const wanted = new Set(order.map(([c, p]) => `${c}:${p}`));
    this.wanted = wanted;
    const shown = new Set(this.shown.values());
    for (const [key, d] of this.decoded) {
      if (!wanted.has(key) && !shown.has(key)) {
        d.frames.forEach((b) => b.close());
        this.decoded.delete(key);
      }
    }
    if (!this.canBitmap) return;
    for (const [c, p] of order) {
      if (this.decoding.size >= 2) break;
      const key = `${c}:${p}`;
      if (this.decoded.has(key) || this.decoding.has(key)) continue;
      const data = this.blobs.get(key);
      if (!data) continue;
      this.decoding.add(key);
      const t0 = performance.now();
      const rows = Math.min(PACK, this.chapters[c]!.frames.count - p * PACK);
      const finish = (d: Decoded | null) => {
        this.decoding.delete(key);
        if (d) {
          // measured decode speed → speed limit of the film (smoothed)
          const fps = rows / Math.max(0.004, (performance.now() - t0) / 1000);
          this.rate = Math.min(260, Math.max(40, this.rate * 0.8 + fps * 0.2));
          if (!this.disposed && this.wanted.has(key)) {
            this.decoded.set(key, d);
            this.ready();
          } else d.frames.forEach((b) => b.close());
        }
        if (!this.disposed) {
          this.decodeWindow();
          this.pump();
        }
      };
      const job: Promise<Decoded> =
        data instanceof Blob && this.decoder.available
          ? this.decoder.decode(data, rows).then((frames) => ({ frames, strip: frames.length === 1 && rows > 1 }))
          : createImageBitmap(data).then((strip) => this.split(strip, rows));
      job.then(finish, () => finish(null));
    }
  }

  /**
   * Sharp source for frame f of chapter c: the decoded frame, else the nearest
   * decoded frame of the chapter, else the chapter poster. Never a low-resolution stand-in.
   */
  get(c: number, f: number): Source | null {
    const count = this.chapters[c]!.frames.count;
    const fi = Math.max(0, Math.min(count - 1, f));
    const frameOf = (g: number): Source | null => {
      if (g < 0 || g >= count) return null;
      const p = packIndex(g);
      const key = `${c}:${p}`;
      const rows = Math.min(PACK, count - p * PACK);
      const d = this.decoded.get(key);
      if (d) {
        this.shown.set(c, key);
        if (!d.strip) {
          const b = d.frames[g - p * PACK]!;
          return { img: b, sx: 0, sy: 0, sw: b.width, sh: b.height };
        }
        const b = d.frames[0]!;
        const fh = b.height / rows;
        return { img: b, sx: 0, sy: (g % PACK) * fh, sw: b.width, sh: fh };
      }
      // no createImageBitmap (very old browsers): draw the decoded <img> strip
      const raw = this.canBitmap ? undefined : this.blobs.get(key);
      if (raw instanceof HTMLImageElement && raw.naturalWidth) {
        const fh = raw.naturalHeight / rows;
        return { img: raw, sx: 0, sy: (g % PACK) * fh, sw: raw.naturalWidth, sh: fh };
      }
      return null;
    };
    for (let d = 0; d <= 3 * PACK; d++) {
      const src = frameOf(fi - d * this.dir) ?? (d ? frameOf(fi + d * this.dir) : null);
      if (src) return src;
    }
    const last = this.shown.get(c);
    if (last && this.decoded.has(last)) {
      const p = Number(last.split(":")[1]);
      return frameOf(fi < p * PACK ? p * PACK : Math.min(count - 1, p * PACK + PACK - 1));
    }
    this.poster(c);
    const poster = this.posters.get(c);
    if (poster?.complete && poster.naturalWidth) return { img: poster, sx: 0, sy: 0, sw: poster.naturalWidth, sh: poster.naturalHeight };
    return null;
  }
}

function drawCover(ctx: CanvasRenderingContext2D, src: Source, w: number, h: number, alpha: number, zoom = 1) {
  const { img, sx, sy, sw, sh } = src;
  if (!sw || !sh || alpha <= 0) return;
  const s = Math.max(w / sw, h / sh) * zoom;
  const dw = sw * s;
  const dh = sh * s;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(img, sx, sy, sw, sh, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/** Writes an inline style only when its value changed (style writes invalidate style). */
function styleWriter() {
  const last = new WeakMap<HTMLElement | SVGElement, Map<string, string>>();
  return (el: HTMLElement | SVGElement | null, prop: "opacity" | "transform" | "visibility" | "pointerEvents" | "display", value: string) => {
    if (!el) return;
    let m = last.get(el);
    if (!m) last.set(el, (m = new Map()));
    if (m.get(prop) === value) return;
    m.set(prop, value);
    el.style[prop] = value;
  };
}

export function mountTourPlayer(section: HTMLElement, opts: TourPlayerOptions): () => void {
  const { chapters, map } = opts;
  const url = opts.resolveUrl ?? ((s: string) => s);
  const spans = chapterSpans(chapters);
  const q = <T extends Element>(sel: string) => section.querySelector<T>(sel);
  const canvas = q<HTMLCanvasElement>("[data-tour-canvas]");
  const ctx = canvas?.getContext("2d", { alpha: false }) ?? null;
  const poster = q<HTMLElement>("[data-tour-poster]");
  const aerial = q<HTMLElement>("[data-tour-aerial]");
  const areas = q<SVGElement>("[data-tour-areas]");
  const backdrop = q<HTMLElement>("[data-tour-backdrop]");
  const labelLayer = q<HTMLElement>("[data-tour-labels]");
  const planner = q<HTMLElement>("[data-tour-planner]");
  const shade = q<HTMLElement>("[data-tour-shade]");
  const hint = q<HTMLElement>("[data-tour-hint]");
  const skip = q<HTMLElement>("[data-tour-skip]");
  const progressBar = q<HTMLElement>("[data-tour-progress]");
  const captions = new Map<number, HTMLElement>();
  section.querySelectorAll<HTMLElement>("[data-tour-caption]").forEach((el) => captions.set(Number(el.dataset.tourCaption), el));
  const rail = new Map<number, HTMLElement>();
  section.querySelectorAll<HTMLElement>("[data-tour-rail]").forEach((el) => rail.set(Number(el.dataset.tourRail), el));
  const labels = labelLayer ? [...labelLayer.querySelectorAll<HTMLElement>("[data-x]")].map((el) => ({ el, x: Number(el.dataset.x), y: Number(el.dataset.y) })) : [];
  const css = styleWriter();

  let raf = 0;
  let lastTime = 0;
  let current = -1;
  let lastTarget = -1;
  let active = -1;
  let frame: TourFrame | null = null;
  let drewOnce = false;
  let drawn = "";
  let shownFrame = "";
  let w = 0;
  let h = 0;
  let free: FreeArea = { left: 0, top: 0, right: 1, bottom: 1 };
  let plannerOn = false;

  const makeStore = () => new FrameStore(chapters, url, pickSet(window.innerWidth, window.innerHeight), () => schedule(true));
  let store = makeStore();
  let fedKey = "";
  /** tell the store which frames are on screen (only when the frame under a playhead changes) */
  const feed = (f: TourFrame, direction: number) => {
    const heads = new Map<number, number>();
    f.layerOpacity.forEach((o, i) => {
      if (o > 0.001) heads.set(i, f.layerProgress[i]! * (chapters[i]!.frames.count - 1));
    });
    if (heads.size === 0) heads.set(f.index, 0);
    const key = [...heads].map(([c, pos]) => `${c}:${Math.round(pos)}`).join("|") + (direction > 0 ? "+" : direction < 0 ? "-" : "");
    if (key === fedKey) return;
    fedKey = key;
    store.update(heads, direction);
  };

  const size = () => {
    if (!canvas) return;
    // portrait ↔ landscape: switch to the matching frame set
    const set = pickSet(window.innerWidth, window.innerHeight);
    if (set !== store.set) {
      store.dispose();
      store = makeStore();
      fedKey = "";
    }
    const k = canvasScale(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1, FRAME_SIZE[store.set]);
    const cw = Math.round(canvas.clientWidth * k);
    const ch = Math.round(canvas.clientHeight * k);
    if (cw !== canvas.width || ch !== canvas.height) {
      canvas.width = cw;
      canvas.height = ch;
      drawn = "";
    }
    w = cw;
    h = ch;
    // free screen area for the photo in the planner: beside (desktop) or above (phone) the panel
    const vw = section.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    if (planner && planner.offsetWidth) {
      const side = planner.offsetLeft > vw * 0.4;
      free = side
        ? { left: 32, top: 96, right: planner.offsetLeft - 40, bottom: vh - 40 }
        : { left: 12, top: 76, right: vw - 12, bottom: planner.offsetTop - 14 };
    } else {
      free = { left: 24, top: 96, right: vw - 24, bottom: vh - 40 };
    }
  };

  const draw = (f: TourFrame) => {
    if (!ctx || !w || !h) return;
    // the planner covers the film completely: nothing to paint
    if (f.plannerMix >= 0.999 && drewOnce) return;
    // what would be painted – skip the frame if nothing changed
    let sig = `${w}x${h}#${store.version}`;
    const layers: Array<[number, number]> = [];
    chapters.forEach((c, i) => {
      const o = f.layerOpacity[i]!;
      if (o <= 0.001) return;
      const at = Math.round(f.layerProgress[i]! * (c.frames.count - 1));
      layers.push([i, at]);
      sig += `|${i}:${at}:${o.toFixed(3)}:${(f.layerScale[i] ?? 1).toFixed(4)}`;
    });
    if (sig === drawn) return;
    ctx.globalAlpha = 1;
    // the canvas has (about) the frames' own resolution: bilinear is sharp
    // here and avoids building mipmaps for every new frame
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "low";
    let drew = false;
    let covered = false;
    for (const [i, at] of layers) {
      const src = store.get(i, at);
      if (!src) continue;
      const o = f.layerOpacity[i]!;
      // an opaque bottom layer fills the canvas – no clearing needed
      if (!covered && o < 0.999) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#1c1917";
        ctx.fillRect(0, 0, w, h);
      }
      drawCover(ctx, src, w, h, o, f.layerScale[i] ?? 1);
      covered = true;
      drew = true;
      // for tests and tuning: which frame of which chapter is on screen
      if (i === f.index) {
        const id = `${i}:${at}`;
        if (id !== shownFrame) section.dataset.tourFrame = shownFrame = id;
      }
    }
    ctx.globalAlpha = 1;
    if (!drew) {
      ctx.fillStyle = "#1c1917";
      ctx.fillRect(0, 0, w, h);
    }
    // only remember a complete paint – otherwise retry when frames arrive
    drawn = drew ? sig : "";
    if (drew && !drewOnce && poster) {
      drewOnce = true;
      poster.style.visibility = "hidden";
    }
  };

  const setActive = (index: number) => {
    if (index === active) return;
    active = index;
    captions.forEach((el, i) => {
      el.querySelectorAll<HTMLElement>("a,button").forEach((b) => (b.tabIndex = i === index ? 0 : -1));
    });
    rail.forEach((btn, i) => {
      btn.dataset.active = String(i === index);
      if (i === index) btn.setAttribute("aria-current", "step");
      else btn.removeAttribute("aria-current");
    });
    opts.onActive?.(index);
  };

  const setPlanner = (on: boolean) => {
    if (on === plannerOn) return;
    plannerOn = on;
    section.dataset.planner = on ? "on" : "off";
    labels.forEach((l) => (l.el.tabIndex = on ? 0 : -1));
  };

  const measure = () => {
    const rect = section.getBoundingClientRect();
    const scrollable = Math.max(1, rect.height - window.innerHeight);
    return Math.min(1, Math.max(0, -rect.top / scrollable));
  };

  const tick = () => {
    raf = 0;
    const target = measure();
    // an instant jump (skip link, history restore) snaps instead of fast-forwarding
    const jumped = lastTarget >= 0 && Math.abs(target - lastTarget) > 0.2;
    lastTarget = target;
    // frame-rate independent easing (τ ≈ 110 ms): silky on 60 Hz and 120 Hz alike
    const now = performance.now();
    const dt = lastTime ? Math.min(64, now - lastTime) : 16;
    lastTime = now;
    const vp = { width: section.clientWidth || window.innerWidth, height: window.innerHeight };
    const finaleTo = overviewCamera(WIDE_CAMERA, vp, map);
    let next = current < 0 || jumped ? target : current + (target - current) * (1 - Math.exp(-dt / 110));
    if (current >= 0 && !jumped) {
      // speed limit: never ask for more frames per second than the device can
      // decode – a fast flick then plays as one even, continuous movement
      // (following behind the scroll) instead of jumping between held frames
      const at = computeFrame(current, chapters, spans, FINALE_START_CAMERA, finaleTo);
      const c = chapters[at.index]!;
      const span = spans[at.index]!;
      const framesPerProgress = (c.frames.count - 1) / Math.max(1e-6, span.end - span.start);
      const maxStep = (store.rate * (dt / 1000)) / framesPerProgress;
      if (Math.abs(next - current) > maxStep) next = current + Math.sign(next - current) * maxStep;
    }
    current = next;
    if (Math.abs(target - current) < 0.0002) current = target;
    frame = computeFrame(current, chapters, spans, FINALE_START_CAMERA, finaleTo);
    feed(frame, Math.sign(target - current));
    draw(frame);
    captions.forEach((el, i) => {
      const c = Math.round((frame!.captionOpacity[i] ?? 0) * 1000) / 1000;
      css(el, "opacity", String(c));
      css(el, "transform", `translate3d(0, ${((1 - c) * 18).toFixed(1)}px, 0)`);
      css(el, "visibility", c > 0.01 ? "visible" : "hidden");
      css(el, "pointerEvents", c > 0.5 ? "auto" : "none");
    });
    const mix = frame.plannerMix;
    css(canvas, "opacity", (1 - mix).toFixed(3));
    css(shade, "opacity", (1 - 0.8 * mix).toFixed(3));
    css(backdrop, "opacity", (frame.mapOpacity * mix).toFixed(3));
    css(backdrop, "visibility", mix > 0.001 ? "visible" : "hidden");
    let t = { tx: 0, ty: 0, scale: 1 };
    if (aerial) {
      const shown = frame.mapOpacity > 0.001;
      css(aerial, "opacity", frame.mapOpacity.toFixed(3));
      css(aerial, "visibility", shown ? "visible" : "hidden");
      const k = Number(aerial.dataset.k ?? 1);
      const cam = frame.mapOpacity > 0 && frame.camera.zoom < finaleTo.zoom ? finaleTo : frame.camera;
      t = cameraTransform(cam, vp, map);
      if (mix > 0) t = lerpTransform(t, fitTransform(PLOT_BOX, free), mix);
      if (shown) css(aerial, "transform", `translate3d(${t.tx.toFixed(1)}px, ${t.ty.toFixed(1)}px, 0) scale(${(t.scale / k).toFixed(5)})`);
    }
    css(areas, "opacity", frame.areasOpacity.toFixed(3));
    if (labelLayer) {
      css(labelLayer, "opacity", frame.areasOpacity.toFixed(3));
      css(labelLayer, "visibility", frame.areasOpacity > 0.01 ? "visible" : "hidden");
      if (frame.areasOpacity > 0.01) for (const l of labels) css(l.el, "transform", `translate3d(${(l.x * t.scale + t.tx).toFixed(1)}px, ${(l.y * t.scale + t.ty).toFixed(1)}px, 0) translate(-50%, -50%)`);
    }
    setPlanner(frame.plannerActive);
    if (skip) {
      const o = 1 - frame.areasOpacity;
      css(skip, "opacity", o.toFixed(3));
      css(skip, "visibility", o > 0.01 ? "visible" : "hidden");
    }
    if (hint) {
      css(hint, "opacity", frame.scrollHint.toFixed(3));
      css(hint, "display", frame.scrollHint > 0.001 ? "" : "none");
    }
    css(progressBar, "transform", `scaleX(${current.toFixed(4)})`);
    setActive(frame.index);
    if (current !== target) raf = requestAnimationFrame(tick);
    else lastTime = 0;
  };

  function schedule(redrawOnly = false) {
    if (redrawOnly) {
      // a frame finished decoding: repaint without moving the timeline
      if (frame && !raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (frame) draw(frame);
        });
      }
      return;
    }
    // one tick per animation frame, however many scroll events arrive
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  const onScroll = () => schedule();
  const onResize = () => {
    size();
    schedule();
  };

  const scrollToProgress = (p: number) => {
    const scrollable = section.offsetHeight - window.innerHeight;
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + p * scrollable, behavior: "instant" as ScrollBehavior });
  };
  const jumpTo = (index: number) => {
    const scrollable = section.offsetHeight - window.innerHeight;
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + chapterScrollTarget(spans[index]!, scrollable, index === 0 ? 0 : 0.5), behavior: "instant" as ScrollBehavior });
  };
  const jumpToPlanner = () => scrollToProgress(plannerProgress(chapters, spans));
  const tourVisible = () => section.offsetHeight > 0;

  const onClick = (e: Event) => {
    const el = (e.target as Element).closest<HTMLElement>("[data-tour-rail],[data-tour-start],[data-tour-jump],a[href]");
    if (!el || !tourVisible()) return;
    if (el.matches("a[href]")) {
      // links to the map (header, buttons, other sections) open the planner inside the film
      const href = el.getAttribute("href") ?? "";
      const hash = href.startsWith("#") ? href : href.startsWith("/#") ? href.slice(1) : "";
      if (!PLANNER_HASHES.has(hash)) return;
      e.preventDefault();
      history.replaceState(null, "", hash);
      jumpToPlanner();
      return;
    }
    e.preventDefault();
    if (el.dataset.tourJump === "planner") jumpToPlanner();
    else jumpTo(el.dataset.tourRail !== undefined ? Number(el.dataset.tourRail) : 1);
  };
  const onHash = () => {
    if (tourVisible() && PLANNER_HASHES.has(location.hash)) jumpToPlanner();
  };

  size();
  feed(computeFrame(0, chapters, spans, FINALE_START_CAMERA, WIDE_CAMERA), 1);
  schedule();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("hashchange", onHash);
  document.addEventListener("click", onClick);
  const ro = typeof ResizeObserver !== "undefined" && canvas ? new ResizeObserver(onResize) : null;
  if (ro && canvas) ro.observe(canvas);
  if (PLANNER_HASHES.has(location.hash)) requestAnimationFrame(onHash);

  return () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("hashchange", onHash);
    document.removeEventListener("click", onClick);
    ro?.disconnect();
    if (raf) cancelAnimationFrame(raf);
    store.dispose();
  };
}
