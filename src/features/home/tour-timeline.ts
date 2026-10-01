import type { TourCamera, TourChapter } from "@/config/tour";

/**
 * Pure timeline maths for the scroll film (no DOM) – unit tested.
 * Input: overall scroll progress p ∈ [0, 1]. Output: everything a frame needs.
 */

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Hermite smoothstep between edge0 and edge1. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Camera interpolation; `t` is expected to be eased already. Zoom is geometric. */
export function lerpCamera(a: TourCamera, b: TourCamera, t: number): TourCamera {
  const e = clamp01(t);
  return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), zoom: a.zoom * Math.pow(b.zoom / a.zoom, e) };
}

export interface ChapterSpan {
  start: number;
  end: number;
}

/**
 * Scroll weight of a chapter: chapters with more camera movement (more
 * frames) get proportionally more scroll distance, so the film never rushes.
 */
export function chapterWeight(c: Pick<TourChapter, "id"> & { frames?: { count: number } }): number {
  const n = c.frames?.count ?? 40;
  const film = Math.min(2.6, Math.max(1, n / 60));
  // the finale plays its clip in the first half, then hands over to the planner
  return c.id === "finale" ? film / FINALE_FILM_SHARE : film;
}

export function totalWeight(chapters: readonly (Pick<TourChapter, "id"> & { frames?: { count: number } })[]): number {
  return chapters.reduce((sum, c) => sum + chapterWeight(c), 0);
}

/** Spans per chapter, proportional to their scroll weight. */
export function chapterSpans(chapters: readonly (Pick<TourChapter, "id"> & { frames?: { count: number } })[]): ChapterSpan[] {
  const total = totalWeight(chapters);
  let acc = 0;
  return chapters.map((c, i) => {
    const start = acc / total;
    acc += chapterWeight(c);
    return { start, end: i === chapters.length - 1 ? 1 : acc / total };
  });
}

/** Share of the finale chapter used by its clip; the rest belongs to the map and the planner. */
export const FINALE_FILM_SHARE = 0.5;

/** Share of a chapter used to crossfade from the previous clip. */
export const CROSSFADE = 0.3;
/** Share of each clip reserved to keep moving underneath the next chapter's fade-in. */
export const TAIL = 0.14;

export interface TourFrame {
  index: number;
  /** progress inside the current chapter */
  t: number;
  /** opacity of each chapter layer */
  layerOpacity: number[];
  /** position (0…1) inside each chapter.s image sequence */
  layerProgress: number[];
  /** extra zoom per layer: the outgoing shot keeps pushing in while the next one settles (continuous motion across the cut) */
  layerScale: number[];
  /** caption / text opacity per chapter */
  captionOpacity: number[];
  /** finale: drone photo with the area buttons (0…1) */
  mapOpacity: number;
  /** finale: area outlines on the photo (0…1) */
  areasOpacity: number;
  /** finale camera on the photo */
  camera: TourCamera;
  /** finale: 0 = wide camera, 1 = planner layout (photo beside the panel) */
  plannerMix: number;
  /** finale: the planner is fully shown and takes clicks */
  plannerActive: boolean;
  scrollHint: number;
}

export function computeFrame(
  p: number,
  chapters: readonly TourChapter[],
  spans: readonly ChapterSpan[],
  finaleFrom: TourCamera,
  finaleTo: TourCamera,
): TourFrame {
  const n = chapters.length;
  const progress = clamp01(p);
  let index = spans.findIndex((s) => progress >= s.start && progress < s.end);
  if (index < 0) index = n - 1;
  const span = spans[index]!;
  const t = clamp01((progress - span.start) / Math.max(1e-6, span.end - span.start));

  const layerOpacity = new Array<number>(n).fill(0);
  const layerProgress = new Array<number>(n).fill(0);
  const captionOpacity = new Array<number>(n).fill(0);
  const layerScale = new Array<number>(n).fill(1);

  // Each clip plays its first (1 - TAIL) during its own chapter and keeps moving
  // through its tail while the next clip fades in – no frozen frame at the cut.
  const head = (i: number) => (i === n - 1 ? 1 : 1 - TAIL);
  const isLast = index === n - 1 && chapters[index]!.spaceId === null;
  // the finale clip runs in the first FINALE_FILM_SHARE of its (longer) chapter
  const cut = isLast ? CROSSFADE * FINALE_FILM_SHARE : CROSSFADE;
  const fadeIn = index === 0 ? 1 : smoothstep(0, cut, t);
  layerOpacity[index] = fadeIn;
  layerProgress[index] = isLast ? clamp01(t / FINALE_FILM_SHARE) : t * head(index);
  if (index > 0 && fadeIn < 1) {
    const k = clamp01(t / cut);
    layerOpacity[index - 1] = 1;
    layerProgress[index - 1] = head(index - 1) + (1 - head(index - 1)) * k;
    layerScale[index - 1] = 1 + 0.05 * k;
    layerScale[index] = 1.04 - 0.04 * smoothstep(0, 1, k);
  }
  // previous clips keep their last frame (needed when scrolling back)
  for (let i = 0; i < index - 1; i++) layerProgress[i] = 1;

  let mapOpacity = 0;
  let areasOpacity = 0;
  let camera = finaleFrom;
  let plannerMix = 0;
  let plannerActive = false;

  if (index === 0) {
    captionOpacity[0] = 1 - smoothstep(0.5, 0.85, t);
  } else if (isLast) {
    // drone rises above the roof, the photo from straight above takes over,
    // keeps climbing while the planner fades in, then stays (dwell)
    mapOpacity = smoothstep(0.3, 0.44, t);
    areasOpacity = smoothstep(0.42, 0.56, t);
    camera = lerpCamera(finaleFrom, finaleTo, smoothstep(0.3, 0.56, t));
    plannerMix = smoothstep(0.52, 0.76, t);
    captionOpacity[index] = smoothstep(0.5, 0.64, t);
    plannerActive = t >= 0.6;
  } else {
    captionOpacity[index] = smoothstep(CROSSFADE * 0.6, CROSSFADE + 0.12, t) * (1 - smoothstep(0.84, 0.97, t));
  }

  return {
    index,
    t,
    layerOpacity,
    layerProgress,
    layerScale,
    captionOpacity,
    mapOpacity,
    areasOpacity,
    camera,
    plannerMix,
    plannerActive,
    scrollHint: index === 0 ? 1 - smoothstep(0.05, 0.25, t) : 0,
  };
}

