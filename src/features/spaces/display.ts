import { siteScope } from "@/config/scope";

/**
 * Background for a short space code badge (NZ, WG, AW …) with white text.
 * Some space colours are too light for white 14–18px text (Nebenzimmer #c49a2c: 2.6:1).
 * Mixing 62 % of the colour with anthracite keeps the hue and gives ≥ 5.2:1 for every space.
 * Polygons, dots and the source colours in globals.css stay unchanged.
 */
export function badgeBg(color: string): string {
  return `color-mix(in srgb, ${color} 62%, #1b1816)`;
}

/**
 * Public link target of a space. In the event-only scope the hotel floor is an add-on
 * on the start page; /bereiche/hotel only redirects there, so link to the section directly.
 */
export function spaceHref(space: { type: string; href: string }): string {
  return siteScope.eventOnly && space.type === "hotel" ? "/#hotel" : space.href;
}
