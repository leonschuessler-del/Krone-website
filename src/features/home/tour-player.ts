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

export const packIndex = (f: number) => Math.floor(f / PACK);
export const packCount = (frames: number) => Math.ceil(frames / PACK);
const packUrl = (dir: string, set: FrameSet, p: number) => `${dir}${set}/p${String(p).padStart(2, "0")}.webp`;
export const posterUrl = (dir: string, set: FrameSet) => `${dir}${set}/poster.webp`;

/** Hosts a canvas element can draw. */
type Drawable = ImageBitmap | HTMLImageElement;

interface Pack {
  img: HTMLImageElement;
  ready: boolean;
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
 * Frame store, built so the picture is ALWAYS sharp:
 *  - every chapter is fetched as packs of full-resolution frames; the whole
 *    film is fetched ahead in the background, nearest packs first
 *  - frames around the playhead are decoded into ImageBitmaps off the main
 *    thread; drawing never waits for a decode
 *  - if the exact frame is not decoded yet, the nearest decoded frame of the
 *    same chapter is shown (a sharp frame held a moment – never a blurry one);
 *    before anything is loaded, the chapter's sharp poster is shown
 */
class FrameStore {
  private packs = new Map<string, Pack>();
  private bitmaps = new Map<string, ImageBitmap>();
  private decoding = new Set<string>();
  private posters = new Map<number, Pack>();
  private inflight = 0;
  private heads = new Map<number, number>();
  private dir = 1;
  private disposed = false;

  constructor(
    private chapters: readonly TourChapter[],
    private url: (src: string) => string,
    readonly set: FrameSet,
    private onReady: () => void,
  ) {
    chapters.forEach((c, i) => {
      const img = new Image();
      img.decoding = "async";
      const slot: Pack = { img, ready: false };
      img.onload = () => {
        slot.ready = true;
        this.onReady();
      };
      img.src = this.url(posterUrl(c.frames.dir, set));
      this.posters.set(i, slot);
    });
  }

  dispose() {
    this.disposed = true;
    for (const b of this.bitmaps.values()) b.close();
    this.bitmaps.clear();
    for (const p of this.packs.values()) p.img.src = "";
    this.packs.clear();
  }

  /** Where each visible layer is (chapter → fractional frame) and the scroll direction. */
  update(heads: Map<number, number>, direction: number) {
    this.heads = heads;
    if (direction) this.dir = direction;
    this.pump();
    this.decodeWindow();
  }

  /** Download order: packs around the playheads in scroll direction, then the rest of the film. */
  private nextPack(): [number, number] | null {
    const n = this.chapters.length;
    const want: Array<[number, number]> = [];
    for (const [c, pos] of this.heads) {
      const total = packCount(this.chapters[c]!.frames.count);
      const cur = packIndex(Math.round(pos));
      for (let d = 0; d < total; d++) {
        const ahead = cur + d * this.dir;
        if (ahead >= 0 && ahead < total) want.push([c, ahead]);
        if (d > 0 && d <= 2) {
          const back = cur - d * this.dir;
          if (back >= 0 && back < total) want.push([c, back]);
        }
      }
    }
    const top = Math.max(0, ...this.heads.keys());
    // next chapters from their start, then earlier chapters (scrolling back)
    for (let c = top + 1; c < n; c++) for (let p = 0; p < packCount(this.chapters[c]!.frames.count); p++) want.push([c, p]);
    for (let c = top - 1; c >= 0; c--) for (let p = packCount(this.chapters[c]!.frames.count) - 1; p >= 0; p--) want.push([c, p]);
    for (const w of want) if (!this.packs.has(`${w[0]}:${w[1]}`)) return w;
    return null;
  }

  private pump() {
    // more parallel requests while the playhead waits for frames, fewer for background prefetch
    while (!this.disposed && this.inflight < 4) {
      const next = this.nextPack();
      if (!next) return;
      const [c, p] = next;
      const img = new Image();
      img.decoding = "async";
      const slot: Pack = { img, ready: false };
      this.packs.set(`${c}:${p}`, slot);
      this.inflight++;
      const done = (ok: boolean) => {
        this.inflight--;
        if (ok) slot.ready = true;
        else this.packs.delete(`${c}:${p}`); // retried later
        if (this.disposed) return;
        this.decodeWindow();
        this.pump();
      };
      img.onload = () => done(true);
      img.onerror = () => done(false);
      img.src = this.url(packUrl(this.chapters[c]!.frames.dir, this.set, p));
    }
  }

