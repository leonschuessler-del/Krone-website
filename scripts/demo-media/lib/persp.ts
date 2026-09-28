/**
 * Minimal perspective "engine" that emits SVG.
 *
 * World units are metres: x → right, y → up, z → away from the viewer.
 * A pinhole camera (position, yaw, pitch, focal length) projects polygons,
 * boxes, cylinders and flat 2-D "sprites" (drawn in metres, anchored on the
 * floor) into screen space. Items are collected and painted back-to-front
 * (painter's algorithm) per layer, which is plenty for stylised interiors.
 */
import { darken, lighten, mix } from "./color";
import { Defs, f1, hull, pts, type P2 } from "./svg";

export type V3 = [number, number, number];

export interface CameraSpec {
  pos: V3;
  /** Degrees, positive turns right. */
  yaw?: number;
  /** Degrees, positive looks down. */
  pitch?: number;
  /** Horizontal field of view in degrees (default 74°). */
  fov?: number;
  width?: number;
  height?: number;
  /** Vertical position of the principal point (0..1 of height, default 0.5). */
  horizon?: number;
  /** Horizontal principal point shift (0..1 of width, default 0.5). */
  centerX?: number;
}

export class Camera {
  readonly pos: V3;
  readonly yaw: number;
  readonly pitch: number;
  readonly f: number;
  readonly cx: number;
  readonly cy: number;
  readonly width: number;
  readonly height: number;

  constructor(spec: CameraSpec) {
    this.pos = spec.pos;
    this.yaw = ((spec.yaw ?? 0) * Math.PI) / 180;
    this.pitch = ((spec.pitch ?? 0) * Math.PI) / 180;
    this.width = spec.width ?? 1600;
    this.height = spec.height ?? 1067;
    const fov = ((spec.fov ?? 74) * Math.PI) / 180;
    this.f = this.width / 2 / Math.tan(fov / 2);
    this.cx = this.width * (spec.centerX ?? 0.5);
    this.cy = this.height * (spec.horizon ?? 0.5);
  }

  toCam(p: V3): V3 {
    const dx = p[0] - this.pos[0];
    const dy = p[1] - this.pos[1];
    const dz = p[2] - this.pos[2];
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const x1 = dx * cy - dz * sy;
    const z1 = dx * sy + dz * cy;
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const y2 = dy * cp + z1 * sp;
    const z2 = -dy * sp + z1 * cp;
    return [x1, y2, z2];
  }

  projectCam(c: V3): P2 {
    return [this.cx + (this.f * c[0]) / c[2], this.cy - (this.f * c[1]) / c[2]];
  }

  /** Screen position or null when behind the camera. */
  project(p: V3): P2 | null {
    const c = this.toCam(p);
    if (c[2] <= 0.02) return null;
    return this.projectCam(c);
  }

  depth(p: V3): number {
    return this.toCam(p)[2];
  }

  /** Euclidean distance – used for painter's sorting. */
  dist(p: V3): number {
    return Math.hypot(p[0] - this.pos[0], p[1] - this.pos[1], p[2] - this.pos[2]);
  }

  /** Pixels per metre at the depth of p. */
  scaleAt(p: V3): number {
    return this.f / Math.max(0.05, this.depth(p));
  }
}

const NEAR = 0.05;

/** Layers in [1, 1.5) are depth-sorted; others keep insertion order. */
export const isSortedLayer = (layer: number) => layer >= 1 && layer < 1.5;
/** Sub-layers for things lying on / standing on a surface inside its group. */
export const ON_FLAT = 1.01;
export const ON_TOP = 1.02;

function clipNear(poly: V3[]): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const ain = a[2] >= NEAR;
    const bin = b[2] >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (NEAR - a[2]) / (b[2] - a[2]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
    }
  }
  return out;
}

export interface SceneOptions {
  /** Colour objects fade towards with distance (atmospheric perspective). */
  haze?: string;
  hazeNear?: number;
  hazeFar?: number;
  hazeMax?: number;
  /** Direction *towards* the main light (normalised internally). */
  light?: V3;
  /** Shading range: how dark unlit faces get / how bright lit faces get. */
  shadeDark?: number;
  shadeLight?: number;
}

interface Item {
  layer: number;
  depth: number;
  sorted: boolean;
  index: number;
  svg: string;
}

export interface BoxColors {
  /** Base colour for all faces (shaded automatically). */
  base: string;
  top?: string;
  bottom?: string;
  front?: string;
  back?: string;
  left?: string;
  right?: string;
}

export interface DrawOpts {
  layer?: number;
  /** Adds to the sort depth (positive = drawn earlier). */
  bias?: number;
  /** Extra SVG attributes. */
  attrs?: string;
  /** Edge stroke colour ("none" to disable; default: face colour to hide seams). */
  stroke?: string;
  strokeWidth?: number;
  /** Skip automatic lambert shading. */
  flat?: boolean;
  /** Skip haze. */
  noHaze?: boolean;
  opacity?: number;
}

