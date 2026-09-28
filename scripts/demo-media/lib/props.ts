/**
 * Reusable furniture, architecture and decor for the perspective scenes.
 * Everything is drawn in metres (see persp.ts). Colours come from the brand
 * palette so all illustrations share one look.
 */
import { darken, lighten, mix, P } from "./color";
import { ON_FLAT, ON_TOP, type Scene, type V3 } from "./persp";
import type { Rand } from "./rand";
import { ellipseGlow, f1, glow, hull, pts, type P2 } from "./svg";

// ---------------------------------------------------------------------------
// Room shell
// ---------------------------------------------------------------------------

export interface RoomSpec {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  h: number;
  wall: string;
  wallLeft?: string;
  wallRight?: string;
  wallBack?: string;
  floor: string;
  floorKind?: "planks" | "tiles" | "stone" | "plain";
  plank?: number;
  tile?: number;
  ceiling: string;
  wainscot?: { h: number; color: string; panels?: number };
  skirting?: string;
  seed?: Rand;
  /** Skip walls (e.g. glass houses). */
  noLeft?: boolean;
  noRight?: boolean;
  noBack?: boolean;
  noCeiling?: boolean;
}

export function room(s: Scene, r: RoomSpec): void {
  const { x0, x1, z0, z1, h } = r;
  const L = 0;
  const floorQ: V3[] = [
    [x0, 0, z0],
    [x1, 0, z0],
    [x1, 0, z1],
    [x0, 0, z1],
  ];
  s.poly(floorQ, r.floor, { layer: L, noHaze: true });
  // subtle floor darkening towards the back
  s.poly(floorQ, s.defs.linear([
    [0, darken(r.floor, 0.25), 0.35],
    [0.55, r.floor, 0],
  ]), { layer: L });

  const rand = r.seed ?? Math.random;
  if (r.floorKind === "planks") {
    const pw = r.plank ?? 0.22;
    let i = 0;
    for (let x = x0; x < x1; x += pw, i++) {
      const tint = (rand() - 0.5) * 0.1;
      const c = tint > 0 ? lighten(r.floor, tint) : darken(r.floor, -tint);
      s.poly(
        [
          [x, 0, Math.max(z0, s.cam.pos[2] + 0.2)],
          [Math.min(x + pw, x1), 0, Math.max(z0, s.cam.pos[2] + 0.2)],
          [Math.min(x + pw, x1), 0, z1],
          [x, 0, z1],
        ],
        c,
        { layer: L, stroke: darken(r.floor, 0.18), strokeWidth: 0.7, opacity: 0.85 },
      );
      // board joints
      for (let z = z0 + rand() * 2; z < z1; z += 1.6 + rand() * 2.2) {
        if (z < s.cam.pos[2] + 0.3) continue;
        s.line([x, 0, z], [Math.min(x + pw, x1), 0, z], darken(r.floor, 0.2), 0.8, { layer: L, opacity: 0.7 });
      }
    }
  } else if (r.floorKind === "tiles" || r.floorKind === "stone") {
    const t = r.tile ?? (r.floorKind === "stone" ? 0.6 : 0.3);
    const lc = darken(r.floor, r.floorKind === "stone" ? 0.12 : 0.1);
    for (let x = Math.ceil(x0 / t) * t; x < x1; x += t) {
      s.line([x, 0, Math.max(z0, s.cam.pos[2] + 0.2)], [x, 0, z1], lc, 0.9, { layer: L, opacity: 0.8 });
    }
    for (let z = Math.ceil(z0 / t) * t; z < z1; z += t) {
      if (z < s.cam.pos[2] + 0.2) continue;
      s.line([x0, 0, z], [x1, 0, z], lc, 0.9, { layer: L, opacity: 0.8 });
    }
    if (r.floorKind === "stone") {
      for (let k = 0; k < 40; k++) {
        const x = x0 + rand() * (x1 - x0);
        const z = Math.max(z0, s.cam.pos[2] + 0.5) + rand() * (z1 - Math.max(z0, s.cam.pos[2] + 0.5));
        const ix = Math.floor(x / t) * t;
        const iz = Math.floor(z / t) * t;
        const c = rand() > 0.5 ? lighten(r.floor, 0.05) : darken(r.floor, 0.05);
        s.poly([[ix, 0, iz], [ix + t, 0, iz], [ix + t, 0, iz + t], [ix, 0, iz + t]], c, { layer: L, stroke: "none", opacity: 0.8 });
      }
    }
  }

  const back = r.wallBack ?? r.wall;
  const left = r.wallLeft ?? r.wall;
  const right = r.wallRight ?? r.wall;
  if (!r.noCeiling) {
    s.poly([[x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]], r.ceiling, { layer: L, noHaze: true });
    s.poly([[x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]], s.defs.linear([
      [0, darken(r.ceiling, 0.3), 0.5],
      [1, r.ceiling, 0],
    ]), { layer: L });
  }
  if (!r.noLeft) {
    s.poly([[x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0]], s.shade(left, [1, 0, 0]), { layer: L, noHaze: true });
  }
  if (!r.noRight) {
    s.poly([[x1, 0, z0], [x1, 0, z1], [x1, h, z1], [x1, h, z0]], s.shade(right, [-1, 0, 0]), { layer: L, noHaze: true });
  }
  if (!r.noBack) {
    s.poly([[x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1]], s.shade(back, [0, 0, -1]), { layer: L });
  }

  if (r.wainscot) {
    const w = r.wainscot;
    const n = w.panels ?? 1.1;
    const panel = (a: V3, b: V3, axis: "x" | "z", normal: V3) => {
      const base = s.shade(w.color, normal);
      s.poly([a, [b[0], a[1], b[2]], [b[0], w.h, b[2]], [a[0], w.h, a[2]]], base, { layer: L });
      // cap rail
      s.poly(
        [
          [a[0], w.h, a[2]],
          [b[0], w.h, b[2]],
          [b[0], w.h + 0.06, b[2]],
          [a[0], w.h + 0.06, a[2]],
        ],
        lighten(base, 0.12),
        { layer: L },
      );
      // inset panels
      const len = axis === "x" ? b[0] - a[0] : b[2] - a[2];
      const count = Math.max(1, Math.round(len / n));
      const step = len / count;
      for (let i = 0; i < count; i++) {
        const u0 = i * step + 0.1;
        const u1 = (i + 1) * step - 0.1;
        const P0: V3 = axis === "x" ? [a[0] + u0, 0.18, a[2]] : [a[0], 0.18, a[2] + u0];
        const P1: V3 = axis === "x" ? [a[0] + u1, 0.18, a[2]] : [a[0], 0.18, a[2] + u1];
        const top = w.h - 0.12;
        if ((axis === "z" ? Math.max(P0[2], P1[2]) : 1) < s.cam.pos[2] + 0.3) continue;
        s.poly(
          [P0, P1, [P1[0], top, P1[2]], [P0[0], top, P0[2]]],
          darken(base, 0.1),
          { layer: L, stroke: lighten(base, 0.12), strokeWidth: 1 },
        );
      }
    };
    if (!r.noLeft) panel([x0, 0, Math.max(z0, s.cam.pos[2] - 1)], [x0, 0, z1], "z", [1, 0, 0]);
    if (!r.noRight) panel([x1, 0, Math.max(z0, s.cam.pos[2] - 1)], [x1, 0, z1], "z", [-1, 0, 0]);
    if (!r.noBack) panel([x0, 0, z1], [x1, 0, z1], "x", [0, 0, -1]);
  }
  if (r.skirting) {
    const k = r.skirting;
    if (!r.noLeft) s.poly([[x0, 0, z0], [x0, 0, z1], [x0, 0.1, z1], [x0, 0.1, z0]], k, { layer: L });
    if (!r.noRight) s.poly([[x1, 0, z0], [x1, 0, z1], [x1, 0.1, z1], [x1, 0.1, z0]], k, { layer: L });
    if (!r.noBack) s.poly([[x0, 0, z1], [x1, 0, z1], [x1, 0.1, z1], [x0, 0.1, z1]], k, { layer: L });
  }
}