  /**
   * Decode the packs around the playheads into ImageBitmaps (one decode per
   * pack, off the main thread) and release the ones that fell out of reach.
   */
  private decodeWindow() {
    if (this.disposed) return;
    const two = this.heads.size > 1;
    const AHEAD = two ? 1 : 2;
    const BEHIND = 1;
    const order: Array<[number, number]> = [];
    for (const [c, pos] of this.heads) {
      const total = packCount(this.chapters[c]!.frames.count);
      const cur = packIndex(Math.round(pos));
      for (let d = 0; d <= AHEAD; d++) {
        const ahead = cur + d * this.dir;
        if (ahead >= 0 && ahead < total) order.push([c, ahead]);
        if (d > 0 && d <= BEHIND) {
          const back = cur - d * this.dir;
          if (back >= 0 && back < total) order.push([c, back]);
        }
      }
    }
    const wanted = new Set(order.map(([c, p]) => `${c}:${p}`));
    this.wanted = wanted;
    const shown = new Set(this.shown.values());
    for (const [key, b] of this.bitmaps) {
      if (!wanted.has(key) && !shown.has(key)) {
        b.close();
        this.bitmaps.delete(key);
      }
    }
    if (typeof createImageBitmap !== "function") return;
    for (const [c, p] of order) {
      if (this.decoding.size >= 2) break;
      const key = `${c}:${p}`;
      if (this.bitmaps.has(key) || this.decoding.has(key)) continue;
      const pack = this.packs.get(key);
      if (!pack?.ready || !pack.img.naturalWidth) continue;
      this.decoding.add(key);
      const finish = (b: ImageBitmap | null) => {
        this.decoding.delete(key);
        if (b) {
          if (!this.disposed && this.wanted.has(key)) {
            this.bitmaps.set(key, b);
            this.onReady();
          } else b.close();
        }
        if (!this.disposed) this.decodeWindow();
      };
      createImageBitmap(pack.img).then(finish, () => finish(null));
    }
  }

  private wanted = new Set<string>();
  /** pack last drawn per chapter – kept until a closer frame is decoded */
  private shown = new Map<number, string>();

  /**
   * Sharp source for frame f of chapter c: the decoded frame, else the nearest
   * decoded frame of the chapter (held until the exact one is ready), else the
   * chapter poster. Never a low-resolution stand-in.
   */
  get(c: number, f: number): { img: Drawable; sx: number; sy: number; sw: number; sh: number } | null {
    const count = this.chapters[c]!.frames.count;
    const fi = Math.max(0, Math.min(count - 1, f));
    const frameOf = (g: number) => {
      if (g < 0 || g >= count) return null;
      const p = packIndex(g);
      const rows = Math.min(PACK, count - p * PACK);
      const b = this.bitmaps.get(`${c}:${p}`) ?? (typeof createImageBitmap !== "function" ? this.readyImg(`${c}:${p}`) : undefined);
      if (!b) return null;
      this.shown.set(c, `${c}:${p}`);
      const fh = b.height / rows;
      return { img: b, sx: 0, sy: (g % PACK) * fh, sw: b.width, sh: fh };
    };
    for (let d = 0; d <= 3 * PACK; d++) {
      // ties: prefer the frame behind the playhead – the picture never runs ahead of the scroll
      const src = frameOf(fi - d * this.dir) ?? (d ? frameOf(fi + d * this.dir) : null);
      if (src) return src;
    }
    // far jump: keep the last sharp frame of this chapter until the new packs are decoded
    const last = this.shown.get(c);
    if (last && this.bitmaps.has(last)) {
      const p = Number(last.split(":")[1]);
      return frameOf(fi < p * PACK ? p * PACK : Math.min(count - 1, p * PACK + PACK - 1));
    }
    const poster = this.posters.get(c);
    if (poster?.ready && poster.img.naturalWidth) return { img: poster.img, sx: 0, sy: 0, sw: poster.img.naturalWidth, sh: poster.img.naturalHeight };
    return null;
  }