type FaceName = "top" | "bottom" | "front" | "back" | "left" | "right";

const FACE_NORMALS: Record<FaceName, V3> = {
  top: [0, 1, 0],
  bottom: [0, -1, 0],
  front: [0, 0, -1],
  back: [0, 0, 1],
  left: [-1, 0, 0],
  right: [1, 0, 0],
};

export class Scene {
  readonly defs: Defs;
  private items: Item[] = [];
  private readonly light: V3;

  constructor(
    readonly cam: Camera,
    defs?: Defs,
    readonly opts: SceneOptions = {},
  ) {
    this.defs = defs ?? new Defs();
    const l = opts.light ?? [-0.35, 0.85, -0.4];
    const n = Math.hypot(l[0], l[1], l[2]);
    this.light = [l[0] / n, l[1] / n, l[2] / n];
  }

  /** Blend a colour towards the haze colour according to depth. */
  fog(color: string, depth: number): string {
    const { haze, hazeNear = 4, hazeFar = 30, hazeMax = 0.35 } = this.opts;
    if (!haze) return color;
    const t = Math.max(0, Math.min(1, (depth - hazeNear) / (hazeFar - hazeNear)));
    return mix(color, haze, t * hazeMax);
  }

  shade(base: string, normal: V3): string {
    const d = Math.max(0, normal[0] * this.light[0] + normal[1] * this.light[1] + normal[2] * this.light[2]);
    const k = 0.22 + 0.78 * d;
    const dark = darken(base, this.opts.shadeDark ?? 0.3);
    const light = lighten(base, this.opts.shadeLight ?? 0.1);
    return mix(dark, light, k);
  }

  private groups: Item[][] = [];

  add(svg: string, depth = 0, layer = 1, sorted = isSortedLayer(layer)): void {
    const target = this.groups[this.groups.length - 1] ?? this.items;
    target.push({ layer, depth, sorted, index: target.length, svg });
  }

  /**
   * Collects everything drawn inside `fn` into ONE sorted item placed at the
   * distance of `anchor` (keeps multi-part furniture from interleaving).
   */
  group(anchor: V3, fn: () => void, layer = 1, bias = 0): void {
    this.groups.push([]);
    fn();
    const inner = this.groups.pop() ?? [];
    if (!inner.length) return;
    this.add(`<g>${Scene.sortItems(inner).map((i) => i.svg).join("")}</g>`, this.cam.dist(anchor) + bias, layer);
  }

  private static sortItems(items: Item[]): Item[] {
    return [...items].sort((a, b) => {
      if (a.layer !== b.layer) return a.layer - b.layer;
      if (a.sorted && b.sorted) return b.depth - a.depth || a.index - b.index;
      return a.index - b.index;
    });
  }

  /** Projects a world polygon (clipped at the near plane). `depth` = z for haze, `dist` for sorting. */
  projectPoly(points: V3[]): { pts: P2[]; depth: number; dist: number } | null {
    const cam = points.map((p) => this.cam.toCam(p));
    const clipped = clipNear(cam);
    if (clipped.length < 3) return null;
    const depth = cam.reduce((s, c) => s + Math.max(c[2], 0), 0) / cam.length;
    const dist = cam.reduce((s, c) => s + Math.hypot(c[0], c[1], c[2]), 0) / cam.length;
    return { pts: clipped.map((c) => this.cam.projectCam(c)), depth, dist };
  }

  /** Flat polygon with a fill (colour or url). */
  poly(points: V3[], fill: string, o: DrawOpts = {}): P2[] | null {
    const pr = this.projectPoly(points);
    if (!pr) return null;
    const isUrl = fill.startsWith("url");
    const col = isUrl || o.noHaze ? fill : this.fog(fill, pr.depth);
    const stroke = o.stroke ?? (isUrl ? "none" : col);
    const sw = o.strokeWidth ?? 0.6;
    const op = o.opacity === undefined ? "" : ` opacity="${o.opacity}"`;
    this.add(
      `<polygon points="${pts(pr.pts)}" fill="${col}"${stroke === "none" ? "" : ` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"`}${op} ${o.attrs ?? ""}/>`,
      pr.dist + (o.bias ?? 0),
      o.layer ?? 1,
    );
    return pr.pts;
  }