/** Ceiling beams crossing the room (along x) every `spacing` metres. */
export function beams(
  s: Scene,
  r: { x0: number; x1: number; z0: number; z1: number; h: number },
  color: string,
  spacing = 1.6,
  size: [number, number] = [0.22, 0.26],
  along: "x" | "z" = "x",
): void {
  if (along === "x") {
    for (let z = r.z0 + spacing * 0.6; z < r.z1 - 0.1; z += spacing) {
      if (z < s.cam.pos[2] + 0.4) continue;
      s.box([r.x0, r.h - size[1], z], [r.x1, r.h, z + size[0]], color, { layer: 0.6 });
    }
  } else {
    for (let x = r.x0 + spacing * 0.5; x < r.x1; x += spacing) {
      s.box([x - size[0] / 2, r.h - size[1], r.z0], [x + size[0] / 2, r.h, r.z1], color, { layer: 0.6 });
    }
  }
}

// ---------------------------------------------------------------------------
// Windows & light
// ---------------------------------------------------------------------------

export type WallSide = "left" | "right" | "back";

/** 3-D corners of a rectangle on a wall. u = along the wall (z or x), v = height. */
export function wallRect(side: WallSide, plane: number, u0: number, u1: number, v0: number, v1: number): V3[] {
  if (side === "back") return [[u0, v0, plane], [u1, v0, plane], [u1, v1, plane], [u0, v1, plane]];
  return [[plane, v0, u0], [plane, v0, u1], [plane, v1, u1], [plane, v1, u0]];
}

export interface WindowSpec {
  side: WallSide;
  plane: number;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  frame?: string;
  cols?: number;
  rows?: number;
  /** "day" = bright garden view, "dusk" = blue hour, "night" = dark. */
  mood?: "day" | "dusk" | "night";
  depth?: number;
  wall?: string;
  curtains?: string;
  sill?: string;
  view?: "garden" | "hills" | "sky" | "butzen";
  layer?: number;
}

export function landscapeView(s: Scene, box: [number, number, number, number], mood: "day" | "dusk" | "night", kind: "garden" | "hills" | "sky", seed: number): string {
  const [minX, minY, maxX, maxY] = box;
  const w = maxX - minX;
  const hgt = maxY - minY;
  const sky =
    mood === "day"
      ? s.defs.linear([[0, "#dfe9ea"], [0.6, "#f4efe2"], [1, "#fbf3df"]])
      : mood === "dusk"
        ? s.defs.linear([[0, "#34405a"], [0.55, "#6e6b85"], [1, "#d7a67a"]])
        : s.defs.linear([[0, "#141a26"], [1, "#2c3342"]]);
  const hill1 = mood === "day" ? "#a9b88a" : mood === "dusk" ? "#4d5160" : "#1e222b";
  const hill2 = mood === "day" ? "#7f9463" : mood === "dusk" ? "#3a3e4a" : "#171a21";
  const tree = mood === "day" ? "#5f7a47" : mood === "dusk" ? "#2b2f38" : "#101318";
  const out = [`<rect x="${f1(minX - 2)}" y="${f1(minY - 2)}" width="${f1(w + 4)}" height="${f1(hgt + 4)}" fill="${sky}"/>`];
  if (kind !== "sky") {
    const hy = minY + hgt * 0.62;
    out.push(`<path d="M${f1(minX - 5)} ${f1(hy + hgt * 0.1)} C ${f1(minX + w * 0.3)} ${f1(hy - hgt * 0.12)}, ${f1(minX + w * 0.6)} ${f1(hy - hgt * 0.02)}, ${f1(maxX + 5)} ${f1(hy - hgt * 0.1)} L ${f1(maxX + 5)} ${f1(maxY + 5)} L ${f1(minX - 5)} ${f1(maxY + 5)} Z" fill="${hill1}"/>`);
    out.push(`<path d="M${f1(minX - 5)} ${f1(hy + hgt * 0.22)} C ${f1(minX + w * 0.35)} ${f1(hy + hgt * 0.05)}, ${f1(minX + w * 0.7)} ${f1(hy + hgt * 0.2)}, ${f1(maxX + 5)} ${f1(hy + hgt * 0.08)} L ${f1(maxX + 5)} ${f1(maxY + 5)} L ${f1(minX - 5)} ${f1(maxY + 5)} Z" fill="${hill2}"/>`);
    if (kind === "garden") {
      let k = seed;
      const rnd = () => ((k = (k * 9301 + 49297) % 233280) / 233280);
      const n = Math.max(2, Math.round(w / 60));
      for (let i = 0; i < n; i++) {
        const tx = minX + (i + 0.3 + rnd() * 0.4) * (w / n);
        const tr = hgt * (0.12 + rnd() * 0.1);
        const ty = hy + hgt * 0.14 - tr * 0.2;
        out.push(`<ellipse cx="${f1(tx)}" cy="${f1(ty)}" rx="${f1(tr)}" ry="${f1(tr * 1.25)}" fill="${tree}" opacity="0.85"/>`);
      }
    }
  }
  if (mood === "day") out.push(`<rect x="${f1(minX)}" y="${f1(minY)}" width="${f1(w)}" height="${f1(hgt)}" fill="#fffaf0" opacity="0.22"/>`);
  return out.join("");
}

