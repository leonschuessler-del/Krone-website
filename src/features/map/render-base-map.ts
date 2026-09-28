import { floorplanMeta, propertyBoundary } from "@/config/floorplan";
import {
  beerGardenTables,
  neighbourBuildings,
  neighbourTrees,
  parasols,
  parkedCars,
  patioTables,
  roofParts,
  stallRows,
  streets,
  surfaces,
  trees,
  type RoofPart,
  type TreeSpec,
} from "@/config/site-plan";
import type { Point } from "@/domain/types";

/**
 * Renders the stylised bird's-eye site plan as a standalone SVG document.
 * Served (statically) at /map/base.svg and used as the base layer beneath the
 * interactive polygons. Light comes from the north-west; shadows fall to the
 * south-east.
 */

const { width: W, height: H } = floorplanMeta.viewBox;

const f = (n: number) => (Math.round(n * 10) / 10).toString();
const pts = (points: readonly Point[]) => points.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");
const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const dist = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const offset = (points: readonly Point[], dx: number, dy: number): Point[] => points.map(([x, y]) => [x + dx, y + dy]);

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROOF_TONES: Record<RoofPart["tone"], { light: string; dark: string; ridge: string; base: string }> = {
  terracotta: { light: "#c47a57", dark: "#9c5238", ridge: "#7a3d28", base: "#b0654a" },
  ember: { light: "#c9824a", dark: "#a2602f", ridge: "#7e4520", base: "#b8713d" },
  brick: { light: "#a95a47", dark: "#853f31", ridge: "#6a3024", base: "#97503f" },
  anthracite: { light: "#6d6763", dark: "#4d4845", ridge: "#383431", base: "#5c5652" },
  slate: { light: "#8d8a85", dark: "#77736e", ridge: "#5f5b57", base: "#83807a" },
  gravel: { light: "#aaa498", dark: "#948e82", ridge: "#7d776c", base: "#a09a8e" },
  glass: { light: "#d5e0dd", dark: "#aebfbc", ridge: "#f3f7f5", base: "#c1d0cd" },
  solar: { light: "#3b4658", dark: "#2a3342", ridge: "#5b6a82", base: "#323c4c" },
  zinc: { light: "#aeb1b1", dark: "#8f9393", ridge: "#737777", base: "#a0a3a3" },
  wood: { light: "#d9c7a4", dark: "#b8a37d", ridge: "#8e7a56", base: "#cbb892" },
};

