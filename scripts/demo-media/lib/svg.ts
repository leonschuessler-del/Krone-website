/**
 * Low-level SVG helpers shared by all illustrations: number formatting,
 * a de-duplicating <defs> registry (gradients, filters), convex hull and the
 * common "finish" layers (warm grade, vignette, fine grain).
 */
import { hexToRgb } from "./color";

export type P2 = [number, number];

export const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
export const pts = (p: readonly P2[]) => p.map(([x, y]) => `${f1(x)},${f1(y)}`).join(" ");

/** Monotone-chain convex hull (returns counter-clockwise hull). */
export function hull(points: readonly P2[]): P2[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: P2[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop();
    upper.push(q);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

export type Stop = [offset: number, color: string, opacity?: number];

const stopsSvg = (stops: readonly Stop[]) =>
  stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? "" : ` stop-opacity="${a}"`}/>`).join("");

/** De-duplicating registry for <defs>. */
export class Defs {
  private readonly items = new Map<string, { id: string; svg: string }>();

  constructor(private readonly prefix = "d") {}

  ensure(key: string, build: (id: string) => string): string {
    const found = this.items.get(key);
    if (found) return found.id;
    const id = `${this.prefix}${this.items.size}`;
    this.items.set(key, { id, svg: build(id) });
    return id;
  }

  /** Linear gradient (objectBoundingBox by default). Returns `url(#id)`. */
  linear(stops: readonly Stop[], x1 = 0, y1 = 0, x2 = 0, y2 = 1, userSpace = false): string {
    const key = `lin|${JSON.stringify(stops)}|${x1},${y1},${x2},${y2}|${userSpace}`;
    const id = this.ensure(
      key,
      (id) =>
        `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${userSpace ? ' gradientUnits="userSpaceOnUse"' : ""}>${stopsSvg(stops)}</linearGradient>`,
    );
    return `url(#${id})`;
  }

  /** Radial gradient (objectBoundingBox by default). Returns `url(#id)`. */
  radial(stops: readonly Stop[], cx = 0.5, cy = 0.5, r = 0.5, fx?: number, fy?: number, userSpace = false): string {
    const key = `rad|${JSON.stringify(stops)}|${cx},${cy},${r},${fx},${fy}|${userSpace}`;
    const id = this.ensure(
      key,
      (id) =>
        `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"${fx === undefined ? "" : ` fx="${fx}" fy="${fy}"`}${userSpace ? ' gradientUnits="userSpaceOnUse"' : ""}>${stopsSvg(stops)}</radialGradient>`,
    );
    return `url(#${id})`;
  }

  /** Gaussian blur filter with a generous user-space region (safe for thin shapes). */
  blur(sd: number, w = 1600, h = 1067): string {
    const id = this.ensure(
      `blur|${sd}|${w}|${h}`,
      (id) =>
        `<filter id="${id}" filterUnits="userSpaceOnUse" x="-300" y="-300" width="${w + 600}" height="${h + 600}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${sd}"/></filter>`,
    );
    return `url(#${id})`;
  }

  /** Neutral fine grain (grey noise, opaque) – used with a soft-light/overlay blend. */
  grain(seed = 3, freq = 0.85, w = 1600, h = 1067): string {
    const id = this.ensure(
      `grain|${seed}|${freq}|${w}|${h}`,
      (id) =>
        `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" color-interpolation-filters="sRGB">` +
        `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="${seed}" stitchTiles="stitch"/>` +
        `<feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 1"/>` +
        `</filter>`,
    );
    return `url(#${id})`;
  }

  clip(points: readonly P2[]): string {
    const key = `clip|${pts(points)}`;
    const id = this.ensure(key, (id) => `<clipPath id="${id}"><polygon points="${pts(points)}"/></clipPath>`);
    return `url(#${id})`;
  }

  clipSvg(inner: string): string {
    const id = this.ensure(`clipsvg|${inner}`, (id) => `<clipPath id="${id}">${inner}</clipPath>`);
    return `url(#${id})`;
  }

  toSvg(): string {
    return `<defs>${[...this.items.values()].map((i) => i.svg).join("\n")}</defs>`;
  }
}

/** Soft radial glow (colour → transparent), blended with `screen`. */
export function glow(defs: Defs, x: number, y: number, r: number, color: string, alpha = 0.7, blend = "screen"): string {
  const fill = defs.radial([
    [0, color, alpha],
    [0.35, color, alpha * 0.45],
    [1, color, 0],
  ]);
  return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(Math.max(0.5, r))}" fill="${fill}" style="mix-blend-mode:${blend}"/>`;
}

export function ellipseGlow(
  defs: Defs,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  alpha = 0.6,
  blend = "screen",
): string {
  const fill = defs.radial([
    [0, color, alpha],
    [0.45, color, alpha * 0.4],
    [1, color, 0],
  ]);
  return `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(Math.max(0.5, rx))}" ry="${f1(Math.max(0.5, ry))}" fill="${fill}" style="mix-blend-mode:${blend}"/>`;
}

export interface FinishOptions {
  width?: number;
  height?: number;
  /** 0..1 strength of the dark vignette. */
  vignette?: number;
  vignetteColor?: string;
  /** 0..1 opacity of the grain layer. */
  grain?: number;
  /** Optional warm/cool colour grade laid over everything (soft-light). */
  grade?: string;
  gradeOpacity?: number;
  /** Multiply layer for evening scenes (applied before glows). */
  seed?: number;
}

/** Final layers: colour grade, vignette and fine grain. */
export function finish(defs: Defs, o: FinishOptions = {}): string {
  const w = o.width ?? 1600;
  const h = o.height ?? 1067;
  const out: string[] = [];
  if (o.grade) {
    out.push(`<rect width="${w}" height="${h}" fill="${o.grade}" opacity="${o.gradeOpacity ?? 0.18}" style="mix-blend-mode:soft-light"/>`);
  }
  const v = o.vignette ?? 0.35;
  if (v > 0) {
    const vc = o.vignetteColor ?? "#1a120c";
    const fill = defs.radial(
      [
        [0, vc, 0],
        [0.62, vc, 0],
        [1, vc, v],
      ],
      0.5,
      0.46,
      0.75,
    );
    out.push(`<rect width="${w}" height="${h}" fill="${fill}"/>`);
  }
  const g = o.grain ?? 0.22;
  if (g > 0) {
    out.push(`<rect width="${w}" height="${h}" filter="${defs.grain(o.seed ?? 3, 0.9, w, h)}" opacity="${g}" style="mix-blend-mode:soft-light"/>`);
  }
  return out.join("\n");
}

export function svgDoc(defs: Defs, body: string, w = 1600, h = 1067): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${defs.toSvg()}${body}</svg>`;
}

export function isDark(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}