/** Window with reveal, glazing bars, sill and optional curtains. Returns glass corners. */
export function windowOn(s: Scene, w: WindowSpec, seed = 7): V3[] {
  const frame = w.frame ?? P.paper;
  const d = w.depth ?? 0.22;
  const mood = w.mood ?? "day";
  const sgn = w.side === "left" ? -1 : w.side === "right" ? 1 : 1;
  // glass plane pushed "into" the wall
  const glassPlane = w.plane + sgn * d;
  const glass = wallRect(w.side, glassPlane, w.u0, w.u1, w.v0, w.v1);
  const L = w.layer ?? 0.4;
  const pr = s.projectPoly(glass);
  if (pr) {
    const xs = pr.pts.map((p) => p[0]);
    const ys = pr.pts.map((p) => p[1]);
    const box: [number, number, number, number] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const clip = s.defs.clip(pr.pts);
    if (w.view === "butzen") {
      const glassCol = mood === "day" ? "#e9d9a8" : mood === "dusk" ? "#d9a45c" : "#8a5a2c";
      const cell = Math.max(6, (box[2] - box[0]) / 7);
      const pat = s.defs.ensure(`butzen|${glassCol}|${cell.toFixed(0)}`, (id) =>
        `<pattern id="${id}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" patternUnits="userSpaceOnUse">` +
        `<rect width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" fill="${glassCol}"/>` +
        `<circle cx="${(cell / 2).toFixed(1)}" cy="${(cell / 2).toFixed(1)}" r="${(cell * 0.44).toFixed(1)}" fill="${lighten(glassCol, 0.25)}" stroke="${darken(glassCol, 0.35)}" stroke-width="${(cell * 0.07).toFixed(1)}"/>` +
        `<circle cx="${(cell / 2).toFixed(1)}" cy="${(cell / 2).toFixed(1)}" r="${(cell * 0.12).toFixed(1)}" fill="${lighten(glassCol, 0.5)}"/></pattern>`,
      );
      s.raw(`<g clip-path="${clip}"><rect x="${f1(box[0])}" y="${f1(box[1])}" width="${f1(box[2] - box[0])}" height="${f1(box[3] - box[1])}" fill="url(#${pat})"/></g>`, L);
    } else {
      s.raw(`<g clip-path="${clip}">${landscapeView(s, box, mood, w.view ?? "garden", seed)}</g>`, L);
    }
  }
  // reveal (embrasure)
  const outer = wallRect(w.side, w.plane, w.u0, w.u1, w.v0, w.v1);
  const wallC = w.wall ?? P.cream;
  const revealLight = lighten(wallC, 0.1);
  const revealDark = darken(wallC, 0.12);
  for (let i = 0; i < 4; i++) {
    const a = outer[i]!;
    const b = outer[(i + 1) % 4]!;
    const c = glass[(i + 1) % 4]!;
    const e = glass[i]!;
    s.poly([a, b, c, e], i === 0 ? revealLight : i === 2 ? revealDark : mix(revealLight, revealDark, 0.5), { layer: L });
  }
  // frame and bars (drawn on glass plane)
  const cols = w.cols ?? 2;
  const rows = w.rows ?? 2;
  const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const [g0, g1, g2, g3] = glass as [V3, V3, V3, V3];
  const barW = 0.05;
  const fr = s.cam.scaleAt(g0);
  for (let i = 0; i <= cols; i++) {
    const t = i / cols;
    const wpx = (i === 0 || i === cols ? 0.09 : barW) * fr;
    s.line(lerp3(g0, g1, t), lerp3(g3, g2, t), frame, Math.max(1, wpx), { layer: L + 0.01 });
  }
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    const wpx = (j === 0 || j === rows ? 0.09 : barW) * fr;
    s.line(lerp3(g0, g3, t), lerp3(g1, g2, t), frame, Math.max(1, wpx), { layer: L + 0.01 });
  }
  // glass sheen
  if (pr) {
    const sheen = s.defs.linear([[0, "#ffffff", mood === "day" ? 0.25 : 0.08], [0.5, "#ffffff", 0], [1, "#ffffff", mood === "day" ? 0.12 : 0.04]], 0, 0, 1, 1);
    s.raw(`<polygon points="${pts(pr.pts)}" fill="${sheen}"/>`, L + 0.02);
  }
  // sill
  if (w.sill !== "none") {
    const sillC = w.sill ?? lighten(wallC, 0.15);
    const sd = 0.08;
    if (w.side === "back") {
      s.box([w.u0 - 0.08, w.v0 - 0.05, w.plane - sd], [w.u1 + 0.08, w.v0, w.plane + d], sillC, { layer: L + 0.03 });
    } else {
      const inner = w.plane - sgn * sd;
      const a = Math.min(inner, glassPlane);
      const b = Math.max(inner, glassPlane);
      s.box([a, w.v0 - 0.05, w.u0 - 0.08], [b, w.v0, w.u1 + 0.08], sillC, { layer: L + 0.03 });
    }
  }
  if (w.curtains) {
    const c = w.curtains;
    const cw = 0.5;
    const off = -sgn * 0.06;
    const drape = (u0: number, u1: number) => {
      const q = wallRect(w.side, w.plane + off, u0, u1, w.v0 - 0.35, w.v1 + 0.25);
      const p = s.projectPoly(q);
      if (!p) return;
      const g = s.defs.linear(
        [
          [0, darken(c, 0.15)],
          [0.25, lighten(c, 0.12)],
          [0.5, darken(c, 0.1)],
          [0.75, lighten(c, 0.08)],
          [1, darken(c, 0.2)],
        ],
        0,
        0,
        1,
        0,
      );
      s.raw(`<polygon points="${pts(p.pts)}" fill="${g}"/>`, L + 0.05);
    };
    drape(w.u0 - cw * 0.7, w.u0 + cw * 0.3);
    drape(w.u1 - cw * 0.3, w.u1 + cw * 0.7);
  }
  return glass;
}

/** Volumetric light shaft from a window onto the floor + a bright floor patch. */
export function lightShaft(s: Scene, glass: V3[], sun: V3, opts: { color?: string; alpha?: number; floorAlpha?: number; blur?: number; layer?: number } = {}): void {
  const floor = glass.map((p): V3 => {
    const t = -p[1] / sun[1];
    return [p[0] + sun[0] * t, 0, p[2] + sun[2] * t];
  });
  const pw = glass.map((p) => s.cam.project(p)).filter((p): p is P2 => !!p);
  const pf = floor.map((p) => s.cam.project(p)).filter((p): p is P2 => !!p);
  if (pw.length < 3 || pf.length < 3) return;
  const color = opts.color ?? "#fff3d6";
  const a = opts.alpha ?? 0.22;
  const shape = hull([...pw, ...pf]);
  const cw = pw.reduce((acc, p) => [acc[0] + p[0] / pw.length, acc[1] + p[1] / pw.length], [0, 0]);
  const cf = pf.reduce((acc, p) => [acc[0] + p[0] / pf.length, acc[1] + p[1] / pf.length], [0, 0]);
  const g = s.defs.linear(
    [
      [0, color, a],
      [1, color, a * 0.15],
    ],
    cw[0],
    cw[1],
    cf[0],
    cf[1],
    true,
  );
  const L = opts.layer ?? 2;
  s.raw(`<polygon points="${pts(shape)}" fill="${g}" filter="${s.defs.blur(opts.blur ?? 10)}" style="mix-blend-mode:screen"/>`, L);
  s.raw(
    `<polygon points="${pts(pf)}" fill="${color}" opacity="${opts.floorAlpha ?? 0.35}" filter="${s.defs.blur(4)}" style="mix-blend-mode:soft-light"/>`,
    0.5,
  );
  s.raw(`<polygon points="${pts(pf)}" fill="${color}" opacity="${(opts.floorAlpha ?? 0.35) * 0.5}" filter="${s.defs.blur(6)}" style="mix-blend-mode:screen"/>`, 0.5);
}

/** Soft contact shadow on the floor under an object footprint. */
export function floorShadow(s: Scene, x0: number, z0: number, x1: number, z1: number, alpha = 0.28, blur = 6, y = 0.002): void {
  const pr = s.projectPoly([
    [x0, y, z0],
    [x1, y, z0],
    [x1, y, z1],
    [x0, y, z1],
  ]);
  if (!pr) return;
  s.raw(`<polygon points="${pts(pr.pts)}" fill="#1a120c" opacity="${alpha}" filter="${s.defs.blur(blur)}"/>`, 0.5);
}

// ---------------------------------------------------------------------------
// Furniture
// ---------------------------------------------------------------------------

export interface TableSpec {
  x: number;
  z: number;
  w: number;
  d: number;
  h?: number;
  wood?: string;
  cloth?: string;
  /** cloth drop (m) */
  drop?: number;
  round?: boolean;
  runner?: string;
  /** Things on the table (drawn inside the table's group, above its top). */
  decor?: () => void;
}