function defs(): string {
  return `
  <defs>
    <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
    <filter id="tree-shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="5"/>
    </filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.12  0 0 0 0 0.08  0.55 0 0 0 -0.22"/>
    </filter>
    <pattern id="grass" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(-7)">
      <rect width="22" height="22" fill="#97a672"/>
      <path d="M3 5l1.5-3M11 14l1-3M17 7l1.5-3M6 19l1-3M19 18l1-2.5" stroke="#8b9569" stroke-width="1.1" stroke-linecap="round"/>
      <path d="M8 9l1-2.5M15 20l1-2M2 13l1-2" stroke="#b1b98f" stroke-width="1" stroke-linecap="round"/>
    </pattern>
    <pattern id="gravel" width="16" height="16" patternUnits="userSpaceOnUse">
      <rect width="16" height="16" fill="#cdb996"/>
      <circle cx="3" cy="4" r="0.9" fill="#b9a37d"/><circle cx="11" cy="2" r="0.7" fill="#dccaa8"/>
      <circle cx="7" cy="11" r="0.8" fill="#b39c75"/><circle cx="14" cy="12" r="0.9" fill="#e0d0b0"/>
      <circle cx="2" cy="14" r="0.6" fill="#c2ad88"/>
    </pattern>
    <pattern id="paving" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(-7)">
      <rect width="18" height="18" fill="#d6ccb9"/>
      <path d="M0 0.5H18M0.5 0V18" stroke="#c5baa5" stroke-width="1"/>
      <rect x="9" y="9" width="9" height="9" fill="#d0c5b1"/>
    </pattern>
    <pattern id="asphalt" width="14" height="14" patternUnits="userSpaceOnUse">
      <rect width="14" height="14" fill="#7d7973"/>
      <circle cx="3" cy="3" r="0.7" fill="#8a867f"/><circle cx="10" cy="8" r="0.6" fill="#716d67"/>
      <circle cx="6" cy="12" r="0.6" fill="#86827b"/>
    </pattern>
    <pattern id="road" width="16" height="16" patternUnits="userSpaceOnUse">
      <rect width="16" height="16" fill="#8b867e"/>
      <circle cx="4" cy="5" r="0.7" fill="#959088"/><circle cx="12" cy="11" r="0.7" fill="#827d76"/>
    </pattern>
    <pattern id="tiles" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-7)">
      <path d="M0 6.5H7" stroke="#000" stroke-opacity="0.12" stroke-width="1"/>
      <path d="M3.5 0V6.5" stroke="#000" stroke-opacity="0.05" stroke-width="0.8"/>
    </pattern>
    <pattern id="gravel-roof" width="10" height="10" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="3" r="0.7" fill="#000" fill-opacity="0.12"/><circle cx="7" cy="7" r="0.6" fill="#fff" fill-opacity="0.18"/>
    </pattern>
    <pattern id="glass-grid" width="14" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(-7)">
      <path d="M0.5 0V22M0 0.5H14" stroke="#f5f9f8" stroke-opacity="0.85" stroke-width="1.2"/>
    </pattern>
    <pattern id="solar-grid" width="12" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(-7)">
      <path d="M0.5 0V18M0 0.5H12" stroke="#6c7c96" stroke-opacity="0.8" stroke-width="0.9"/>
    </pattern>
    <pattern id="metal-ribs" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-5)">
      <path d="M0.5 0V6" stroke="#fff" stroke-opacity="0.35" stroke-width="1"/>
      <path d="M3.5 0V6" stroke="#000" stroke-opacity="0.08" stroke-width="1"/>
    </pattern>
    <pattern id="pergola-slats" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-7)">
      <rect width="8" height="8" fill="#cbb892"/>
      <path d="M0 1H8" stroke="#9f8b64" stroke-width="2"/>
    </pattern>
    <linearGradient id="glass-sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="0.45" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="1" stop-color="#6f8c88" stop-opacity="0.25"/>
    </linearGradient>
    <radialGradient id="tree-a" cx="0.36" cy="0.32" r="0.75">
      <stop offset="0" stop-color="#8fa46c"/><stop offset="0.55" stop-color="#627a47"/><stop offset="1" stop-color="#3f5530"/>
    </radialGradient>
    <radialGradient id="tree-b" cx="0.36" cy="0.32" r="0.75">
      <stop offset="0" stop-color="#9aab72"/><stop offset="0.55" stop-color="#6b8150"/><stop offset="1" stop-color="#465c35"/>
    </radialGradient>
    <radialGradient id="tree-c" cx="0.36" cy="0.32" r="0.75">
      <stop offset="0" stop-color="#83996a"/><stop offset="0.6" stop-color="#566d43"/><stop offset="1" stop-color="#34472a"/>
    </radialGradient>
    <radialGradient id="tree-muted" cx="0.36" cy="0.32" r="0.75">
      <stop offset="0" stop-color="#b5b59d"/><stop offset="1" stop-color="#8e907a"/>
    </radialGradient>
    <radialGradient id="parasol" cx="0.4" cy="0.35" r="0.7">
      <stop offset="0" stop-color="#fbf7ee"/><stop offset="1" stop-color="#d9d0bf"/>
    </radialGradient>
    <radialGradient id="vignette" cx="0.47" cy="0.5" r="0.72">
      <stop offset="0.55" stop-color="#1f1a15" stop-opacity="0"/>
      <stop offset="1" stop-color="#1f1a15" stop-opacity="0.32"/>
    </radialGradient>
    <linearGradient id="light" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff4dc" stop-opacity="0.16"/>
      <stop offset="0.6" stop-color="#fff4dc" stop-opacity="0"/>
      <stop offset="1" stop-color="#3a2a18" stop-opacity="0.10"/>
    </linearGradient>
    <clipPath id="property"><polygon points="${pts(propertyBoundary)}"/></clipPath>
    <mask id="outside">
      <rect x="-10" y="-10" width="${W + 20}" height="${H + 20}" fill="#fff"/>
      <polygon points="${pts(propertyBoundary)}" fill="#000"/>
    </mask>
  </defs>`;
}

