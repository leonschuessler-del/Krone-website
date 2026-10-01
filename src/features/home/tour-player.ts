import { FINALE_START_CAMERA, WIDE_CAMERA, type TourChapter } from "@/config/tour";
import { cameraTransform, chapterScrollTarget, chapterSpans, computeFrame, overviewCamera, smoothstep, type TourFrame } from "./tour-timeline";

/**
 * DOM driver of the scroll film, framework-agnostic: the React component and
 * the static preview render the same markup and both mount this player.
 *
 * Markup contract (all inside the tour <section>):
 *   canvas[data-tour-canvas]          image sequences are drawn here
 *   img[data-tour-poster]             first frame until the canvas has drawn
 *   [data-tour-caption="i"]           caption per chapter
 *   [data-tour-aerial][data-k]        finale photo (+ [data-tour-areas] overlay)
 *   [data-tour-rail="i"]              chapter buttons (jump)
 *   [data-tour-start]                 "start tour" button (jump to chapter 1)
 *   [data-tour-hint] [data-tour-skip] [data-tour-progress]
 */

export interface TourPlayerOptions {
  chapters: readonly TourChapter[];
  map: { width: number; height: number };
  /** media URLs in the config start with "/"; the static preview needs them relative */
  resolveUrl?: (src: string) => string;
  onActive?: (index: number) => void;
}

const MAX_PARALLEL = 4;
/** frames per pack file (vertical strip) */
export const PACK = 4;
/** preview track: low-res grid with every frame, columns per row */
export const PREVIEW_COLS = 10;
/** packs kept around the playhead: behind / ahead (in packs) */
const BEHIND = 2;
const AHEAD = 5;

/** 0, n-1, n/2, n/4, 3n/4 … – coarse first */
export function progressiveOrder(n: number): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const push = (i: number) => {
    if (i >= 0 && i < n && !seen.has(i)) {
      seen.add(i);
      out.push(i);
    }
  };
  push(0);
  push(n - 1);
  for (let step = n; step >= 1; step = Math.floor(step / 2)) {
    for (let i = 0; i < n; i += step) push(i + Math.floor(step / 2));
    if (step === 1) break;
  }
  for (let i = 0; i < n; i++) push(i);
  return out;
}

interface Slot {
  img: HTMLImageElement;
  ready: boolean;
}

/** A drawable source rectangle (frame inside a pack or a preview cell). */
export interface FrameSource {
  img: HTMLImageElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  sharp: boolean;
}

export const packIndex = (f: number) => Math.floor(f / PACK);
export const packCount = (frames: number) => Math.ceil(frames / PACK);

/**
 * Loads each chapter as (1) one small preview grid holding every frame – the
 * film scrubs immediately – and (2) packs of PACK full-resolution frames
 * around the playhead, prefetching in scroll direction and releasing packs
 * that fall out of the window (bounded memory, also on phones).
 */
class FrameStore {
  private packs = new Map<string, Slot>();
  private previews = new Map<number, Slot>();
  private inflight = 0;
  private queue: Array<[number, number]> = []; // [chapter, pack] ; pack -1 = preview
  private heads = new Map<number, number>(); // chapter → frame position
  private dir = 1;

  constructor(
    private chapters: readonly TourChapter[],
    private url: (src: string) => string,
    private onLoad: () => void,
  ) {}