export function table(s: Scene, t: TableSpec): void {
  const h = t.h ?? 0.76;
  const wood = t.wood ?? P.woodLight;
  const x0 = t.x - t.w / 2;
  const x1 = t.x + t.w / 2;
  const z0 = t.z - t.d / 2;
  const z1 = t.z + t.d / 2;
  floorShadow(s, x0 - 0.05, z0 - 0.05, x1 + 0.12, z1 + 0.12, 0.22, 7);
  s.group([t.x, h / 2, t.z], () => {
    if (t.round) {
      const r = t.w / 2;
      if (t.cloth) {
        s.cyl([t.x, h - (t.drop ?? 0.4), t.z], r + 0.03, r + 0.02, t.drop ?? 0.4, { side: t.cloth, top: lighten(t.cloth, 0.06) });
        s.cyl([t.x, 0, t.z], 0.05, 0.05, h - (t.drop ?? 0.4), { side: darken(wood, 0.2) });
      } else {
        s.cyl([t.x, 0, t.z], 0.06, 0.06, h - 0.04, { side: darken(wood, 0.25) });
        s.cyl([t.x, h - 0.04, t.z], r, r, 0.04, { side: wood, top: lighten(wood, 0.08) });
      }
      t.decor?.();
      return;
    }
    const legIn = 0.06;
    const legs: Array<[number, number]> = [
      [x0 + legIn, z0 + legIn],
      [x1 - legIn - 0.05, z0 + legIn],
      [x0 + legIn, z1 - legIn - 0.05],
      [x1 - legIn - 0.05, z1 - legIn - 0.05],
    ];
    for (const [lx, lz] of legs) s.box([lx, 0, lz], [lx + 0.05, h - 0.03, lz + 0.05], darken(wood, 0.15));
    if (t.cloth) {
      const drop = t.drop ?? 0.3;
      s.box([x0 - 0.02, h - drop, z0 - 0.02], [x1 + 0.02, h, z1 + 0.02], {
        base: t.cloth,
        top: lighten(t.cloth, 0.04),
      });
      if (t.runner) {
        s.poly(
          [
            [t.x - 0.18, h + 0.003, z0 - 0.02],
            [t.x + 0.18, h + 0.003, z0 - 0.02],
            [t.x + 0.18, h + 0.003, z1 + 0.02],
            [t.x - 0.18, h + 0.003, z1 + 0.02],
          ],
          t.runner,
          { layer: ON_FLAT - 0.005 },
        );
      }
    } else {
      s.box([x0, h - 0.045, z0], [x1, h, z1], { base: wood, top: lighten(wood, 0.06) });
    }
    t.decor?.();
  });
}

export type Facing = "+z" | "-z" | "+x" | "-x";

export interface ChairSpec {
  x: number;
  z: number;
  facing: Facing;
  wood?: string;
  seat?: string;
  back?: "slats" | "solid" | "upholstered" | "heart";
  scale?: number;
}

/** Dining chair built from boxes. `facing` = direction the sitter looks. */
export function chair(s: Scene, c: ChairSpec): void {
  const k = c.scale ?? 1;
  const wood = c.wood ?? P.wood;
  const seat = c.seat ?? wood;
  const sw = 0.44 * k;
  const sh = 0.46 * k;
  const bh = 0.95 * k;
  const leg = 0.035 * k;
  const hx = sw / 2;
  s.group([c.x, sh, c.z], () => {
    // local → world: build in local coords where sitter faces -z_local (towards "front")
    const rot = (lx: number, lz: number): [number, number] => {
      switch (c.facing) {
        case "-z":
          return [c.x + lx, c.z + lz];
        case "+z":
          return [c.x - lx, c.z - lz];
        case "+x":
          return [c.x - lz, c.z + lx];
        case "-x":
          return [c.x + lz, c.z - lx];
      }
    };
    const bx = (lx0: number, y0: number, lz0: number, lx1: number, y1: number, lz1: number, col: string) => {
      const [ax, az] = rot(lx0, lz0);
      const [bxx, bz] = rot(lx1, lz1);
      s.box([Math.min(ax, bxx), y0, Math.min(az, bz)], [Math.max(ax, bxx), y1, Math.max(az, bz)], col);
    };
    // legs
    bx(-hx, 0, -hx, -hx + leg, sh, -hx + leg, darken(wood, 0.1));
    bx(hx - leg, 0, -hx, hx, sh, -hx + leg, darken(wood, 0.1));
    bx(-hx, 0, hx - leg, -hx + leg, sh, hx, darken(wood, 0.1));
    bx(hx - leg, 0, hx - leg, hx, sh, hx, darken(wood, 0.1));
    // seat frame + cushion
    bx(-hx - 0.005, sh - 0.03, -hx - 0.005, hx + 0.005, sh + 0.01, hx + 0.005, wood);
    bx(-hx + 0.02, sh + 0.01, -hx + 0.02, hx - 0.02, sh + 0.055 * k, hx - 0.03, seat);
    // back
    const back = c.back ?? "slats";
    const post = (lx0: number, lx1: number) => bx(lx0, sh, hx - leg, lx1, bh, hx, wood);
    post(-hx, -hx + leg);
    post(hx - leg, hx);
    if (back === "solid") {
      bx(-hx, sh + 0.12 * k, hx - 0.03 * k, hx, bh, hx, wood);
    } else if (back === "upholstered") {
      bx(-hx + leg, sh + 0.2 * k, hx - 0.045 * k, hx - leg, bh - 0.05 * k, hx - 0.005, seat);
      bx(-hx, bh - 0.05 * k, hx - leg, hx, bh, hx, wood);
    } else if (back === "heart") {
      bx(-hx, sh + 0.14 * k, hx - 0.03 * k, hx, bh, hx, wood);
    } else {
      bx(-hx, bh - 0.08 * k, hx - leg, hx, bh, hx, wood);
      bx(-hx, sh + 0.2 * k, hx - leg * 0.8, hx, sh + 0.25 * k, hx, wood);
      for (const u of [-0.1, 0, 0.1]) bx(u * k - 0.015, sh + 0.25 * k, hx - leg * 0.7, u * k + 0.015, bh - 0.08 * k, hx - 0.005, wood);
    }
  });
}

/** Wooden bench (Biergarten / Stube). Long axis along x or z. */
export function bench(s: Scene, x: number, z: number, len: number, axis: "x" | "z", wood: string, h = 0.45, depth = 0.26): void {
  const hx = axis === "x" ? len / 2 : depth / 2;
  const hz = axis === "x" ? depth / 2 : len / 2;
  s.group([x, h / 2, z], () => {
    const legW = 0.05;
    const inset = 0.22;
    if (axis === "x") {
      s.box([x - hx + inset, 0, z - hz + 0.03], [x - hx + inset + legW, h - 0.04, z + hz - 0.03], darken(wood, 0.15));
      s.box([x + hx - inset - legW, 0, z - hz + 0.03], [x + hx - inset, h - 0.04, z + hz - 0.03], darken(wood, 0.15));
    } else {
      s.box([x - hx + 0.03, 0, z - hz + inset], [x + hx - 0.03, h - 0.04, z - hz + inset + legW], darken(wood, 0.15));
      s.box([x - hx + 0.03, 0, z + hz - inset - legW], [x + hx - 0.03, h - 0.04, z + hz - inset], darken(wood, 0.15));
    }
    s.box([x - hx, h - 0.045, z - hz], [x + hx, h, z + hz], { base: wood, top: lighten(wood, 0.08) });
  });
}