function tree(t: TreeSpec, rand: () => number, muted = false): string {
  const variant = muted ? "tree-muted" : ["tree-a", "tree-b", "tree-c"][Math.floor(rand() * 3)];
  const lobes: string[] = [];
  const n = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.6;
    const d = t.r * (0.42 + rand() * 0.18);
    const r = t.r * (0.5 + rand() * 0.16);
    lobes.push(`<circle cx="${f(t.x + Math.cos(a) * d)}" cy="${f(t.y + Math.sin(a) * d)}" r="${f(r)}"/>`);
  }
  const highlight = muted
    ? ""
    : `<circle cx="${f(t.x - t.r * 0.28)}" cy="${f(t.y - t.r * 0.3)}" r="${f(t.r * 0.34)}" fill="#b4c38b" fill-opacity="0.35"/>`;
  return `<g>
    <ellipse cx="${f(t.x + t.r * 0.42)}" cy="${f(t.y + t.r * 0.5)}" rx="${f(t.r * 1.02)}" ry="${f(t.r * 0.9)}" fill="#1e2416" fill-opacity="${muted ? 0.12 : 0.3}" filter="url(#tree-shadow)"/>
    <g fill="url(#${variant})">${lobes.join("")}<circle cx="${f(t.x)}" cy="${f(t.y)}" r="${f(t.r * 0.72)}"/></g>
    ${highlight}
  </g>`;
}

function roof(part: RoofPart): string {
  const tone = ROOF_TONES[part.tone];
  const poly = part.polygon;
  const clipId = `clip-${part.id}`;
  const out: string[] = [];
  out.push(`<clipPath id="${clipId}"><polygon points="${pts(poly)}"/></clipPath>`);

  if ((part.kind === "gable" || part.kind === "hip") && poly.length === 4) {
    const [tl, tr, br, bl] = poly as [Point, Point, Point, Point];
    const alongX = part.ridge === "x";
    // Ridge runs through the middle of the short axis.
    let r1: Point, r2: Point;
    if (alongX) {
      r1 = mid(tl, bl);
      r2 = mid(tr, br);
    } else {
      r1 = mid(tl, tr);
      r2 = mid(bl, br);
    }
    if (part.kind === "hip") {
      const shortLen = alongX ? dist(tl, bl) : dist(tl, tr);
      const longLen = dist(r1, r2);
      const t = Math.min(0.45, (shortLen * 0.5) / Math.max(longLen, 1));
      const a = lerp(r1, r2, t);
      const b = lerp(r1, r2, 1 - t);
      r1 = a;
      r2 = b;
    }
    // Two main faces: north/west face lighter, south/east face darker.
    const faceA: Point[] = alongX ? [tl, tr, r2, r1] : [tl, r1, r2, bl];
    const faceB: Point[] = alongX ? [r1, r2, br, bl] : [r1, tr, br, r2];
    out.push(`<g clip-path="url(#${clipId})">`);
    out.push(`<polygon points="${pts(poly)}" fill="${tone.base}"/>`);
    out.push(`<polygon points="${pts(faceA)}" fill="${tone.light}"/>`);
    out.push(`<polygon points="${pts(faceB)}" fill="${tone.dark}"/>`);
    if (part.kind === "hip") {
      const endA: Point[] = alongX ? [tl, r1, bl] : [tl, tr, r1];
      const endB: Point[] = alongX ? [tr, br, r2] : [bl, r2, br];
      out.push(`<polygon points="${pts(endA)}" fill="${tone.light}" fill-opacity="0.8"/>`);
      out.push(`<polygon points="${pts(endB)}" fill="${tone.dark}" fill-opacity="0.9"/>`);
      const hips = alongX
        ? [[tl, r1], [bl, r1], [tr, r2], [br, r2]]
        : [[tl, r1], [tr, r1], [bl, r2], [br, r2]];
      for (const [p, q] of hips as [Point, Point][]) {
        out.push(`<line x1="${f(p[0])}" y1="${f(p[1])}" x2="${f(q[0])}" y2="${f(q[1])}" stroke="${tone.ridge}" stroke-opacity="0.55" stroke-width="1.4"/>`);
      }
    }
    out.push(`<polygon points="${pts(poly)}" fill="url(#tiles)"/>`);
    out.push(`<line x1="${f(r1[0])}" y1="${f(r1[1])}" x2="${f(r2[0])}" y2="${f(r2[1])}" stroke="${tone.ridge}" stroke-width="2.4" stroke-linecap="round"/>`);
    out.push(`<line x1="${f(r1[0] - 1)}" y1="${f(r1[1] - 1)}" x2="${f(r2[0] - 1)}" y2="${f(r2[1] - 1)}" stroke="#fff" stroke-opacity="0.18" stroke-width="1"/>`);
    out.push(`</g>`);
  } else if (part.kind === "glass") {
    out.push(`<polygon points="${pts(poly)}" fill="${tone.base}"/>`);
    out.push(`<polygon points="${pts(poly)}" fill="url(#glass-grid)"/>`);
    out.push(`<polygon points="${pts(poly)}" fill="url(#glass-sheen)"/>`);
  } else if (part.kind === "solar") {
    out.push(`<polygon points="${pts(poly)}" fill="${tone.base}" stroke="#1f2631" stroke-width="1"/>`);
    out.push(`<polygon points="${pts(poly)}" fill="url(#solar-grid)"/>`);
    out.push(`<polygon points="${pts(poly)}" fill="url(#glass-sheen)" opacity="0.5"/>`);
  } else if (part.kind === "metal") {
    out.push(`<polygon points="${pts(poly)}" fill="${tone.base}"/>`);
    out.push(`<polygon points="${pts(poly)}" fill="url(#metal-ribs)"/>`);
  } else if (part.kind === "pergola") {
    out.push(`<polygon points="${pts(poly)}" fill="url(#pergola-slats)"/>`);
  } else {
    // flat roof with parapet
    out.push(`<polygon points="${pts(poly)}" fill="${tone.base}"/>`);
    out.push(`<polygon points="${pts(poly)}" fill="url(#gravel-roof)"/>`);
  }
  // edge / parapet line
  out.push(`<polygon points="${pts(poly)}" fill="none" stroke="#2b221c" stroke-opacity="0.35" stroke-width="1.2" stroke-linejoin="round"/>`);
  return out.join("\n");
}