  /** Tell the store where each visible layer is; recomputes the load queue. */
  update(heads: Map<number, number>, direction: number) {
    this.heads = heads;
    if (direction) this.dir = direction;
    const want: Array<[number, number]> = [];
    const keep = new Set<string>();
    const chapters = [...heads.keys()];
    const n = this.chapters.length;
    // previews: visible chapters and their neighbours
    const pv = new Set<number>();
    for (const c of chapters) for (const d of [0, 1, -1]) if (c + d >= 0 && c + d < n) pv.add(c + d);
    for (const c of pv) if (!this.previews.has(c)) want.push([c, -1]);
    for (const [c, pos] of heads) {
      const total = packCount(this.chapters[c]!.frames.count);
      const cur = packIndex(Math.round(pos));
      const order = [cur];
      for (let d = 1; d <= AHEAD; d++) {
        order.push(cur + d * this.dir);
        if (d <= BEHIND) order.push(cur - d * this.dir);
      }
      for (const p of order) {
        if (p < 0 || p >= total) continue;
        keep.add(`${c}:${p}`);
        if (!this.packs.has(`${c}:${p}`)) want.push([c, p]);
      }
    }
    // the first packs of the next chapter, so the cut is sharp right away
    const top = Math.max(...chapters);
    if (top + 1 < n) for (const p of [0, 1]) if (p < packCount(this.chapters[top + 1]!.frames.count)) {
      keep.add(`${top + 1}:${p}`);
      if (!this.packs.has(`${top + 1}:${p}`)) want.push([top + 1, p]);
    }
    // release packs outside the window
    for (const [k, slot] of this.packs) {
      if (!keep.has(k)) {
        slot.img.src = "";
        this.packs.delete(k);
      }
    }
    for (const [c, slot] of this.previews) {
      if (Math.min(...chapters.map((x) => Math.abs(x - c))) > 2) {
        slot.img.src = "";
        this.previews.delete(c);
      }
    }
    this.queue = want;
    this.pump();
  }

  private pump() {
    while (this.inflight < MAX_PARALLEL && this.queue.length) {
      const [c, p] = this.queue.shift()!;
      const key = `${c}:${p}`;
      if (p === -1 ? this.previews.has(c) : this.packs.has(key)) continue;
      const { dir } = this.chapters[c]!.frames;
      const img = new Image();
      img.decoding = "async";
      const slot: Slot = { img, ready: false };
      if (p === -1) this.previews.set(c, slot);
      else this.packs.set(key, slot);
      this.inflight++;
      const done = () => {
        this.inflight--;
        this.onLoad();
        this.pump();
      };
      img.onerror = done;
      img.onload = () => {
        // decode off the main thread before first use, so drawing never stalls
        const ok = () => {
          slot.ready = true;
          done();
        };
        if (typeof img.decode === "function") img.decode().then(ok, ok);
        else ok();
      };
      img.src = this.url(p === -1 ? `${dir}preview.webp` : `${dir}p${String(p).padStart(2, "0")}.webp`);
    }
  }

  /** Best available source for frame f of chapter c: sharp pack frame, else preview cell. */
  get(c: number, f: number): FrameSource | null {
    const count = this.chapters[c]!.frames.count;
    const fi = Math.max(0, Math.min(count - 1, f));
    const pack = this.packs.get(`${c}:${packIndex(fi)}`);
    if (pack?.ready && pack.img.naturalWidth) {
      const rows = Math.min(PACK, count - packIndex(fi) * PACK);
      const fh = pack.img.naturalHeight / rows;
      return { img: pack.img, sx: 0, sy: (fi % PACK) * fh, sw: pack.img.naturalWidth, sh: fh, sharp: true };
    }
    const pv = this.previews.get(c);
    if (pv?.ready && pv.img.naturalWidth) {
      const rows = Math.ceil(count / PREVIEW_COLS);
      const cw = pv.img.naturalWidth / PREVIEW_COLS;
      const ch = pv.img.naturalHeight / rows;
      return { img: pv.img, sx: (fi % PREVIEW_COLS) * cw, sy: Math.floor(fi / PREVIEW_COLS) * ch, sw: cw, sh: ch, sharp: false };
    }
    return null;
  }
}