// ---------------------------------------------------------------------------
// Lighting fixtures
// ---------------------------------------------------------------------------

export interface PendantSpec {
  x: number;
  z: number;
  /** height of the shade's lower rim */
  y: number;
  ceiling: number;
  shade?: string;
  inner?: string;
  r?: number;
  hShade?: number;
  glowColor?: string;
  glowAlpha?: number;
  glowRadius?: number;
  kind?: "dome" | "drum";
  /** draw light cone / pool towards floor */
  pool?: number;
}

export function pendant(s: Scene, p: PendantSpec): void {
  const r = p.r ?? 0.22;
  const hs = p.hShade ?? 0.2;
  const shade = p.shade ?? P.inkSoft;
  const inner = p.inner ?? "#fff1cf";
  const top: V3 = [p.x, p.y + hs, p.z];
  s.group([p.x, p.y + hs / 2, p.z], () => {
    s.rod([p.x, p.ceiling, p.z], top, darken(shade, 0.2), 0.012);
    if (p.kind === "drum") {
      s.cyl([p.x, p.y, p.z], r, r, hs, { side: shade, bottom: inner, top: darken(shade, 0.2), sideFlat: false });
    } else {
      s.cyl([p.x, p.y, p.z], r, r * 0.25, hs, { side: shade, bottom: inner });
      s.cyl([p.x, p.y + hs, p.z], 0.03, 0.03, 0.05, { side: P.goldDark });
    }
  });
  const c = s.cam.project([p.x, p.y, p.z]);
  if (c) {
    const sc = s.cam.scaleAt([p.x, p.y, p.z]);
    const gc = p.glowColor ?? "#ffd9a0";
    s.raw(glow(s.defs, c[0], c[1] + r * sc * 0.1, (p.glowRadius ?? 1.1) * sc, gc, p.glowAlpha ?? 0.55), 2.2);
    s.raw(ellipseGlow(s.defs, c[0], c[1], r * sc * 0.9, r * sc * 0.3, "#fff7e2", 0.85), 2.3);
  }
  if (p.pool) {
    const pr = s.projectPoly(s.ring([p.x, p.pool, p.z], 0.9, 24));
    if (pr) {
      const xs = pr.pts.map((q) => q[0]);
      const ys = pr.pts.map((q) => q[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      s.raw(ellipseGlow(s.defs, cx, cy, (Math.max(...xs) - Math.min(...xs)) / 2, (Math.max(...ys) - Math.min(...ys)) / 2, p.glowColor ?? "#ffd9a0", 0.35), 2.1);
    }
  }
}

/** Candle on a table incl. glow. */
export function candle(s: Scene, p: V3, h = 0.14, glowR = 0.45, alpha = 0.5, holder: string = P.goldDark): void {
  const w = 0.028;
  s.sprite(
    p,
    `<path d="M${-w * 1.6} 0 h${w * 3.2} l${-w * 0.5} -0.02 h${-w * 2.2}z" fill="${holder}"/>` +
      `<rect x="${-w / 2}" y="${-h}" width="${w}" height="${h - 0.02}" fill="#f6efe0"/>` +
      `<rect x="${-w / 2}" y="${-h}" width="${w * 0.35}" height="${h - 0.02}" fill="#fffaf0"/>` +
      `<path d="M0 ${-h - 0.055} C 0.012 ${-h - 0.03}, 0.01 ${-h - 0.008}, 0 ${-h - 0.004} C -0.01 ${-h - 0.008}, -0.012 ${-h - 0.03}, 0 ${-h - 0.055}z" fill="#ffd27a"/>`,
    { layer: ON_TOP },
  );
  const c = s.cam.project([p[0], p[1] + h + 0.03, p[2]]);
  if (c) {
    const sc = s.cam.scaleAt(p);
    s.raw(glow(s.defs, c[0], c[1], glowR * sc, "#ffc873", alpha), 2.4);
    s.raw(glow(s.defs, c[0], c[1], glowR * sc * 0.18, "#fff4d8", 0.9), 2.5);
  }
}

export function chandelier(s: Scene, x: number, y: number, z: number, ceiling: number, arms = 6, r = 0.45, metal: string = P.goldDark): void {
  s.group([x, y, z], () => {
    s.rod([x, ceiling, z], [x, y + 0.25, z], metal, 0.015);
    s.cyl([x, y - 0.05, z], 0.05, 0.08, 0.3, { side: metal });
    for (let i = 0; i < arms; i++) {
      const a = (i / arms) * Math.PI * 2 + 0.3;
      const ax = x + Math.cos(a) * r;
      const az = z + Math.sin(a) * r * 0.9;
      s.rod([x, y + 0.02, z], [ax, y + 0.02, az], metal, 0.018);
      s.rod([ax, y + 0.02, az], [ax, y + 0.12, az], metal, 0.016);
      s.cyl([ax, y + 0.12, az], 0.025, 0.025, 0.08, { side: "#f6efe0" });
    }
  });
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2 + 0.3;
    const pp: V3 = [x + Math.cos(a) * r, y + 0.24, z + Math.sin(a) * r * 0.9];
    const c = s.cam.project(pp);
    if (!c) continue;
    const sc = s.cam.scaleAt(pp);
    s.raw(glow(s.defs, c[0], c[1], 0.05 * sc, "#fff6dc", 0.95), 2.5);
    s.raw(glow(s.defs, c[0], c[1], 0.35 * sc, "#ffcf85", 0.45), 2.4);
  }
  const c = s.cam.project([x, y + 0.15, z]);
  if (c) s.raw(glow(s.defs, c[0], c[1], 1.8 * s.cam.scaleAt([x, y, z]), "#ffc976", 0.35), 2.2);
}

export function wallSconce(s: Scene, p: V3, color = "#ffd79a"): void {
  s.sprite(p, `<path d="M-0.06 0 h0.12 l-0.02 -0.16 h-0.08z" fill="#efe4cc"/><rect x="-0.012" y="0" width="0.024" height="0.08" fill="${P.goldDark}"/>`);
  const c = s.cam.project([p[0], p[1] + 0.08, p[2]]);
  if (c) {
    const sc = s.cam.scaleAt(p);
    s.raw(ellipseGlow(s.defs, c[0], c[1], 0.45 * sc, 0.7 * sc, color, 0.55), 2.2);
  }
}

/** Catenary string of festoon bulbs between two points. */
export function stringLights(s: Scene, a: V3, b: V3, sag: number, bulbs: number, alpha = 0.8): void {
  const pts3: V3[] = [];
  const n = 30;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts3.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
  }
  const proj = pts3.map((p) => s.cam.project(p)).filter((p): p is P2 => !!p);
  if (proj.length > 1) s.raw(`<polyline points="${pts(proj)}" fill="none" stroke="#2b241e" stroke-width="1.4" stroke-opacity="0.8"/>`, 1.9);
  for (let i = 1; i < bulbs; i++) {
    const t = i / bulbs;
    const p: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t) - 0.06, a[2] + (b[2] - a[2]) * t];
    const c = s.cam.project(p);
    if (!c) continue;
    const sc = s.cam.scaleAt(p);
    s.raw(`<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${f1(Math.max(1.2, 0.035 * sc))}" fill="#fff3d0"/>`, 2.5);
    s.raw(glow(s.defs, c[0], c[1], Math.max(6, 0.4 * sc), "#ffc56e", alpha * 0.6), 2.4);
  }
}

