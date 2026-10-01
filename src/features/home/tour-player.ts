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

const MAX_PARALLEL = 6;
/** chapters kept in memory around the active one */
const KEEP = 2;

/** 0, n-1, n/2, n/4, 3n/4 … – coarse first, so scrubbing works before everything loaded */
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

class FrameStore {
  private images: Array<Array<HTMLImageElement | undefined>>;
  private ready: boolean[][];
  private inflight = 0;
  private wanted: number[] = [];

  constructor(
    private chapters: readonly TourChapter[],
    private url: (src: string) => string,
    private onLoad: () => void,
  ) {
    this.images = chapters.map((c) => new Array(c.frames.count));
    this.ready = chapters.map((c) => new Array<boolean>(c.frames.count).fill(false));
  }

  focus(active: number) {
    const n = this.chapters.length;
    this.wanted = [active, active + 1, active - 1, active + 2].filter((i) => i >= 0 && i < n);
    // free memory far away from the viewer
    this.chapters.forEach((_, i) => {
      if (Math.abs(i - active) > KEEP + 1) {
        this.images[i] = new Array(this.chapters[i]!.frames.count);
        this.ready[i]!.fill(false);
      }
    });
    this.pump();
  }

  private pump() {
    while (this.inflight < MAX_PARALLEL) {
      const next = this.nextMissing();
      if (!next) return;
      this.load(next[0], next[1]);
    }
  }

  private nextMissing(): [number, number] | null {
    // first frame of every wanted chapter, then the rest progressively
    for (const c of this.wanted) if (!this.images[c]![0]) return [c, 0];
    const active = this.wanted[0] ?? 0;
    for (const f of progressiveOrder(this.chapters[active]!.frames.count).slice(0, 12)) if (!this.images[active]![f]) return [active, f];
    for (const c of this.wanted) {
      for (const f of progressiveOrder(this.chapters[c]!.frames.count)) if (!this.images[c]![f]) return [c, f];
    }
    return null;
  }

  private load(c: number, f: number) {
    const { dir } = this.chapters[c]!.frames;
    const img = new Image();
    img.decoding = "async";
    const list = this.images[c]!;
    list[f] = img;
    this.inflight++;
    const done = (ok: boolean) => {
      this.inflight--;
      if (ok && this.images[c] === list) this.ready[c]![f] = true;
      this.onLoad();
      this.pump();
    };
    img.onerror = () => done(false);
    img.onload = () => {
      // decode off the main thread before the frame is used, so drawing never stalls
      if (typeof img.decode === "function") img.decode().then(() => done(true), () => done(true));
      else done(true);
    };
    img.src = this.url(`${dir}${String(f).padStart(2, "0")}.webp`);
  }

  hasExact(c: number, f: number) {
    return !!this.ready[c]?.[f];
  }

  /** nearest loaded frame to f (prefers the exact one) */
  get(c: number, f: number): HTMLImageElement | null {
    const ready = this.ready[c];
    if (!ready) return null;
    for (let d = 0; d < ready.length; d++) {
      if (ready[f - d]) return this.images[c]![f - d]!;
      if (ready[f + d]) return this.images[c]![f + d]!;
    }
    return null;
  }

}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, alpha: number, zoom = 1) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih || alpha <= 0) return;
  const s = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * s;
  const dh = ih * s;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
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
      // frame A plus a short, eased dissolve into frame B around the midpoint:
      // softens the step between frames without ghosting on fast moves
      const pos = f.layerProgress[i]! * (c.frames.count - 1);
      const a = Math.floor(pos);
      const frac = pos - a;
      const img = store.get(i, a);
      if (!img) return;
      const zoom = f.layerScale[i] ?? 1;
      drawCover(ctx, img, w, h, o, zoom);
      drew = true;
      const blend = smoothstep(0.3, 0.7, frac);
      if (blend > 0.01 && a + 1 < c.frames.count && store.hasExact(i, a + 1)) drawCover(ctx, store.get(i, a + 1)!, w, h, o * blend, zoom);
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
    store.focus(index);
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
  store.focus(0);
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
