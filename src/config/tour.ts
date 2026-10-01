/**
 * ============================================================================
 *  SCROLL FILM – the opening of the homepage
 * ============================================================================
 *  Scrolling scrubs through real, colour-graded footage of the Krone – one
 *  short shot per chapter, crossfaded – and ends on the drone photo from above
 *  where the bookable areas appear as buttons (→ interactive map below).
 *
 *  Order: Anflug von außen → Biergarten → Wintergarten → Hauptrestaurant →
 *  Nebenzimmer → Bühne → Küche → Alte Wirtschaft → Hotel → Blick von oben.
 *
 *  Each chapter is an image sequence (/public/media/tour/frames/<id>/00.webp …)
 *  drawn on a canvas. Unlike video seeking this scrubs smoothly in every
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
export const WIDE_CAMERA: TourCamera = { x: 900, y: 512, zoom: 1 };
/** Where the finale camera starts before settling on WIDE_CAMERA. */
export const FINALE_START_CAMERA: TourCamera = { x: 820, y: 420, zoom: 1.6 };

export const TOUR_FRAME_COUNT = 36;
const clip = (id: string) => ({
  frames: { dir: `/media/tour/frames/${id}/`, count: TOUR_FRAME_COUNT },
  poster: `/media/tour/frames/${id}/00.webp`,
});

export const tourConfig = {
  /** Scroll distance per chapter in viewport heights. Smaller = faster tour. */
  scrollPerChapterVh: { desktop: 70, mobile: 60 },
  chapters: [
    { id: "intro", spaceId: null, ...clip("intro") },
    { id: "beer-garden", spaceId: "beer-garden", ...clip("beer-garden"), kicker: "Unter freiem Himmel" },
    { id: "winter-garden", spaceId: "winter-garden", ...clip("winter-garden"), kicker: "Licht von allen Seiten" },
    { id: "restaurant", spaceId: "restaurant", ...clip("restaurant"), kicker: "Das Herz des Hauses" },
    { id: "side-room", spaceId: "side-room", ...clip("side-room"), kicker: "Für Feiern im eigenen Rahmen" },
    { id: "stage", spaceId: "stage", ...clip("stage"), kicker: "Ihr Auftritt" },
    { id: "kitchen", spaceId: "kitchen", ...clip("kitchen"), kicker: "Wo alles entsteht" },
    { id: "old-tavern", spaceId: "old-tavern", ...clip("old-tavern"), kicker: "Gemütlich wie früher" },
    { id: "hotel", spaceId: "hotel", ...clip("hotel"), kicker: "Übernachten im Haus" },
    { id: "finale", spaceId: null, ...clip("finale") },
  ] satisfies TourChapter[],
  copy: {
    scrollHint: "Scrollen Sie durch die Krone",
    skip: "Rundgang überspringen",
    finaleTitle: "Alles gesehen? Jetzt Bereiche wählen.",
    finaleText: "Stellen Sie sich Ihre Location auf dem Grundriss zusammen – einzelne Räume, mehrere Bereiche oder das ganze Haus.",
    finaleCta: "Zum Grundriss",
  },
};