function stalls(): string {
  const out: string[] = [];
  for (const row of stallRows) {
    for (let i = 0; i <= row.count; i++) {
      const x = row.origin[0] + row.step[0] * i;
      const y = row.origin[1] + row.step[1] * i;
      out.push(`<line x1="${f(x)}" y1="${f(y)}" x2="${f(x + row.depth[0])}" y2="${f(y + row.depth[1])}"/>`);
    }
  }
  return `<g stroke="#ece6da" stroke-opacity="0.8" stroke-width="2" stroke-linecap="round">${out.join("")}</g>`;
}

function car(c: (typeof parkedCars)[number]): string {
  const body = c.tone === "light" ? "#e9e6e0" : c.tone === "dark" ? "#2c2f33" : "#5a5f66";
  const glass = c.tone === "light" ? "#7b8791" : "#1b1e22";
  return `<g transform="translate(${c.x} ${c.y}) rotate(${c.rotate})">
    <rect x="-17" y="-8" width="38" height="20" rx="6" fill="#000" fill-opacity="0.22" filter="url(#tree-shadow)"/>
    <rect x="-19" y="-9.5" width="38" height="19" rx="6" fill="${body}"/>
    <rect x="-8" y="-7.5" width="8" height="15" rx="2" fill="${glass}"/>
    <rect x="8" y="-7" width="5" height="14" rx="2" fill="${glass}" fill-opacity="0.85"/>
  </g>`;
}

function table(x: number, y: number, rotate: number): string {
  return `<g transform="translate(${x} ${y}) rotate(${rotate})">
    <rect x="-15" y="-9" width="32" height="20" rx="2" fill="#000" fill-opacity="0.12"/>
    <rect x="-16" y="-3" width="32" height="6" rx="1" fill="#8a6a45"/>
    <rect x="-16" y="-8" width="32" height="2.6" rx="1" fill="#9f7d55"/>
    <rect x="-16" y="5.4" width="32" height="2.6" rx="1" fill="#9f7d55"/>
  </g>`;
}

