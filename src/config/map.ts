/**
 * Map presentation config.
 *
 * baseLayer: the visual underlay beneath the interactive SVG polygons – a real,
 * colour-graded drone photo (top-down) of the whole plot, cropped to 3:2;
 * neighbouring buildings are desaturated, darkened and hatched in the image.
 * Replace by putting another image with the same crop into /public/media/floorplan/
 * and adjusting the polygons in src/config/floorplan.ts.
 */
export const mapConfig = {
  baseLayer: {
    type: "image" as "generated" | "image",
    src: "/media/floorplan/aerial-2048.webp",
    srcSet: "/media/floorplan/aerial-1280.webp 1280w, /media/floorplan/aerial-2048.webp 2048w, /media/floorplan/aerial-2900.webp 2900w",
    alt: "Drohnenaufnahme der Krone von oben mit den buchbaren Bereichen",
  },
  /** Show full names next to code badges from this rendered map width (px). */
  showNamesFromWidth: 820,
  disclaimer: "Drohnenaufnahme von oben · Raumgrenzen sinngemäß eingezeichnet, Nachbargebäude abgeblendet. Die Toiletten sind bei jeder Buchung inklusive.",
} as const;