  private readyImg(key: string) {
    const p = this.packs.get(key);
    return p?.ready && p.img.naturalWidth ? p.img : undefined;
  }
}

function drawCover(ctx: CanvasRenderingContext2D, src: { img: Drawable; sx: number; sy: number; sw: number; sh: number }, w: number, h: number, alpha: number, zoom = 1) {
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

  let raf = 0;
  let lastTime = 0;
  let current = -1;
  let lastTarget = -1;
  let active = -1;
  let frame: TourFrame | null = null;
  let drewOnce = false;
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
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.round(canvas.clientWidth * dpr);
    const ch = Math.round(canvas.clientHeight * dpr);
    if (cw !== canvas.width || ch !== canvas.height) {
      canvas.width = cw;
      canvas.height = ch;
    }
    w = cw;
    h = ch;
    // portrait ↔ landscape: switch to the matching frame set
    const set = pickSet(window.innerWidth, window.innerHeight);
    if (set !== store.set) {
      store.dispose();
      store = makeStore();
      fedKey = "";
    }
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
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#1c1917";
    ctx.fillRect(0, 0, w, h);
    let drew = false;
    chapters.forEach((c, i) => {
      const o = f.layerOpacity[i]!;
      if (o <= 0.001) return;
      // one whole, sharp frame – no blending of neighbouring frames (that reads as blur)
      const pos = f.layerProgress[i]! * (c.frames.count - 1);
      const src = store.get(i, Math.round(pos));
      if (!src) return;
      drawCover(ctx, src, w, h, o, f.layerScale[i] ?? 1);
      drew = true;
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
    current = current < 0 || jumped ? target : current + (target - current) * (1 - Math.exp(-dt / 110));
    if (Math.abs(target - current) < 0.0002) current = target;
    const vp = { width: section.clientWidth || window.innerWidth, height: window.innerHeight };
    const finaleTo = overviewCamera(WIDE_CAMERA, vp, map);
    frame = computeFrame(current, chapters, spans, FINALE_START_CAMERA, finaleTo);
    feed(frame, Math.sign(target - current));
    draw(frame);
    captions.forEach((el, i) => {
      const c = frame!.captionOpacity[i] ?? 0;
      el.style.opacity = c.toFixed(3);
      el.style.transform = `translate3d(0, ${((1 - c) * 18).toFixed(1)}px, 0)`;
      el.style.visibility = c > 0.01 ? "visible" : "hidden";
      el.style.pointerEvents = c > 0.5 ? "auto" : "none";
    });
    const mix = frame.plannerMix;
    if (canvas) canvas.style.opacity = (1 - mix).toFixed(3);
    if (shade) shade.style.opacity = (1 - 0.8 * mix).toFixed(3);
    if (backdrop) {
      backdrop.style.opacity = (frame.mapOpacity * mix).toFixed(3);
      backdrop.style.visibility = mix > 0.001 ? "visible" : "hidden";
    }
    let t = { tx: 0, ty: 0, scale: 1 };
    if (aerial) {
      aerial.style.opacity = frame.mapOpacity.toFixed(3);
      aerial.style.visibility = frame.mapOpacity > 0.001 ? "visible" : "hidden";
      const k = Number(aerial.dataset.k ?? 1);
      const cam = frame.mapOpacity > 0 && frame.camera.zoom < finaleTo.zoom ? finaleTo : frame.camera;
      t = cameraTransform(cam, vp, map);
      if (mix > 0) t = lerpTransform(t, fitTransform(PLOT_BOX, free), mix);
      aerial.style.transform = `translate3d(${t.tx.toFixed(2)}px, ${t.ty.toFixed(2)}px, 0) scale(${(t.scale / k).toFixed(5)})`;
    }
    if (areas) areas.style.opacity = frame.areasOpacity.toFixed(3);
    if (labelLayer) {
      labelLayer.style.opacity = frame.areasOpacity.toFixed(3);
      labelLayer.style.visibility = frame.areasOpacity > 0.01 ? "visible" : "hidden";
      if (frame.areasOpacity > 0.01) for (const l of labels) l.el.style.transform = `translate3d(${(l.x * t.scale + t.tx).toFixed(1)}px, ${(l.y * t.scale + t.ty).toFixed(1)}px, 0) translate(-50%, -50%)`;
    }
    setPlanner(frame.plannerActive);
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
      // a frame finished decoding: repaint without moving the timeline
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
  window.addEventListener("resize", onResize);
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