  line(a: V3, b: V3, stroke: string, widthPx = 1, o: DrawOpts = {}): void {
    const pr = this.projectPoly([a, b, b]);
    if (!pr || pr.pts.length < 2) return;
    const [p, q] = pr.pts as [P2, P2];
    const op = o.opacity === undefined ? "" : ` stroke-opacity="${o.opacity}"`;
    this.add(
      `<line x1="${f1(p[0])}" y1="${f1(p[1])}" x2="${f1(q[0])}" y2="${f1(q[1])}" stroke="${o.noHaze ? stroke : this.fog(stroke, pr.depth)}" stroke-width="${widthPx}" stroke-linecap="round"${op} ${o.attrs ?? ""}/>`,
      pr.dist + (o.bias ?? 0),
      o.layer ?? 1,
    );
  }

  /** Line whose width is given in metres (scaled by perspective). */
  rod(a: V3, b: V3, stroke: string, widthM: number, o: DrawOpts = {}): void {
    const m: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    this.line(a, b, stroke, Math.max(0.6, widthM * this.cam.scaleAt(m)), o);
  }

  /** Axis-aligned box with automatic face shading. */
  box(min: V3, max: V3, colors: BoxColors | string, o: DrawOpts = {}): void {
    const c: BoxColors = typeof colors === "string" ? { base: colors } : colors;
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const [cx, cy, cz] = this.cam.pos;
    const faces: Array<[FaceName, V3[], boolean]> = [
      ["top", [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], cy > y1],
      ["bottom", [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], cy < y0],
      ["front", [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], cz < z0],
      ["back", [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], cz > z1],
      ["left", [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], cx < x0],
      ["right", [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], cx > x1],
    ];
    const center: V3 = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    const depth = this.cam.dist(center) + (o.bias ?? 0);
    const parts: string[] = [];
    for (const [name, quad, visible] of faces) {
      if (!visible) continue;
      const pr = this.projectPoly(quad);
      if (!pr) continue;
      const explicit = c[name];
      let col = explicit ?? (o.flat ? c.base : this.shade(c.base, FACE_NORMALS[name]));
      if (!col.startsWith("url") && !o.noHaze) col = this.fog(col, pr.depth);
      const stroke = o.stroke ?? (col.startsWith("url") ? "none" : col);
      parts.push(
        `<polygon points="${pts(pr.pts)}" fill="${col}"${stroke === "none" ? "" : ` stroke="${stroke}" stroke-width="${o.strokeWidth ?? 0.6}" stroke-linejoin="round"`}/>`,
      );
    }
    if (!parts.length) return;
    const op = o.opacity === undefined ? "" : ` opacity="${o.opacity}"`;
    this.add(`<g${op} ${o.attrs ?? ""}>${parts.join("")}</g>`, depth, o.layer ?? 1);
  }

  /** Points of a horizontal circle (for discs, cylinders, lamp shades). */
  ring(center: V3, r: number, n = 36, rz = r): V3[] {
    const out: V3[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      out.push([center[0] + Math.cos(a) * r, center[1], center[2] + Math.sin(a) * rz]);
    }
    return out;
  }

  /** Horizontal disc (plates, rugs, round table tops, light pools). */
  disc(center: V3, r: number, fill: string, o: DrawOpts = {}, rz = r): P2[] | null {
    return this.poly(this.ring(center, r, 40, rz), fill, { stroke: "none", ...o });
  }

  /**
   * Vertical frustum/cylinder from y=center[1] to y=center[1]+height.
   * Side is drawn as the convex hull of both rims with a horizontal shading
   * gradient; caps are drawn when visible.
   */
  cyl(
    center: V3,
    rBottom: number,
    rTop: number,
    height: number,
    colors: { side: string; top?: string; bottom?: string; sideFlat?: boolean; oval?: number },
    o: DrawOpts = {},
  ): { top: P2[] | null; bottom: P2[] | null; side: P2[] } | null {
    const ov = colors.oval ?? 1;
    const b = this.ring(center, rBottom, 36, rBottom * ov).map((p) => this.cam.toCam(p));
    const topC: V3 = [center[0], center[1] + height, center[2]];
    const t = this.ring(topC, rTop, 36, rTop * ov).map((p) => this.cam.toCam(p));
    if ([...b, ...t].some((c) => c[2] < NEAR)) return null;
    const bp = b.map((c) => this.cam.projectCam(c));
    const tp = t.map((c) => this.cam.projectCam(c));
    const side = hull([...bp, ...tp]);
    const mid: V3 = [center[0], center[1] + height / 2, center[2]];
    const depth = this.cam.dist(mid) + (o.bias ?? 0);
    const zDepth = this.cam.depth(mid);
    const sideCol = o.noHaze ? colors.side : this.fog(colors.side, zDepth);
    const sideFill = colors.sideFlat
      ? sideCol
      : this.defs.linear(
          [
            [0, darken(sideCol, 0.18)],
            [0.3, lighten(sideCol, 0.12)],
            [0.62, sideCol],
            [1, darken(sideCol, 0.28)],
          ],
          0,
          0,
          1,
          0,
        );
    const parts = [`<polygon points="${pts(side)}" fill="${sideFill}"/>`];
    const camY = this.cam.pos[1];
    let top: P2[] | null = null;
    let bottom: P2[] | null = null;
    if (colors.top && camY > center[1] + height) {
      top = tp;
      parts.push(`<polygon points="${pts(tp)}" fill="${colors.top.startsWith("url") || o.noHaze ? colors.top : this.fog(colors.top, zDepth)}"/>`);
    }
    if (colors.bottom && camY < center[1]) {
      bottom = bp;
      parts.push(`<polygon points="${pts(bp)}" fill="${colors.bottom.startsWith("url") || o.noHaze ? colors.bottom : this.fog(colors.bottom, zDepth)}"/>`);
    }
    const op = o.opacity === undefined ? "" : ` opacity="${o.opacity}"`;
    this.add(`<g${op} ${o.attrs ?? ""}>${parts.join("")}</g>`, depth, o.layer ?? 1);
    return { top, bottom, side };
  }

