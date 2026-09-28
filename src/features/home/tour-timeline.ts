import type { TourCamera, TourChapter } from "@/config/tour";

/**
 * Pure timeline maths for the scroll tour (no DOM) – unit tested.
 * Input: overall scroll progress p ∈ [0, 1]. Output: everything a frame needs.
 */

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Hermite smoothstep between edge0 and edge1. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Camera interpolation; `t` is expected to be eased already. Zoom is interpolated
 *  geometrically so zooming in and out feels equally fast. */
export function lerpCamera(a: TourCamera, b: TourCamera, t: number): TourCamera {
  const e = clamp01(t);
  return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), zoom: a.zoom * Math.pow(b.zoom / a.zoom, e) };
}

export interface ChapterSpan {
  start: number;
  end: number;
}

/** Equal spans (storyboard) or spans derived from videoTime values (video mode). */
export function chapterSpans(chapters: readonly TourChapter[], videoDuration: number | null = null): ChapterSpan[] {
  const n = chapters.length;
  const times = chapters.map((c) => c.videoTime);
  if (videoDuration && times.every((t) => t !== null)) {
    return chapters.map((_, i) => ({ start: times[i]! / videoDuration, end: (i + 1 < n ? times[i + 1]! : videoDuration) / videoDuration }));
  }
  return chapters.map((_, i) => ({ start: i / n, end: (i + 1) / n }));
}

export interface TourFrame {
  index: number;
  /** progress inside the current chapter */
  t: number;
  camera: TourCamera;
  /** opacity of each chapter's room image layer (0 for intro/finale) */
  roomOpacity: number[];
  /** crossfade to the second image of the room (0…1) */
  roomSecondary: number[];
  /** Ken-Burns scale of each room layer */
  roomScale: number[];
  /** caption / text opacity per chapter */
  captionOpacity: number[];
  /** highlight opacity of each chapter's space polygon on the aerial view */
  polygonOpacity: number[];
  /** all polygons (finale) */
  allPolygons: number;
  scrollHint: number;
}

export function computeFrame(
  p: number,
  chapters: readonly TourChapter[],
  spans: readonly ChapterSpan[],
  wide: TourCamera,
  /** Finale bird's-eye camera (see `overviewCamera`); defaults to the finale chapter's camera. */
  overview: TourCamera = chapters[chapters.length - 1]!.camera,
): TourFrame {
  const n = chapters.length;
  const progress = clamp01(p);
  let index = spans.findIndex((s) => progress >= s.start && progress < s.end);
  if (index < 0) index = n - 1;
  const span = spans[index]!;
  const t = clamp01((progress - span.start) / Math.max(1e-6, span.end - span.start));

  const roomOpacity = new Array<number>(n).fill(0);
  const roomSecondary = new Array<number>(n).fill(0);
  const roomScale = new Array<number>(n).fill(1.14);
  const captionOpacity = new Array<number>(n).fill(0);
  const polygonOpacity = new Array<number>(n).fill(0);
  let allPolygons = 0;

  const chapter = chapters[index]!;
  const prevCamera = index === 0 ? wide : chapters[index - 1]!.camera;
  let camera: TourCamera;

  if (index === 0) {
    // Intro: slow push-in over the whole property.
    camera = lerpCamera(wide, chapter.camera, smoothstep(0, 1, t));
    captionOpacity[0] = 1 - smoothstep(0.55, 0.9, t);
  } else if (index === n - 1 && chapter.spaceId === null) {
    // Finale: fly back out to the full bird's-eye view, boundaries appear.
    camera = lerpCamera(prevCamera, overview, smoothstep(0, 0.45, t));
    allPolygons = smoothstep(0.35, 0.65, t);
    captionOpacity[index] = smoothstep(0.4, 0.62, t);
  } else {
    // Room chapter: approach on the aerial view, then dive into the room.
    const approach = smoothstep(0, 0.34, t);
    camera = lerpCamera(prevCamera, chapter.camera, approach);
    // subtle push-in while the room is shown; released before the chapter ends
    // so the next chapter starts exactly where this one stops (no jumps)
    const push = smoothstep(0.2, 0.4, t) * (1 - smoothstep(0.8, 0.98, t));
    camera = { ...camera, zoom: camera.zoom * (1 + 0.06 * push) };
    polygonOpacity[index] = smoothstep(0.06, 0.24, t);
    roomOpacity[index] = smoothstep(0.26, 0.4, t) * (1 - smoothstep(0.86, 0.985, t));
    roomSecondary[index] = smoothstep(0.56, 0.7, t);
    roomScale[index] = 1.14 - 0.12 * smoothstep(0.26, 0.98, t);
    captionOpacity[index] = smoothstep(0.36, 0.46, t) * (1 - smoothstep(0.82, 0.92, t));
  }

  return {
    index,
    t,
    camera,
    roomOpacity,
    roomSecondary,
    roomScale,
    captionOpacity,
    polygonOpacity,
    allPolygons,
    scrollHint: index === 0 ? 1 - smoothstep(0.05, 0.25, t) : 0,
  };
}

export interface Viewport {
  width: number;
  height: number;
}

/**
 * Screen transform for the site plan so that camera.(x,y) is centred.
 * zoom >= 1 always covers the viewport (no empty edges); zoom < 1 (portrait
 * overview) may letterbox, but keeps the plan fully inside the viewport.
 */
export function cameraTransform(camera: TourCamera, vp: Viewport, map: { width: number; height: number }): { tx: number; ty: number; scale: number } {
  const cover = Math.max(vp.width / map.width, vp.height / map.height);
  const scale = cover * camera.zoom;
  // slack < 0: plan overflows -> clamp to its edges; slack >= 0: plan fits -> keep it fully inside
  const place = (view: number, size: number, c: number) => {
    const slack = view - size * scale;
    return Math.min(Math.max(0, slack), Math.max(Math.min(0, slack), view / 2 - c * scale));
  };
  return { tx: place(vp.width, map.width, camera.x), ty: place(vp.height, map.height, camera.y), scale };
}

/** Plan x-range holding every bookable area (Biergarten x≈122 … Nebenzimmer/Bühne x≈996). */
const OVERVIEW_SPAN = { from: 100, to: 1020 } as const;

/**
 * Finale bird's-eye camera for this viewport: unchanged on landscape; on portrait
 * screens, where "cover" would crop the plan to a strip, zoom out below 1 so all
 * areas stay in frame.
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
