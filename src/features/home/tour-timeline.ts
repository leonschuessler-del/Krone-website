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

/** Equal spans per chapter. */
export function chapterSpans(chapters: readonly Pick<TourChapter, "id">[]): ChapterSpan[] {
  const n = chapters.length;
  return chapters.map((_, i) => ({ start: i / n, end: (i + 1) / n }));
}

/** Share of a chapter used to crossfade from the previous clip. */
export const CROSSFADE = 0.16;

export interface TourFrame {
  index: number;
  /** progress inside the current chapter */
  t: number;
  /** opacity of each chapter's clip layer */
  videoOpacity: number[];
  /** playback position (0…1) of each chapter's clip */
  videoProgress: number[];
  /** caption / text opacity per chapter */
  captionOpacity: number[];
  /** finale: drone photo with the area buttons (0…1) */
  mapOpacity: number;
  /** finale: area outlines on the photo (0…1) */
  areasOpacity: number;
  /** finale camera on the photo */
  camera: TourCamera;
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

  const videoOpacity = new Array<number>(n).fill(0);
  const videoProgress = new Array<number>(n).fill(0);
  const captionOpacity = new Array<number>(n).fill(0);

  // current clip plays through the whole chapter; it fades in over the previous one
  const fadeIn = index === 0 ? 1 : smoothstep(0, CROSSFADE, t);
  videoOpacity[index] = fadeIn;
  videoProgress[index] = t;
  if (index > 0 && fadeIn < 1) {
    videoOpacity[index - 1] = 1;
    videoProgress[index - 1] = 1;
  }
  // previous clips keep their last frame (needed when scrolling back)
  for (let i = 0; i < index - 1; i++) videoProgress[i] = 1;

  let mapOpacity = 0;
  let areasOpacity = 0;
  let camera = finaleFrom;
  const isFinale = index === n - 1 && chapters[index]!.spaceId === null;

  if (index === 0) {
    captionOpacity[0] = 1 - smoothstep(0.5, 0.85, t);
  } else if (isFinale) {
    // drone rises above the roof, then the photo from straight above takes over
    mapOpacity = smoothstep(0.42, 0.62, t);
    areasOpacity = smoothstep(0.58, 0.78, t);
    camera = lerpCamera(finaleFrom, finaleTo, smoothstep(0.42, 0.9, t));
    captionOpacity[index] = smoothstep(0.66, 0.84, t);
  } else {
    captionOpacity[index] = smoothstep(CROSSFADE * 0.6, CROSSFADE + 0.12, t) * (1 - smoothstep(0.84, 0.97, t));
  }

  return {
    index,
    t,
    videoOpacity,
    videoProgress,
    captionOpacity,
    mapOpacity,
    areasOpacity,
    camera,
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

/** Map x-range holding every bookable area (Alte Wirtschaft x≈338 … Biergarten x≈1103). */
const OVERVIEW_SPAN = { from: 300, to: 1140 } as const;

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