export interface Viewport {
  width: number;
  height: number;
}

/**
 * Screen transform for the map image so that camera.(x,y) is centred.
 * zoom >= 1 always covers the viewport; zoom < 1 (portrait overview) may
 * letterbox but keeps the image fully inside the viewport.
 */
export function cameraTransform(camera: TourCamera, vp: Viewport, map: { width: number; height: number }): { tx: number; ty: number; scale: number } {
  const cover = Math.max(vp.width / map.width, vp.height / map.height);
  const scale = cover * camera.zoom;
  const place = (view: number, size: number, c: number) => {
    const slack = view - size * scale;
    return Math.min(Math.max(0, slack), Math.max(Math.min(0, slack), view / 2 - c * scale));
  };
  return { tx: place(vp.width, map.width, camera.x), ty: place(vp.height, map.height, camera.y), scale };
}

/** Map x-range holding the whole plot (Alte Wirtschaft x≈487 … Parkplatz x≈1377). */
const OVERVIEW_SPAN = { from: 470, to: 1390 } as const;

/**
 * Finale camera for this viewport: unchanged on landscape; on portrait screens,
 * where "cover" would crop the photo to a strip, zoom out so all areas stay in frame.
 */
export function overviewCamera(camera: TourCamera, vp: Viewport, map: { width: number; height: number }): TourCamera {
  const cover = Math.max(vp.width / map.width, vp.height / map.height);
  const zoom = vp.width / (OVERVIEW_SPAN.to - OVERVIEW_SPAN.from) / cover;
  return zoom >= camera.zoom ? camera : { x: (OVERVIEW_SPAN.from + OVERVIEW_SPAN.to) / 2, y: camera.y, zoom };
}

/** Scroll position (px from the top of the tour) for jumping to a chapter. */
export function chapterScrollTarget(span: ChapterSpan, scrollable: number, at = 0.5): number {
  return (span.start + (span.end - span.start) * at) * scrollable;
}

/** Screen box (px) the plot should occupy in the planner, beside/above the panel. */
export interface FreeArea {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Transform that fits `box` (map units) into the free screen area, centred. */
export function fitTransform(box: { x0: number; y0: number; x1: number; y1: number }, free: FreeArea): { tx: number; ty: number; scale: number } {
  const fw = Math.max(1, free.right - free.left);
  const fh = Math.max(1, free.bottom - free.top);
  const scale = Math.min(fw / (box.x1 - box.x0), fh / (box.y1 - box.y0));
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  return { tx: (free.left + free.right) / 2 - cx * scale, ty: (free.top + free.bottom) / 2 - cy * scale, scale };
}

/** Interpolates two screen transforms (scale geometrically, keeping motion straight). */
export function lerpTransform(a: { tx: number; ty: number; scale: number }, b: { tx: number; ty: number; scale: number }, t: number) {
  const e = clamp01(t);
  return { tx: lerp(a.tx, b.tx, e), ty: lerp(a.ty, b.ty, e), scale: a.scale * Math.pow(b.scale / a.scale, e) };
}

/** Progress (0…1 of the tour) where the planner is fully shown – target of "Zur Karte" links. */
export function plannerProgress(chapters: readonly TourChapter[], spans: readonly ChapterSpan[]): number {
  const last = spans[chapters.length - 1]!;
  return last.start + (last.end - last.start) * 0.8;
}