function drawCover(ctx: CanvasRenderingContext2D, src: FrameSource, w: number, h: number, alpha: number, zoom = 1) {
  const { img, sx, sy, sw, sh } = src;
  if (!sw || !sh || alpha <= 0) return;
  const s = Math.max(w / sw, h / sh) * zoom;
  const dw = sw * s;
  const dh = sh * s;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(img, sx, sy, sw, sh, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

export function mountTourPlayer(section: HTMLElement, opts: TourPlayerOptions): () => void {
  const { chapters, map } = opts;
  const url = opts.resolveUrl ?? ((s: string) => s);
  const spans = chapterSpans(chapters);
  const q = <T extends Element>(sel: string) => section.querySelector<T>(sel);
  const canvas = q<HTMLCanvasElement>("[data-tour-canvas]");
  const ctx = canvas?.getContext("2d") ?? null;
  const poster = q<HTMLImageElement>("[data-tour-poster]");
  const aerial = q<HTMLElement>("[data-tour-aerial]");
  const areas = q<SVGElement>("[data-tour-areas]");
  const hint = q<HTMLElement>("[data-tour-hint]");
  const skip = q<HTMLElement>("[data-tour-skip]");
  const progressBar = q<HTMLElement>("[data-tour-progress]");
  const captions = new Map<number, HTMLElement>();
  section.querySelectorAll<HTMLElement>("[data-tour-caption]").forEach((el) => captions.set(Number(el.dataset.tourCaption), el));
  const rail = new Map<number, HTMLElement>();
  section.querySelectorAll<HTMLElement>("[data-tour-rail]").forEach((el) => rail.set(Number(el.dataset.tourRail), el));

  let raf = 0;
  let lastTime = 0;
  let current = -1;
  let lastTarget = -1;
  let active = -1;
  let frame: TourFrame | null = null;
  let drewOnce = false;
  let w = 0;
  let h = 0;

  const store = new FrameStore(chapters, url, () => schedule(true));
  let fedKey = "";
  /** tell the store which frames are on screen (only when a pack boundary is crossed) */
  const feed = (f: TourFrame, direction: number) => {
    const heads = new Map<number, number>();
    f.layerOpacity.forEach((o, i) => {
      if (o > 0.001) heads.set(i, f.layerProgress[i]! * (chapters[i]!.frames.count - 1));
    });
    if (heads.size === 0) heads.set(f.index, 0);
    const key = [...heads].map(([c, pos]) => `${c}:${Math.floor(pos / PACK)}`).join("|") + (direction > 0 ? "+" : direction < 0 ? "-" : "");
    if (key === fedKey) return;
    fedKey = key;
    store.update(heads, direction);
  };

  const size = () => {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.round(canvas.clientWidth * dpr);
    const ch = Math.round(canvas.clientHeight * dpr);
    if (cw !== canvas.width || ch !== canvas.height) {
      canvas.width = cw;
      canvas.height = ch;
    }
    w = cw;
    h = ch;
  };

  const draw = (f: TourFrame) => {
    if (!ctx || !w || !h) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#1c1917";
    ctx.fillRect(0, 0, w, h);
    let drew = false;
    chapters.forEach((c, i) => {
      const o = f.layerOpacity[i]!;
      if (o <= 0.001) return;
      // frame A plus an eased dissolve into frame B around the midpoint
      const pos = f.layerProgress[i]! * (c.frames.count - 1);
      const a = Math.floor(pos);
      const frac = pos - a;
      const src = store.get(i, a);
      if (!src) return;
      const zoom = f.layerScale[i] ?? 1;
      drawCover(ctx, src, w, h, o, zoom);
      drew = true;
      const blend = smoothstep(0.25, 0.75, frac);
      const next = blend > 0.01 && a + 1 < c.frames.count ? store.get(i, a + 1) : null;
      if (next && next.sharp === src.sharp) drawCover(ctx, next, w, h, o * blend, zoom);
    });
    ctx.globalAlpha = 1;
    if (drew && !drewOnce && poster) {
      drewOnce = true;
      poster.style.visibility = "hidden";
    }
  };

  const setActive = (index: number) => {
    if (index === active) return;
    active = index;
    captions.forEach((el, i) => {
      el.style.pointerEvents = i === index ? "auto" : "none";
      el.querySelectorAll<HTMLElement>("a,button").forEach((b) => (b.tabIndex = i === index ? 0 : -1));
    });
    rail.forEach((btn, i) => {
      btn.dataset.active = String(i === index);
      if (i === index) btn.setAttribute("aria-current", "step");
      else btn.removeAttribute("aria-current");
    });
    opts.onActive?.(index);
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
    current = current < 0 || jumped ? target : current + (target - current) * (1 - Math.exp(-dt / 110));
    if (Math.abs(target - current) < 0.0002) current = target;
    const vp = { width: window.innerWidth, height: window.innerHeight };
    const finaleTo = overviewCamera(WIDE_CAMERA, vp, map);
    frame = computeFrame(current, chapters, spans, FINALE_START_CAMERA, finaleTo);
    feed(frame, Math.sign(target - current));
    draw(frame);
    captions.forEach((el, i) => {
      const c = frame!.captionOpacity[i] ?? 0;
      el.style.opacity = c.toFixed(3);
      el.style.transform = `translate3d(0, ${((1 - c) * 18).toFixed(1)}px, 0)`;
      el.style.visibility = c > 0.01 ? "visible" : "hidden";
    });
    if (aerial) {
      aerial.style.opacity = frame.mapOpacity.toFixed(3);
      aerial.style.visibility = frame.mapOpacity > 0.001 ? "visible" : "hidden";
      const k = Number(aerial.dataset.k ?? 1);
      const cam = frame.mapOpacity > 0 && frame.camera.zoom < finaleTo.zoom ? finaleTo : frame.camera;
      const { tx, ty, scale } = cameraTransform(cam, vp, map);
      aerial.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${(scale / k).toFixed(5)})`;
    }
    if (areas) areas.style.opacity = frame.areasOpacity.toFixed(3);
    if (skip) {
      const o = 1 - frame.areasOpacity;
      skip.style.opacity = o.toFixed(3);
      skip.style.visibility = o > 0.01 ? "visible" : "hidden";
    }
    if (hint) {
      hint.style.opacity = frame.scrollHint.toFixed(3);
      hint.style.display = frame.scrollHint > 0.001 ? "" : "none";
    }
    if (progressBar) progressBar.style.transform = `scaleX(${current.toFixed(4)})`;
    setActive(frame.index);
    if (current !== target) raf = requestAnimationFrame(tick);
    else lastTime = 0;
  };

  function schedule(redrawOnly = false) {
    if (redrawOnly && frame && !raf) {
      // a frame finished loading: repaint without moving the timeline
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (frame) draw(frame);
      });
      return;
    }
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  const onScroll = () => schedule();
  const onResize = () => {
    size();
    schedule();
  };

  const jumpTo = (index: number) => {
    const scrollable = section.offsetHeight - window.innerHeight;
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + chapterScrollTarget(spans[index]!, scrollable, index === 0 ? 0 : 0.5), behavior: "instant" as ScrollBehavior });
  };
  const onClick = (e: Event) => {
    const el = (e.target as Element).closest<HTMLElement>("[data-tour-rail],[data-tour-start]");
    if (!el || !section.contains(el)) return;
    e.preventDefault();
    jumpTo(el.dataset.tourRail !== undefined ? Number(el.dataset.tourRail) : 1);
  };

  size();
  feed(computeFrame(0, chapters, spans, FINALE_START_CAMERA, WIDE_CAMERA), 1);
  schedule();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  section.addEventListener("click", onClick);
  const ro = typeof ResizeObserver !== "undefined" && canvas ? new ResizeObserver(onResize) : null;
  if (ro && canvas) ro.observe(canvas);

  return () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    section.removeEventListener("click", onClick);
    ro?.disconnect();
    if (raf) cancelAnimationFrame(raf);
  };
}