// ---------------------------------------------------------------------------
// Table decor sprites (metres, y up = negative)
// ---------------------------------------------------------------------------

export function wineGlassSvg(h = 0.19, wine?: string): string {
  const bw = h * 0.28;
  const bowlTop = -h;
  const bowlBot = -h * 0.55;
  const fill = wine
    ? `<path d="M${-bw * 0.85} ${f1s(bowlBot - h * 0.12)} Q 0 ${f1s(bowlBot + h * 0.05)} ${bw * 0.85} ${f1s(bowlBot - h * 0.12)} Q ${bw * 0.6} ${f1s(bowlBot + 0.01)} 0 ${f1s(bowlBot)} Q ${-bw * 0.6} ${f1s(bowlBot + 0.01)} ${-bw * 0.85} ${f1s(bowlBot - h * 0.12)}z" fill="${wine}" opacity="0.85"/>`
    : "";
  return (
    `<path d="M${-bw} ${f1s(bowlTop)} C ${-bw} ${f1s(bowlBot)}, ${-bw * 0.3} ${f1s(bowlBot + 0.005)}, 0 ${f1s(bowlBot)} C ${bw * 0.3} ${f1s(bowlBot + 0.005)}, ${bw} ${f1s(bowlBot)}, ${bw} ${f1s(bowlTop)} Z" fill="#ffffff" fill-opacity="0.28" stroke="#ffffff" stroke-opacity="0.8" stroke-width="${h * 0.02}"/>` +
    fill +
    `<path d="M${-bw * 0.6} ${f1s(bowlTop + h * 0.08)} Q ${-bw * 0.75} ${f1s(bowlBot - h * 0.1)} ${-bw * 0.3} ${f1s(bowlBot - h * 0.05)}" stroke="#ffffff" stroke-width="${h * 0.025}" fill="none" opacity="0.9"/>` +
    `<rect x="${-h * 0.012}" y="${f1s(bowlBot)}" width="${h * 0.024}" height="${f1s(-bowlBot)}" fill="#f4f1ea" opacity="0.85"/>` +
    `<ellipse cx="0" cy="0" rx="${bw * 0.8}" ry="${h * 0.03}" fill="#f4f1ea" opacity="0.85"/>`
  );
}

function f1s(n: number): string {
  return (Math.round(n * 10000) / 10000).toString();
}

export function tumblerSvg(h = 0.12, beer = false): string {
  const w = h * 0.36;
  return (
    `<path d="M${-w} ${-h} L${-w * 0.85} 0 H${w * 0.85} L${w} ${-h} Z" fill="${beer ? "#d9a441" : "#ffffff"}" fill-opacity="${beer ? 0.9 : 0.3}" stroke="#ffffff" stroke-opacity="0.7" stroke-width="${h * 0.02}"/>` +
    (beer ? `<path d="M${-w} ${-h} L${w} ${-h} L${w * 0.98} ${-h * 0.82} L${-w * 0.98} ${-h * 0.82}Z" fill="#fbf6ea"/>` : "") +
    `<path d="M${-w * 0.6} ${-h * 0.9} L${-w * 0.5} ${-h * 0.1}" stroke="#ffffff" stroke-opacity="0.7" stroke-width="${h * 0.04}"/>`
  );
}

export function bottleSvg(h = 0.3, color = "#3f5a3a", label = "#efe2c4"): string {
  const w = h * 0.13;
  return (
    `<path d="M${-w} 0 V${-h * 0.62} C ${-w} ${-h * 0.72}, ${-w * 0.35} ${-h * 0.75}, ${-w * 0.35} ${-h * 0.82} V${-h} H${w * 0.35} V${-h * 0.82} C ${w * 0.35} ${-h * 0.75}, ${w} ${-h * 0.72}, ${w} ${-h * 0.62} V0Z" fill="${color}"/>` +
    `<rect x="${-w}" y="${-h * 0.45}" width="${w * 2}" height="${h * 0.22}" fill="${label}"/>` +
    `<rect x="${-w * 0.6}" y="${-h * 0.6}" width="${w * 0.3}" height="${h * 0.55}" fill="#ffffff" opacity="0.25"/>`
  );
}

export function vaseFlowersSvg(rand: Rand, h = 0.3, flower: string = "#e8c6b0", vase: string = "#efe8da"): string {
  const out: string[] = [];
  out.push(`<path d="M-0.04 0 C -0.06 -0.05, -0.05 -0.09, -0.025 -0.11 H0.025 C 0.05 -0.09, 0.06 -0.05, 0.04 0Z" fill="${vase}"/>`);
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (rand() - 0.5) * 1.6;
    const len = h * (0.6 + rand() * 0.4);
    const x = Math.cos(a) * len * 0.6;
    const y = -0.1 + Math.sin(a) * len;
    out.push(`<path d="M0 -0.1 Q ${f1s(x * 0.3)} ${f1s(y * 0.6)} ${f1s(x)} ${f1s(y)}" stroke="#6b7d4c" stroke-width="0.006" fill="none"/>`);
    out.push(`<ellipse cx="${f1s(x + 0.02)}" cy="${f1s(y + 0.03)}" rx="0.03" ry="0.012" fill="#7d9160" transform="rotate(${f1s((a * 180) / Math.PI + 60)} ${f1s(x + 0.02)} ${f1s(y + 0.03)})"/>`);
    const c = i % 3 === 0 ? P.paper : i % 3 === 1 ? flower : lighten(flower, 0.3);
    out.push(`<circle cx="${f1s(x)}" cy="${f1s(y)}" r="${f1s(0.025 + rand() * 0.012)}" fill="${c}"/>`);
    out.push(`<circle cx="${f1s(x - 0.006)}" cy="${f1s(y - 0.006)}" r="0.01" fill="#ffffff" opacity="0.5"/>`);
  }
  return out.join("");
}

/** Knife / fork lying flat on the table. `dir` = diner's viewing direction. */
export function flatware(s: Scene, c: V3, dir: [number, number], side: [number, number], kind: "knife" | "fork"): void {
  const len = 0.2;
  const w = 0.009;
  const at = (u: number, v: number): V3 => [c[0] + dir[0] * u + side[0] * v, c[1], c[2] + dir[1] * u + side[1] * v];
  s.poly([at(-len / 2, -w), at(-len / 2, w), at(len / 2 - 0.05, w), at(len / 2 - 0.05, -w)], "#c7cac6", { layer: ON_FLAT, stroke: "#a9adaa", strokeWidth: 0.5 });
  const hw = kind === "fork" ? 0.016 : 0.011;
  s.poly([at(len / 2 - 0.05, -hw), at(len / 2 - 0.05, hw), at(len / 2, hw), at(len / 2, -hw)], "#dfe1dd", { layer: ON_FLAT, stroke: "#b3b7b3", strokeWidth: 0.5 });
}

