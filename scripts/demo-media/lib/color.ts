/** Tiny colour helpers (hex in, hex out). */

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear mix of two colours, t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex([ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k]);
}

export const lighten = (c: string, t: number) => mix(c, "#fffaf0", t);
export const darken = (c: string, t: number) => mix(c, "#140f0b", t);

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Brand palette (matches src/app/globals.css). */
export const P = {
  paper: "#fbf8f2",
  cream: "#f4eee2",
  sand: "#e8dfcd",
  stone: "#cfc5b3",
  taupe: "#8f8474",
  ink: "#231e1b",
  inkSoft: "#3b332d",
  anthracite: "#1c1917",
  night: "#15120f",
  gold: "#b8904a",
  goldLight: "#d8bb7e",
  goldPale: "#efe2c4",
  goldDark: "#8a6a2f",
  wood: "#8a6a45",
  woodLight: "#a57d52",
  woodPale: "#c4a27a",
  woodDark: "#5e4630",
  woodDeep: "#3d2c1f",
  moss: "#4f5b3d",
  sage: "#6f9a68",
  olive: "#7a7d5a",
  leaf: "#5f7a47",
  leafLight: "#8fa46c",
  terracotta: "#a4553a",
  burgundy: "#7a2632",
  wine: "#9a3340",
  steel: "#c3c6c3",
  steelDark: "#8e9392",
  sky: "#dfe6e2",
  dusk: "#3a4658",
} as const;