  /**
   * 2-D artwork placed in the world. `content` is drawn in metres with the
   * anchor at (0,0) and "up" = negative y (SVG convention).
   */
  sprite(anchor: V3, content: string, o: DrawOpts & { scale?: number; flip?: boolean } = {}): { x: number; y: number; s: number } | null {
    const c = this.cam.toCam(anchor);
    if (c[2] < NEAR * 4) return null;
    const [x, y] = this.cam.projectCam(c);
    const s = (this.cam.f / c[2]) * (o.scale ?? 1);
    const op = o.opacity === undefined ? "" : ` opacity="${o.opacity}"`;
    this.add(
      `<g transform="translate(${f1(x)} ${f1(y)}) scale(${o.flip ? -s : s} ${s})"${op} ${o.attrs ?? ""}>${content}</g>`,
      this.cam.dist(anchor) + (o.bias ?? 0),
      o.layer ?? 1,
    );
    return { x, y, s };
  }

  /**
   * 2-D artwork mapped onto a plane through `anchor` spanned by `u` (content +x)
   * and `v` (content "up", i.e. −y), using the local affine approximation of
   * the projection. Good for lettering, signs and pictures on walls.
   */
  planar(anchor: V3, u: V3, v: V3, content: string, o: DrawOpts = {}): void {
    const d = 0.05;
    const p0 = this.cam.project(anchor);
    const pu = this.cam.project([anchor[0] + u[0] * d, anchor[1] + u[1] * d, anchor[2] + u[2] * d]);
    const pv = this.cam.project([anchor[0] + v[0] * d, anchor[1] + v[1] * d, anchor[2] + v[2] * d]);
    if (!p0 || !pu || !pv) return;
    const a = (pu[0] - p0[0]) / d;
    const b = (pu[1] - p0[1]) / d;
    const c = -(pv[0] - p0[0]) / d;
    const e = -(pv[1] - p0[1]) / d;
    const op = o.opacity === undefined ? "" : ` opacity="${o.opacity}"`;
    this.add(
      `<g transform="matrix(${a.toFixed(3)} ${b.toFixed(3)} ${c.toFixed(3)} ${e.toFixed(3)} ${f1(p0[0])} ${f1(p0[1])})"${op} ${o.attrs ?? ""}>${content}</g>`,
      this.cam.dist(anchor) + (o.bias ?? 0),
      o.layer ?? 1,
    );
  }

  /** Raw screen-space SVG on a layer (e.g. glows, light shafts). */
  raw(svg: string, layer = 2, depth = 0): void {
    // overlays always escape groups so they composite at their global layer
    this.items.push({ layer, depth, sorted: isSortedLayer(layer), index: this.items.length, svg });
  }

  /** Painted SVG for all items with minLayer <= layer <= maxLayer. */
  render(minLayer = -Infinity, maxLayer = Infinity): string {
    return Scene.sortItems(this.items.filter((i) => i.layer >= minLayer && i.layer <= maxLayer))
      .map((i) => i.svg)
      .join("\n");
  }
}

/**
 * Camera looking at `target` from `elevation`° above and `azimuth`° to the
 * side, positioned so that roughly `frameWidth` metres fit across the image
 * at the target's distance.
 */
export function lookAt(target: V3, frameWidth: number, elevation: number, azimuth = 0, fov = 50, extra: Partial<CameraSpec> = {}): CameraSpec {
  const dist = frameWidth / 2 / Math.tan(((fov / 2) * Math.PI) / 180);
  const yaw = (azimuth * Math.PI) / 180;
  const pitch = (elevation * Math.PI) / 180;
  const d: V3 = [Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  return { pos: [target[0] - d[0] * dist, target[1] - d[1] * dist, target[2] - d[2] * dist], yaw: azimuth, pitch: elevation, fov, ...extra };
}