/** Place setting: plate, napkin, cutlery, glasses on a table top at height y. */
export function placeSetting(s: Scene, x: number, y: number, z: number, facing: Facing, rand: Rand, wine = true): void {
  const dir: [number, number] = facing === "-z" ? [0, -1] : facing === "+z" ? [0, 1] : facing === "+x" ? [1, 0] : [-1, 0];
  // plate centre slightly towards the sitter
  const px = x + dir[0] * 0.02;
  const pz = z + dir[1] * 0.02;
  s.disc([px, y + 0.004, pz], 0.14, "#e9e4da", { layer: ON_FLAT });
  s.disc([px, y + 0.008, pz], 0.1, "#fbfaf6", { layer: ON_FLAT, bias: -0.001 });
  // cutlery: knife right, fork left (flat quads in the table plane)
  const side: [number, number] = [dir[1], -dir[0]]; // diner's right hand
  for (const k of [-1, 1]) {
    const cx = px + side[0] * 0.18 * k;
    const cz = pz + side[1] * 0.18 * k;
    flatware(s, [cx, y + 0.005, cz], dir, side, k < 0 ? "fork" : "knife");
  }
  // glasses: beyond the plate, to the diner's right
  const gx = px + dir[0] * 0.2 + side[0] * 0.13;
  const gz = pz + dir[1] * 0.2 + side[1] * 0.13;
  s.sprite([gx, y, gz], wineGlassSvg(0.2, wine && rand() > 0.5 ? "#8e2a36" : undefined), { layer: ON_TOP });
  if (rand() > 0.4) s.sprite([gx + side[0] * 0.08, y, gz + side[1] * 0.08], tumblerSvg(0.1), { layer: ON_TOP });
}

// ---------------------------------------------------------------------------
// Plants & trees
// ---------------------------------------------------------------------------

export function leafySvg(rand: Rand, w: number, h: number, colors: string[], leaves = 26, kind: "round" | "long" | "fern" = "round"): string {
  const out: string[] = [];
  for (let i = 0; i < leaves; i++) {
    const t = rand();
    const a = -Math.PI / 2 + (rand() - 0.5) * (kind === "fern" ? 2.6 : 2.2);
    const len = h * (0.45 + rand() * 0.55);
    const x = Math.cos(a) * len * (w / h) * 0.9;
    const y = Math.sin(a) * len;
    const c = colors[Math.floor(rand() * colors.length) % colors.length] ?? P.leaf;
    if (kind === "long" || kind === "fern") {
      const mx = x * 0.5 + (rand() - 0.5) * 0.05;
      const my = y * 0.6;
      const lw = kind === "fern" ? 0.035 : 0.05;
      out.push(`<path d="M0 0 Q ${f1s(mx - lw)} ${f1s(my)} ${f1s(x)} ${f1s(y)} Q ${f1s(mx + lw)} ${f1s(my)} 0 0Z" fill="${c}"/>`);
    } else {
      const rx = w * (0.1 + rand() * 0.08);
      const ry = rx * (0.55 + t * 0.2);
      out.push(
        `<ellipse cx="${f1s(x)}" cy="${f1s(y)}" rx="${f1s(rx)}" ry="${f1s(ry)}" fill="${c}" transform="rotate(${f1s((a * 180) / Math.PI)} ${f1s(x)} ${f1s(y)})"/>`,
      );
    }
  }
  return out.join("");
}

export function pottedPlant(
  s: Scene,
  p: V3,
  rand: Rand,
  opts: { pot?: string; potR?: number; potH?: number; h?: number; w?: number; kind?: "round" | "long" | "fern" | "olive"; colors?: string[] } = {},
): void {
  const pot = opts.pot ?? P.terracotta;
  const pr = opts.potR ?? 0.22;
  const ph = opts.potH ?? 0.4;
  const h = opts.h ?? 1.2;
  const w = opts.w ?? 0.9;
  const colors = opts.colors ?? [P.leaf, P.moss, P.leafLight, "#6d8752"];
  s.group([p[0], p[1] + h / 2, p[2]], () => {
    s.cyl(p, pr * 0.8, pr, ph, { side: pot, top: darken(pot, 0.45) });
    if (opts.kind === "olive") {
      const trunk = `<path d="M-0.02 0 C -0.03 ${-h * 0.3}, 0.03 ${-h * 0.45}, 0 ${-h * 0.62} L0.02 ${-h * 0.62} C 0.05 ${-h * 0.45}, 0.0 ${-h * 0.3}, 0.02 0Z" fill="${P.woodDark}"/>`;
      const crown: string[] = [];
      const cols = ["#8b9a6b", "#76885a", "#a3ae84", "#6a7a50", "#5f6f47"];
      for (let i = 0; i < 90; i++) {
        const a = rand() * Math.PI * 2;
        const d = Math.sqrt(rand());
        const x = Math.cos(a) * d * w * 0.48;
        const y = -h * 0.78 + Math.sin(a) * d * h * 0.2;
        const ang = rand() * 180;
        crown.push(`<ellipse cx="${f1s(x)}" cy="${f1s(y)}" rx="${f1s(w * 0.07)}" ry="${f1s(w * 0.022)}" fill="${cols[i % cols.length]}" transform="rotate(${f1s(ang)} ${f1s(x)} ${f1s(y)})"/>`);
      }
      s.sprite([p[0], p[1] + ph, p[2]], trunk + crown.join(""), { bias: -0.01 });
    } else {
      s.sprite([p[0], p[1] + ph, p[2]], leafySvg(rand, w, h, colors, 40, opts.kind ?? "long"), { bias: -0.01 });
    }
  });
}

/** Deciduous (chestnut-like) tree sprite. */
export function treeSvg(rand: Rand, h: number, w: number, opts: { trunk?: string; colors?: string[]; light?: string } = {}): string {
  const trunk = opts.trunk ?? "#4a3a2c";
  const colors = opts.colors ?? ["#4f6b3b", "#5f7a47", "#3f5530", "#6d8752"];
  const out: string[] = [];
  const th = h * 0.45;
  out.push(`<path d="M${-w * 0.05} 0 C ${-w * 0.04} ${-th * 0.5}, ${-w * 0.03} ${-th * 0.8}, ${-w * 0.02} ${-th} L${w * 0.02} ${-th} C ${w * 0.03} ${-th * 0.8}, ${w * 0.05} ${-th * 0.4}, ${w * 0.06} 0Z" fill="${trunk}"/>`);
  out.push(`<path d="M0 ${-th * 0.8} Q ${-w * 0.15} ${-th} ${-w * 0.22} ${-th * 1.25}" stroke="${trunk}" stroke-width="${w * 0.025}" fill="none"/>`);
  out.push(`<path d="M0 ${-th * 0.85} Q ${w * 0.12} ${-th} ${w * 0.25} ${-th * 1.2}" stroke="${trunk}" stroke-width="${w * 0.022}" fill="none"/>`);
  const cy = -h * 0.68;
  const blobs = 22;
  for (let i = 0; i < blobs; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * 0.34;
    const x = Math.cos(a) * w * d;
    const y = cy + Math.sin(a) * h * d * 0.55;
    const r = w * (0.14 + rand() * 0.1);
    const c = colors[i % colors.length] ?? P.leaf;
    out.push(`<circle cx="${f1s(x)}" cy="${f1s(y)}" r="${f1s(r)}" fill="${c}"/>`);
  }
  // highlight blobs (upper left)
  for (let i = 0; i < 7; i++) {
    const x = -w * 0.18 + rand() * w * 0.2;
    const y = cy - h * 0.12 + rand() * h * 0.08;
    out.push(`<circle cx="${f1s(x)}" cy="${f1s(y)}" r="${f1s(w * (0.06 + rand() * 0.05))}" fill="${opts.light ?? "#8fa46c"}" opacity="0.55"/>`);
  }
  return out.join("");
}

