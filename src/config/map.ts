/**
 * Map presentation config.
 *
 * baseLayer: the visual underlay beneath the interactive SVG polygons.
 *   - "generated": our own stylised site plan, rendered from
 *     `src/config/site-plan.ts` and served at /map/base.svg (default)
 *   - "image": any image with the same aspect ratio (1536:1024), e.g. a
 *     licensed drone orthophoto placed in /public/media/floorplan/
 */
export const mapConfig = {
  baseLayer: {
    type: "generated" as "generated" | "image",
    src: "/map/base.svg",
    alt: "Stilisierte Vogelperspektive des Grundstücks Zur Krone (schematisch)",
  },
  /** Show full names next to code badges from this rendered map width (px). */
  showNamesFromWidth: 720,
  disclaimer: "Schematische Darstellung – nicht maßstabsgetreu. Raumgrenzen werden noch final abgestimmt.",
} as const;
