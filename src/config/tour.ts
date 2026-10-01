import frameCounts from "@/generated/tour-frames.json";
/**
 * ============================================================================
 *  SCROLL FILM – the opening of the homepage
 * ============================================================================
 *  Scrolling scrubs through real, colour-graded footage of the Krone – one
 *  short shot per chapter, crossfaded – and ends on the drone photo from above
 *  where the bookable areas appear as buttons (→ interactive map below).
 *
 *  Order: Anflug von außen → Hauptrestaurant → Nebenzimmer → Bühne →
 *  Wintergarten → Biergarten → Küche → Alte Wirtschaft → Hotel → Blick von oben.
 *
 *  Each chapter is an image sequence (/public/media/tour/frames/<id>/, packed
 *  4 frames per file) drawn on a canvas. Unlike video seeking this scrubs smoothly in every
 *  browser (incl. iOS Safari and embedded viewers) and in both directions.
 *  The grading/extraction pipeline is documented in docs/MEDIA.md.
 * ============================================================================
 */

export interface TourCamera {
  /** Point of the map (viewBox 1536×1024) at the centre of the screen */
  x: number;
  y: number;
  /** 1 = the whole map image fills the screen */
  zoom: number;
}

export interface TourChapter {
  id: string;
  /** Linked space (room chapters). null for intro / finale. */
  spaceId: string | null;
  /** Image sequence scrubbed by scroll: `${dir}00.webp` … */
  frames: { dir: string; count: number };
  /** First frame (instant first paint). */
  poster: string;
  /** Short line under the title (intro/finale use their own copy). */
  kicker?: string;
}

/** Bird's-eye framing of the finale (drone photo with all areas). */
export const WIDE_CAMERA: TourCamera = { x: 920, y: 520, zoom: 1 };
/** Where the finale camera starts before settling on WIDE_CAMERA. */
export const FINALE_START_CAMERA: TourCamera = { x: 820, y: 420, zoom: 1.6 };

/**
 * Frames per chapter come from the media pipeline (tools/media/film.py writes
 * src/generated/tour-frames.json): the count follows the amount of camera
 * movement, so every scroll step shows the same small step of motion.
 * Files: pNN.webp (packs of 4 frames), preview.webp (all frames, small), poster.webp.
 */
const clip = (id: keyof typeof frameCounts) => ({
  frames: { dir: `/media/tour/frames/${id}/`, count: frameCounts[id] },
  poster: `/media/tour/frames/${id}/poster.webp`,
});

export const tourConfig = {
  /** Scroll distance per chapter in viewport heights. Smaller = faster tour. */
  scrollPerChapterVh: { desktop: 66, mobile: 58 },
  chapters: [
    { id: "intro", spaceId: null, ...clip("intro") },
    { id: "restaurant", spaceId: "restaurant", ...clip("restaurant"), kicker: "Das Herz des Hauses" },
    { id: "side-room", spaceId: "side-room", ...clip("side-room"), kicker: "Für Feiern im eigenen Rahmen" },
    { id: "stage", spaceId: "stage", ...clip("stage"), kicker: "Ihr Auftritt" },
    { id: "winter-garden", spaceId: "winter-garden", ...clip("winter-garden"), kicker: "Licht von allen Seiten" },
    { id: "beer-garden", spaceId: "beer-garden", ...clip("beer-garden"), kicker: "Unter freiem Himmel" },
    { id: "kitchen", spaceId: "kitchen", ...clip("kitchen"), kicker: "Wo alles entsteht" },
    { id: "old-tavern", spaceId: "old-tavern", ...clip("old-tavern"), kicker: "Gemütlich wie früher" },
    { id: "hotel", spaceId: "hotel", ...clip("hotel"), kicker: "Übernachten im Haus" },
    { id: "finale", spaceId: null, ...clip("finale") },
  ] satisfies TourChapter[],
  copy: {
    scrollHint: "Scrollen",
    skip: "Rundgang überspringen",
    finaleTitle: "Ihr Fest. Ihre Räume.",
    finaleText: "Wählen Sie auf der Karte, was Ihre Feier braucht – einen Raum, mehrere oder das ganze Haus.",
    finaleCta: "Zur Karte",
  },
};
