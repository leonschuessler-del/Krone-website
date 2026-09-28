import { spaceShapes } from "@/config/floorplan";

/**
 * ============================================================================
 *  SCROLL TOUR – the opening "film" of the homepage
 * ============================================================================
 *  Scrolling drives a continuous camera flight: bird's-eye view → every room
 *  in quick succession → back to the bird's-eye view → the interactive map.
 *
 *  Two modes:
 *   - "storyboard" (default): our own site plan + room images (real photos
 *     when present, otherwise the demo illustrations) animated by scroll.
 *   - "video": the real property film is scrubbed by scroll position. Enable
 *     by placing /public/media/hero/krone-property-tour.mp4 and setting
 *     `video.enabled = true`. For smooth scrubbing encode with short keyframe
 *     distance, e.g.
 *       ffmpeg -i film.mov -c:v libx264 -preset slow -crf 22 -g 8 -keyint_min 8 \
 *              -pix_fmt yuv420p -movflags +faststart -an krone-property-tour.mp4
 *     and set `videoTime` (seconds) for each chapter below.
 *
 *  Chapter order follows the planned film: Restaurant → Bühne → Nebenzimmer →
 *  Alte Wirtschaft → Küche → Wintergarten → Biergarten → Hotel.
 * ============================================================================
 */

export interface TourCamera {
  /** Point of the site plan (viewBox 1536×1024) at the centre of the screen */
  x: number;
  y: number;
  /** 1 = whole property fills the screen */
  zoom: number;
}

export interface TourChapter {
  id: string;
  /** Linked space (room chapters). null for intro / finale. */
  spaceId: string | null;
  camera: TourCamera;
  /** Start time of this chapter in the real film (video mode only). */
  videoTime: number | null;
}

const labelOf = (spaceId: string) => spaceShapes.find((s) => s.spaceId === spaceId)?.labelPosition ?? null;

function roomCamera(spaceId: string, zoom = 2.1): TourCamera {
  const p = labelOf(spaceId);
  return p ? { x: p.x, y: p.y + 20, zoom } : { x: 770, y: 480, zoom: 1.25 };
}

export const WIDE_CAMERA: TourCamera = { x: 700, y: 512, zoom: 1 };

export const tourConfig = {
  /** Scroll distance per chapter in viewport heights. Smaller = faster tour. */
  scrollPerChapterVh: { desktop: 62, mobile: 52 },
  video: {
    enabled: false,
    src: "/media/hero/krone-property-tour.mp4",
    /** Total film duration (seconds) – used when chapters define videoTime. */
    duration: null as number | null,
  },
  chapters: [
    { id: "intro", spaceId: null, camera: { x: 720, y: 500, zoom: 1.08 }, videoTime: 0 },
    { id: "restaurant", spaceId: "restaurant", camera: roomCamera("restaurant", 2.2), videoTime: null },
    { id: "stage", spaceId: "stage", camera: roomCamera("stage", 2.5), videoTime: null },
    { id: "side-room", spaceId: "side-room", camera: roomCamera("side-room", 2.5), videoTime: null },
    { id: "old-tavern", spaceId: "old-tavern", camera: roomCamera("old-tavern", 2.1), videoTime: null },
    { id: "kitchen", spaceId: "kitchen", camera: roomCamera("kitchen", 2.5), videoTime: null },
    { id: "winter-garden", spaceId: "winter-garden", camera: roomCamera("winter-garden", 2.4), videoTime: null },
    { id: "beer-garden", spaceId: "beer-garden", camera: roomCamera("beer-garden", 1.9), videoTime: null },
    { id: "hotel", spaceId: "hotel", camera: { x: 780, y: 470, zoom: 1.35 }, videoTime: null },
    { id: "finale", spaceId: null, camera: WIDE_CAMERA, videoTime: null },
  ] satisfies TourChapter[],
  copy: {
    scrollHint: "Scrollen Sie durch die Krone",
    skip: "Rundgang überspringen",
    finaleTitle: "Stellen Sie Ihre Location zusammen.",
    finaleText: "Wählen Sie jetzt auf dem Grundriss einen oder mehrere Bereiche – oder öffnen Sie die Details jedes Raums.",
    finaleCta: "Zum Grundriss",
  },
};