export function renderBaseMapSvg(): string {
  const rand = mulberry32(42);
  const parts: string[] = [];

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Schematische Vogelperspektive des Grundstücks Zur Krone, Leidersbach">`);
  parts.push(defs());

  // 1. surroundings
  parts.push(`<rect width="${W}" height="${H}" fill="#cfc9b8"/>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#grass)" opacity="0.35"/>`);
  for (const b of neighbourBuildings) {
    parts.push(`<polygon points="${pts(offset(b, 8, 10))}" fill="#3a3129" fill-opacity="0.12" filter="url(#soft-shadow)"/>`);
    parts.push(`<polygon points="${pts(b)}" fill="#b7ad9d" stroke="#8f8575" stroke-opacity="0.4"/>`);
  }
  for (const t of neighbourTrees) parts.push(tree(t, rand, true));

  // 2. streets
  for (const s of streets) {
    parts.push(`<path d="${s.path}" fill="none" stroke="#d7d0c2" stroke-width="${s.width + 26}" stroke-linecap="butt"/>`);
    parts.push(`<path d="${s.path}" fill="none" stroke="url(#road)" stroke-width="${s.width}" stroke-linecap="butt"/>`);
    parts.push(`<path d="${s.path}" fill="none" stroke="#efe9dc" stroke-opacity="0.55" stroke-width="2" stroke-dasharray="26 22"/>`);
  }

  // 3. property ground
  parts.push(`<g clip-path="url(#property)">`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#grass)"/>`);
  parts.push(`<polygon points="${pts(surfaces.asphalt)}" fill="url(#asphalt)"/>`);
  parts.push(`<polygon points="${pts(surfaces.asphalt)}" fill="none" stroke="#d9d2c4" stroke-width="3" stroke-opacity="0.6"/>`);
  parts.push(`<polygon points="${pts(surfaces.patio)}" fill="url(#paving)"/>`);
  parts.push(`<polygon points="${pts(surfaces.courtyardNorth)}" fill="url(#paving)"/>`);
  parts.push(`<polygon points="${pts(surfaces.pathWest)}" fill="url(#paving)"/>`);
  parts.push(`<polygon points="${pts(surfaces.gravelBeerGarden)}" fill="url(#gravel)"/>`);
  parts.push(`<polygon points="${pts(surfaces.gravelBeerGarden)}" fill="none" stroke="#a89371" stroke-width="2" stroke-opacity="0.5"/>`);
  parts.push(stalls());
  // hedge along the inside of the boundary
  parts.push(`<polygon points="${pts(propertyBoundary)}" fill="none" stroke="#56693f" stroke-width="22" stroke-opacity="0.55" stroke-linejoin="round"/>`);
  parts.push(`<polygon points="${pts(propertyBoundary)}" fill="none" stroke="#7d9160" stroke-width="10" stroke-opacity="0.45" stroke-linejoin="round" stroke-dasharray="3 7"/>`);
  parts.push(`</g>`);

  // 4. building shadows
  parts.push(`<g fill="#2a2119" fill-opacity="0.34" filter="url(#soft-shadow)">`);
  for (const r of roofParts) {
    if (r.kind === "pergola") continue;
    parts.push(`<polygon points="${pts(offset(r.polygon, 11, 13))}"/>`);
  }
  parts.push(`</g>`);

  // 5. roofs
  parts.push(`<g>`);
  for (const r of roofParts) parts.push(roof(r));
  parts.push(`</g>`);

  // 6. furniture & cars
  parts.push(`<g>`);
  for (const t of beerGardenTables) parts.push(table(t.x, t.y, t.rotate));
  for (const t of patioTables) {
    parts.push(`<circle cx="${t.x + 2}" cy="${t.y + 3}" r="8" fill="#000" fill-opacity="0.12"/><circle cx="${t.x}" cy="${t.y}" r="6.5" fill="#efe8da" stroke="#9c8f7a" stroke-width="1"/>`);
  }
  for (const c of parkedCars) parts.push(car(c));
  parts.push(`</g>`);

  // 7. trees (above ground furniture)
  parts.push(`<g>`);
  for (const t of trees) parts.push(tree(t, rand));
  for (const p of parasols) {
    parts.push(`<circle cx="${p.x + 7}" cy="${p.y + 9}" r="${p.r}" fill="#000" fill-opacity="0.2" filter="url(#tree-shadow)"/>`);
    parts.push(`<circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="url(#parasol)" stroke="#c9bea9" stroke-width="1"/>`);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      parts.push(`<line x1="${p.x}" y1="${p.y}" x2="${f(p.x + Math.cos(a) * p.r)}" y2="${f(p.y + Math.sin(a) * p.r)}" stroke="#cfc4ae" stroke-width="0.8"/>`);
    }
  }
  parts.push(`</g>`);

  // 8. de-emphasise the neighbourhood + warm light
  parts.push(`<rect width="${W}" height="${H}" fill="#efe8da" fill-opacity="0.5" mask="url(#outside)"/>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#light)"/>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#vignette)"/>`);

  // 9. street names (muted)
  for (const s of streets) {
    if (!s.label) continue;
    parts.push(
      `<text x="${s.label.x}" y="${s.label.y}" transform="rotate(${s.label.rotate} ${s.label.x} ${s.label.y})" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, 'Times New Roman', serif" font-size="19" letter-spacing="9" fill="#f6f1e6" fill-opacity="0.9">${s.name.toUpperCase().replace("ß", "SS")}</text>`,
    );
  }

  // 10. property boundary (gold, subtle)
  parts.push(`<polygon points="${pts(propertyBoundary)}" fill="none" stroke="#f3e4c0" stroke-opacity="0.45" stroke-width="7" stroke-linejoin="round"/>`);
  parts.push(`<polygon points="${pts(propertyBoundary)}" fill="none" stroke="#b8904a" stroke-width="2.6" stroke-linejoin="round"/>`);

  // 11. paper grain
  parts.push(`<rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.6"/>`);

  parts.push(`</svg>`);
  return parts.join("\n");
}