/** Framed picture hung on a wall. */
export function picture(s: Scene, side: WallSide, plane: number, u0: number, u1: number, v0: number, v1: number, art: string, frame: string = P.goldDark, layer = 0.45): void {
  const off = side === "left" ? 0.02 : side === "right" ? -0.02 : -0.02;
  const outer = wallRect(side, plane + off, u0, u1, v0, v1);
  const m = Math.min(u1 - u0, v1 - v0) * 0.1;
  const inner = wallRect(side, plane + off, u0 + m, u1 - m, v0 + m, v1 - m);
  s.poly(outer, frame, { layer });
  const pi = s.projectPoly(inner);
  if (pi) {
    s.poly(inner, art, { layer: layer + 0.001 });
    const sheen = s.defs.linear([[0, "#ffffff", 0.18], [0.6, "#ffffff", 0]], 0, 0, 1, 1);
    s.raw(`<polygon points="${pts(pi.pts)}" fill="${sheen}"/>`, layer + 0.002);
  }
}

/** Out-of-focus light discs (screen space). */
export function bokeh(s: Scene, rand: Rand, n: number, area: [number, number, number, number], rMin: number, rMax: number, colors: string[], alpha = 0.35): void {
  const [x0, y0, x1, y1] = area;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + rand() * (x1 - x0);
    const y = y0 + rand() * (y1 - y0);
    const r = rMin + rand() * (rMax - rMin);
    const c = colors[i % colors.length] ?? "#ffd08a";
    out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${c}" fill-opacity="${(alpha * (0.5 + rand() * 0.5)).toFixed(2)}" stroke="${c}" stroke-opacity="${(alpha * 0.9).toFixed(2)}" stroke-width="1.5"/>`);
  }
  s.raw(`<g filter="${s.defs.blur(2.5)}" style="mix-blend-mode:screen">${out.join("")}</g>`, 2.6);
}

/** Two-tone "landscape painting" gradient for framed pictures. */
export function paintingFill(s: Scene, sky = "#d9dccb", land = "#8e9a6a", dark = "#5f6b45"): string {
  return s.defs.linear([
    [0, lighten(sky, 0.1)],
    [0.52, sky],
    [0.53, land],
    [1, dark],
  ]);
}

/** Upholstered armchair / lounge chair from boxes. */
export function armchair(s: Scene, x: number, z: number, facing: Facing, fabric: string, frame: string = P.woodDark, w = 0.78): void {
  s.group([x, 0.4, z], () => {
    const rot = (lx: number, lz: number): [number, number] => {
      switch (facing) {
        case "-z":
          return [x + lx, z + lz];
        case "+z":
          return [x - lx, z - lz];
        case "+x":
          return [x - lz, z + lx];
        case "-x":
          return [x + lz, z - lx];
      }
    };
    const bx = (lx0: number, y0: number, lz0: number, lx1: number, y1: number, lz1: number, col: string) => {
      const [ax, az] = rot(lx0, lz0);
      const [bxx, bz] = rot(lx1, lz1);
      s.box([Math.min(ax, bxx), y0, Math.min(az, bz)], [Math.max(ax, bxx), y1, Math.max(az, bz)], col);
    };
    const hw = w / 2;
    const d = 0.4;
    for (const [lx, lz] of [[-hw + 0.04, -d + 0.04], [hw - 0.08, -d + 0.04], [-hw + 0.04, d - 0.08], [hw - 0.08, d - 0.08]] as const) {
      bx(lx, 0, lz, lx + 0.04, 0.14, lz + 0.04, frame);
    }
    bx(-hw, 0.14, -d, hw, 0.3, d, darken(fabric, 0.08));
    bx(-hw + 0.13, 0.3, -d + 0.02, hw - 0.13, 0.42, d - 0.14, lighten(fabric, 0.05));
    bx(-hw, 0.14, d - 0.16, hw, 0.8, d, fabric);
    bx(-hw, 0.14, -d, -hw + 0.13, 0.56, d, darken(fabric, 0.04));
    bx(hw - 0.13, 0.14, -d, hw, 0.56, d, darken(fabric, 0.04));
  });
}

/** Pan hanging from a hook (front view sprite). */
export function hangingPanSvg(r = 0.13, color: string = "#b06a3b", handle: string = P.inkSoft): string {
  return (
    `<path d="M0 0 V0.08" stroke="${P.steelDark}" stroke-width="0.008"/>` +
    `<rect x="-0.012" y="0.07" width="0.024" height="0.22" rx="0.01" fill="${handle}"/>` +
    `<circle cx="0" cy="${0.29 + r}" r="${r}" fill="${color}"/>` +
    `<circle cx="0" cy="${0.29 + r}" r="${r * 0.78}" fill="${darken(color, 0.15)}"/>` +
    `<path d="M${-r * 0.6} ${0.29 + r * 0.5} A ${r * 0.8} ${r * 0.8} 0 0 1 ${r * 0.1} ${0.29 + r * 0.2}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="${r * 0.08}" fill="none"/>`
  );
}

/** Steam wisps (screen space) rising from a point. */
export function steam(s: Scene, p: V3, rand: Rand, height = 0.45, alpha = 0.35): void {
  const c = s.cam.project(p);
  if (!c) return;
  const sc = s.cam.scaleAt(p);
  const out: string[] = [];
  for (let i = 0; i < 3; i++) {
    const x0 = c[0] + (rand() - 0.5) * 0.12 * sc;
    const hgt = height * sc * (0.7 + rand() * 0.4);
    const amp = 0.05 * sc;
    out.push(
      `<path d="M${f1(x0)} ${f1(c[1])} C ${f1(x0 - amp)} ${f1(c[1] - hgt * 0.3)}, ${f1(x0 + amp)} ${f1(c[1] - hgt * 0.55)}, ${f1(x0 - amp * 0.4)} ${f1(c[1] - hgt)}" stroke="#ffffff" stroke-width="${f1(0.05 * sc)}" stroke-linecap="round" fill="none" opacity="${alpha}"/>`,
    );
  }
  s.raw(`<g filter="${s.defs.blur(Math.max(2, 0.012 * sc))}" style="mix-blend-mode:screen">${out.join("")}</g>`, 2.3);
}

/** Grid of lines on an axis-aligned wall rectangle (tiles, panelling). */
export function wallGrid(s: Scene, side: WallSide, plane: number, u0: number, u1: number, v0: number, v1: number, du: number, dv: number, color: string, widthPx = 0.8, opacity = 0.6, offsetRows = false, layer = 0.3): void {
  for (let v = v0; v <= v1 + 1e-6; v += dv) {
    const [a, b] = side === "back" ? [[u0, v, plane], [u1, v, plane]] : [[plane, v, u0], [plane, v, u1]];
    s.line(a as V3, b as V3, color, widthPx, { layer, opacity });
  }
  let row = 0;
  for (let v = v0; v < v1 - 1e-6; v += dv, row++) {
    const shift = offsetRows && row % 2 ? du / 2 : 0;
    for (let u = u0 + shift; u <= u1 + 1e-6; u += du) {
      const top = Math.min(v + dv, v1);
      const [a, b] = side === "back" ? [[u, v, plane], [u, top, plane]] : [[plane, v, u], [plane, top, u]];
      if (side !== "back" && u < s.cam.pos[2] + 0.2) continue;
      s.line(a as V3, b as V3, color, widthPx, { layer, opacity });
    }
  }
}
