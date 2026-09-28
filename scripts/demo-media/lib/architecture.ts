/**
 * Exterior architecture for the perspective engine: a traditional German
 * country inn with plastered ground floor, half-timbered (Fachwerk) upper
 * floor, terracotta roof, shuttered windows, arched door and crown sign.
 */
import { darken, lighten, mix, P } from "./color";
import { ON_FLAT, ON_TOP, type Scene, type V3 } from "./persp";
import { ellipseGlow, glow } from "./svg";

export interface HouseSpec {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  eave: number;
  ridge: number;
  /** ridge runs along x (eaves side faces the viewer) or z (gable faces the viewer) */
  ridgeAxis: "x" | "z";
  hip?: boolean;
  wall: string;
  roof: string;
  overhang?: number;
  /** Half-timbering on the front (z0) face between these heights. */
  fachwerk?: { y0: number; y1: number; beam: string; infill: string; bay?: number };
  /** Windows on the front face. */
  windows?: WindowSpec[];
  /** Lights in windows (evening). */
  lit?: boolean;
  plinth?: string;
  dormers?: number[];
}

export interface WindowSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  shutters?: string;
  box?: boolean;
}

const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Tile courses on a roof slope quad (a→b eave, d→c ridge). */
function tileCourses(s: Scene, q: V3[], color: string, step = 0.32, layer: number = ON_TOP): void {
  const [a, b, c, d] = q as [V3, V3, V3, V3];
  const len = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
  const n = Math.max(2, Math.round(len / step));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    s.line(lerp3(a, d, t), lerp3(b, c, t), darken(color, 0.22), 1, { layer: layer + 0.001, opacity: 0.55 });
  }
}

export function windowOnFacade(s: Scene, z: number, w: WindowSpec, lit: boolean, frame: string = P.paper, base: number = ON_FLAT): void {
  const zz = z - 0.012;
  const q = (x0: number, y0: number, x1: number, y1: number, dz = 0): V3[] => [
    [x0, y0, zz - dz],
    [x1, y0, zz - dz],
    [x1, y1, zz - dz],
    [x0, y1, zz - dz],
  ];
  const glass = lit ? "#f6c77f" : "#5d6b72";
  s.poly(q(w.x - w.w / 2 - 0.07, w.y - 0.07, w.x + w.w / 2 + 0.07, w.y + w.h + 0.07), frame, { layer: base + 0.002 });
  s.poly(q(w.x - w.w / 2, w.y, w.x + w.w / 2, w.y + w.h), glass, { layer: base + 0.003 });
  if (!lit) {
    s.poly(q(w.x - w.w / 2, w.y + w.h * 0.55, w.x + w.w / 2, w.y + w.h), mix(glass, "#dfe6e2", 0.35), { layer: base + 0.0031 });
  }
  s.line([w.x, w.y, zz], [w.x, w.y + w.h, zz], frame, 2, { layer: base + 0.004 });
  s.line([w.x - w.w / 2, w.y + w.h * 0.62, zz], [w.x + w.w / 2, w.y + w.h * 0.62, zz], frame, 2, { layer: base + 0.004 });
  if (w.shutters) {
    const sw = w.w / 2 + 0.02;
    for (const side of [-1, 1]) {
      const xa = side < 0 ? w.x - w.w / 2 - 0.08 - sw : w.x + w.w / 2 + 0.08;
      s.poly(q(xa, w.y - 0.05, xa + sw, w.y + w.h + 0.05, 0.005), w.shutters, { layer: base + 0.002 });
      for (let k = 1; k < 7; k++) {
        const y = w.y - 0.05 + ((w.h + 0.1) * k) / 7;
        s.line([xa + 0.03, y, zz - 0.006], [xa + sw - 0.03, y, zz - 0.006], darken(w.shutters, 0.25), 1, { layer: base + 0.0025 });
      }
    }
  }
  if (w.box) {
    s.box([w.x - w.w / 2 - 0.05, w.y - 0.22, z - 0.26], [w.x + w.w / 2 + 0.05, w.y - 0.04, z - 0.01], { base: P.woodDark }, { layer: base + 0.005 });
    const flowers: string[] = [];
    for (let i = 0; i < 12; i++) {
      const fx = -w.w / 2 + (i / 11) * w.w;
      flowers.push(`<circle cx="${fx.toFixed(3)}" cy="${(-0.06 - (i % 3) * 0.035).toFixed(3)}" r="0.045" fill="${i % 4 === 0 ? "#5f7a47" : i % 2 ? "#b8402f" : "#c95442"}"/>`);
      flowers.push(`<circle cx="${(fx + 0.03).toFixed(3)}" cy="${(-0.02).toFixed(3)}" r="0.04" fill="#5f7a47"/>`);
    }
    s.sprite([w.x, w.y - 0.04, z - 0.14], flowers.join(""), { layer: base + 0.006 });
  }
  if (lit) {
    const c = s.cam.project([w.x, w.y + w.h / 2, zz]);
    if (c) {
      const sc = s.cam.scaleAt([w.x, w.y, zz]);
      s.raw(ellipseGlow(s.defs, c[0], c[1], w.w * sc * 1.2, w.h * sc * 1.0, "#ffc676", 0.45), 2.2);
    }
  }
}

/** Arched entrance door on the front face. */
export function archDoor(s: Scene, x: number, z: number, w: number, h: number, wood: string = "#5a3d28", lit = false): void {
  const zz = z - 0.012;
  const pts3 = (inset: number, dz: number): V3[] => {
    const out: V3[] = [[x - w / 2 + inset, 0, zz - dz], [x + w / 2 - inset, 0, zz - dz]];
    const r = w / 2 - inset;
    const spring = h - w / 2;
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      out.push([x + Math.cos(a) * r, spring + Math.sin(a) * r, zz - dz]);
    }
    return out;
  };
  s.poly(pts3(-0.14, 0), "#d9ccb4", { layer: ON_FLAT + 0.002 });
  s.poly(pts3(0, 0.004), wood, { layer: ON_FLAT + 0.003 });
  s.line([x, 0, zz - 0.006], [x, h - 0.05, zz - 0.006], darken(wood, 0.35), 2, { layer: ON_FLAT + 0.004 });
  for (let k = 1; k < 4; k++) {
    const y = (h - w / 2) * (k / 4);
    s.line([x - w / 2 + 0.08, y, zz - 0.006], [x + w / 2 - 0.08, y, zz - 0.006], darken(wood, 0.25), 1.2, { layer: ON_FLAT + 0.004 });
  }
  if (lit) {
    const c = s.cam.project([x, h * 0.6, zz]);
    if (c) s.raw(ellipseGlow(s.defs, c[0], c[1], w * s.cam.scaleAt([x, 1, zz]), h * 0.6 * s.cam.scaleAt([x, 1, zz]), "#ffc676", 0.25), 2.2);
  }
}

/** The inn's crown sign on a wrought-iron bracket (sprite). */
export function crownSignSvg(scale = 1): string {
  const k = 0.012 * scale;
  const crown =
    `<g transform="translate(${(-32 * k).toFixed(4)} ${(0.1 * scale).toFixed(4)}) scale(${k.toFixed(4)})">` +
    `<path d="M6 34 3 12l14 10L32 4l15 18 14-10-3 22z" fill="${P.gold}" stroke="${P.goldDark}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<path d="M6 34 3 12l14 10L32 4 32 34z" fill="${P.goldLight}" opacity="0.55"/>` +
    `<path d="M8 39h48" stroke="${P.goldDark}" stroke-width="3" stroke-linecap="round"/>` +
    `<rect x="7" y="34" width="50" height="6" fill="${P.gold}"/>` +
    `<circle cx="3" cy="11" r="2.8" fill="${P.goldLight}"/><circle cx="32" cy="3.4" r="3" fill="${P.goldLight}"/><circle cx="61" cy="11" r="2.8" fill="${P.goldLight}"/>` +
    `<circle cx="17.5" cy="28" r="2" fill="${P.wine}"/><circle cx="32" cy="27" r="2.4" fill="#3f5a7a"/><circle cx="46.5" cy="28" r="2" fill="${P.wine}"/>` +
    `</g>`;
  const s = scale;
  const bracket =
    `<path d="M0 0 H${(0.95 * s).toFixed(3)}" stroke="#1c1917" stroke-width="${(0.03 * s).toFixed(3)}"/>` +
    `<path d="M0 ${(0.35 * s).toFixed(3)} Q ${(0.35 * s).toFixed(3)} ${(0.3 * s).toFixed(3)} ${(0.6 * s).toFixed(3)} 0" stroke="#1c1917" stroke-width="${(0.02 * s).toFixed(3)}" fill="none"/>` +
    `<path d="M${(0.1 * s).toFixed(3)} 0 C ${(0.15 * s).toFixed(3)} ${(-0.12 * s).toFixed(3)}, ${(0.32 * s).toFixed(3)} ${(-0.12 * s).toFixed(3)}, ${(0.3 * s).toFixed(3)} ${(-0.02 * s).toFixed(3)}" stroke="#1c1917" stroke-width="${(0.014 * s).toFixed(3)}" fill="none"/>` +
    `<path d="M${(0.72 * s).toFixed(3)} 0 V${(0.1 * s).toFixed(3)}" stroke="#1c1917" stroke-width="${(0.012 * s).toFixed(3)}"/>`;
  return `${bracket}<g transform="translate(${(0.72 * s).toFixed(3)} 0)">${crown}</g>`;
}

/** Complete house with walls, windows, Fachwerk and roof – drawn as one group. */
export function house(s: Scene, h: HouseSpec): void {
  const o = h.overhang ?? 0.35;
  const zm = (h.z0 + h.z1) / 2;
  const xm = (h.x0 + h.x1) / 2;
  s.group([xm, h.eave / 2, zm], () => {
    // walls
    s.box([h.x0, 0, h.z0], [h.x1, h.eave, h.z1], { base: h.wall });
    if (h.plinth) s.box([h.x0 - 0.03, 0, h.z0 - 0.03], [h.x1 + 0.03, 0.45, h.z1 + 0.03], { base: h.plinth }, { layer: ON_FLAT });
    // gable walls
    if (h.ridgeAxis === "x" && !h.hip) {
      for (const x of [h.x0, h.x1]) {
        const visible = x === h.x0 ? s.cam.pos[0] < h.x0 : s.cam.pos[0] > h.x1;
        if (!visible) continue;
        s.poly([[x, h.eave, h.z0], [x, h.eave, h.z1], [x, h.ridge, zm]], s.shade(h.wall, [x === h.x0 ? -1 : 1, 0, 0]), { layer: 1 });
      }
    } else if (h.ridgeAxis === "z" && !h.hip) {
      const z = h.z0;
      if (s.cam.pos[2] < z) s.poly([[h.x0, h.eave, z], [h.x1, h.eave, z], [xm, h.ridge, z]], s.shade(h.wall, [0, 0, -1]), { layer: 1 });
    }
    // half-timbering on the front face
    if (h.fachwerk) {
      const f = h.fachwerk;
      const z = h.z0 - 0.006;
      const beamW = 0.16;
      const px = (x: number, y: number): V3 => [x, y, z];
      s.poly([px(h.x0, f.y0), px(h.x1, f.y0), px(h.x1, f.y1), px(h.x0, f.y1)], f.infill, { layer: ON_FLAT });
      const rod = (a: V3, b: V3) => s.rod(a, b, f.beam, beamW, { layer: ON_FLAT + 0.001 });
      rod(px(h.x0, f.y0), px(h.x1, f.y0));
      rod(px(h.x0, f.y1), px(h.x1, f.y1));
      const bay = f.bay ?? 1.2;
      const n = Math.max(2, Math.round((h.x1 - h.x0) / bay));
      for (let i = 0; i <= n; i++) {
        const x = h.x0 + ((h.x1 - h.x0) * i) / n;
        rod(px(x, f.y0), px(x, f.y1));
        if (i < n && (i % 3 === 0 || i === n - 1)) {
          const x2 = h.x0 + ((h.x1 - h.x0) * (i + 1)) / n;
          rod(px(x, f.y0), px(x2, f.y1));
          rod(px(x2, f.y0), px(x, f.y1));
        }
      }
      // sill rail under windows
      rod(px(h.x0, f.y0 + (f.y1 - f.y0) * 0.3), px(h.x1, f.y0 + (f.y1 - f.y0) * 0.3));
    }
    for (const w of h.windows ?? []) windowOnFacade(s, h.z0, w, !!h.lit);
    // roof
    const r = h.roof;
    const light = lighten(r, 0.06);
    const dark = darken(r, 0.18);
    if (h.ridgeAxis === "x") {
      const inset = h.hip ? Math.min((h.z1 - h.z0) / 2, (h.x1 - h.x0) / 2) : 0;
      const front: V3[] = [
        [h.x0 - o, h.eave - 0.1, h.z0 - o],
        [h.x1 + o, h.eave - 0.1, h.z0 - o],
        [h.x1 - inset, h.ridge, zm],
        [h.x0 + inset, h.ridge, zm],
      ];
      const back: V3[] = [
        [h.x0 - o, h.eave - 0.1, h.z1 + o],
        [h.x1 + o, h.eave - 0.1, h.z1 + o],
        [h.x1 - inset, h.ridge, zm],
        [h.x0 + inset, h.ridge, zm],
      ];
      if (s.cam.pos[1] > h.ridge || s.cam.pos[2] > zm) s.poly(back, dark, { layer: ON_TOP });
      s.poly(front, light, { layer: ON_TOP + 0.001 });
      tileCourses(s, front, r, 0.3, ON_TOP + 0.001);
      if (h.hip) {
        for (const [x, xi, sign] of [[h.x0 - o, h.x0 + inset, -1], [h.x1 + o, h.x1 - inset, 1]] as const) {
          const visible = sign < 0 ? s.cam.pos[0] < h.x0 : s.cam.pos[0] > h.x1;
          if (!visible) continue;
          s.poly([[x, h.eave - 0.1, h.z0 - o], [x, h.eave - 0.1, h.z1 + o], [xi, h.ridge, zm]], mix(light, dark, 0.5), { layer: ON_TOP + 0.002 });
        }
      } else {
        // verge boards on gable ends
        for (const x of [h.x0 - o, h.x1 + o]) {
          s.rod([x, h.eave - 0.1, h.z0 - o], [x < xm ? h.x0 - o : h.x1 + o, h.ridge, zm], darken(r, 0.35), 0.08, { layer: ON_TOP + 0.003 });
        }
      }
      s.rod([h.x0 + inset - (h.hip ? 0 : o), h.ridge, zm], [h.x1 - inset + (h.hip ? 0 : o), h.ridge, zm], darken(r, 0.3), 0.14, { layer: ON_TOP + 0.004 });
      for (const dx of h.dormers ?? []) {
        // gable dormer: cheeks + front wall + window + small pitched roof
        const t = 0.42;
        const dy = h.eave - 0.1 + (h.ridge - h.eave + 0.1) * t;
        const dz = h.z0 - o + (zm - (h.z0 - o)) * t;
        const w2 = 0.6;
        const top = dy + 1.1;
        const peak = top + 0.55;
        const back = dz + 1.6;
        const L = ON_TOP + 0.01;
        s.poly([[dx - w2, dy, dz], [dx + w2, dy, dz], [dx + w2, top, dz], [dx - w2, top, dz]], h.wall, { layer: L });
        s.poly([[dx - w2, top, dz], [dx + w2, top, dz], [dx, peak, dz]], lighten(h.wall, 0.04), { layer: L + 0.001 });
        const cheekX = s.cam.pos[0] < dx ? dx - w2 : dx + w2;
        s.poly([[cheekX, dy, dz], [cheekX, top, dz], [cheekX, top + 0.25, back], [cheekX, dy + 0.9, back]], darken(h.wall, 0.12), { layer: L - 0.001 });
        windowOnFacade(s, dz, { x: dx, y: dy + 0.2, w: 0.62, h: 0.78 }, !!h.lit, P.paper, L + 0.002);
        s.poly([[dx - w2 - 0.12, top - 0.06, dz - 0.15], [dx, peak + 0.05, dz - 0.15], [dx, peak + 0.05, back], [dx - w2 - 0.12, top - 0.06, back]], light, { layer: L + 0.01 });
        s.poly([[dx + w2 + 0.12, top - 0.06, dz - 0.15], [dx, peak + 0.05, dz - 0.15], [dx, peak + 0.05, back], [dx + w2 + 0.12, top - 0.06, back]], dark, { layer: L + 0.01 });
      }
    } else {
      const left: V3[] = [
        [h.x0 - o, h.eave - 0.1, h.z0 - o],
        [h.x0 - o, h.eave - 0.1, h.z1 + o],
        [xm, h.ridge, h.z1 + o],
        [xm, h.ridge, h.z0 - o],
      ];
      const right: V3[] = [
        [h.x1 + o, h.eave - 0.1, h.z0 - o],
        [h.x1 + o, h.eave - 0.1, h.z1 + o],
        [xm, h.ridge, h.z1 + o],
        [xm, h.ridge, h.z0 - o],
      ];
      const leftFirst = s.cam.pos[0] > xm;
      // seen from below the eaves the slopes lie behind the walls → paint them first
      const slopeLayer = s.cam.pos[1] < h.eave ? 0.99 : ON_TOP;
      for (const [q, col] of (leftFirst ? [[left, light], [right, dark]] : [[right, dark], [left, light]]) as Array<[V3[], string]>) {
        s.poly(q, col, { layer: slopeLayer });
        tileCourses(s, q, r, 0.3, slopeLayer);
      }
      if (s.cam.pos[2] < h.z0) {
        const z = h.z0 - 0.004;
        const gable: V3[] = [[h.x0, h.eave, z], [h.x1, h.eave, z], [xm, h.ridge - 0.15, z]];
        s.poly(gable, h.fachwerk ? h.fachwerk.infill : s.shade(h.wall, [0, 0, -1]), { layer: ON_TOP + 0.002 });
        if (h.fachwerk) {
          const bw = 0.15;
          const f = h.fachwerk;
          s.rod([h.x0, h.eave, z], [h.x1, h.eave, z], f.beam, bw, { layer: ON_TOP + 0.0021 });
          s.rod([xm, h.eave, z], [xm, h.ridge - 0.2, z], f.beam, bw, { layer: ON_TOP + 0.0021 });
          const cy = h.eave + (h.ridge - h.eave) * 0.45;
          const cx = (h.x1 - h.x0) * 0.55 * 0.5;
          s.rod([xm - cx, cy, z], [xm + cx, cy, z], f.beam, bw, { layer: ON_TOP + 0.0021 });
          s.rod([h.x0 + 0.8, h.eave, z], [xm - 0.2, cy, z], f.beam, bw, { layer: ON_TOP + 0.0021 });
          s.rod([h.x1 - 0.8, h.eave, z], [xm + 0.2, cy, z], f.beam, bw, { layer: ON_TOP + 0.0021 });
          windowOnFacade(s, h.z0, { x: xm, y: h.eave + 0.6, w: 0.8, h: 1.0 }, !!h.lit, P.paper, ON_TOP + 0.0022);
        }
      }
      s.rod([h.x0 - o, h.eave - 0.1, h.z0 - o], [xm, h.ridge, h.z0 - o], darken(r, 0.35), 0.09, { layer: ON_TOP + 0.003 });
      s.rod([h.x1 + o, h.eave - 0.1, h.z0 - o], [xm, h.ridge, h.z0 - o], darken(r, 0.35), 0.09, { layer: ON_TOP + 0.003 });
    }
  });
}

/** Wall lantern with glow. */
export function wallLantern(s: Scene, p: V3, lit: boolean): void {
  s.sprite(
    p,
    `<path d="M0 -0.02 H0.12" stroke="#1c1917" stroke-width="0.02"/>` +
      `<path d="M0.04 -0.02 L0.12 -0.1 L0.2 -0.02Z" fill="#1c1917"/>` +
      `<rect x="0.055" y="-0.02" width="0.13" height="0.2" fill="${lit ? "#ffd48a" : "#c9c1ae"}" stroke="#1c1917" stroke-width="0.012"/>` +
      `<path d="M0.04 0.18 H0.2 L0.17 0.22 H0.07Z" fill="#1c1917"/>`,
    { layer: 1.3 },
  );
  if (!lit) return;
  const c = s.cam.project([p[0] + 0.12, p[1] - 0.08, p[2]]);
  if (c) {
    const sc = s.cam.scaleAt(p);
    s.raw(glow(s.defs, c[0], c[1], 1.3 * sc, "#ffc676", 0.55), 2.3);
    s.raw(glow(s.defs, c[0], c[1], 0.18 * sc, "#fff3d6", 0.9), 2.4);
  }
}

/** Topiary ball in a pot. */
export function boxwoodSvg(r = 0.35, pot = P.inkSoft): string {
  return (
    `<path d="M${-r * 0.7} 0 L${-r * 0.8} ${-r * 0.9} H${r * 0.8} L${r * 0.7} 0Z" fill="${pot}"/>` +
    `<circle cx="0" cy="${-r * 1.8}" r="${r}" fill="#4f6b3b"/>` +
    `<circle cx="${-r * 0.3}" cy="${-r * 2.05}" r="${r * 0.55}" fill="#6d8752" opacity="0.8"/>` +
    `<circle cx="${-r * 0.4}" cy="${-r * 2.15}" r="${r * 0.25}" fill="#8fa46c" opacity="0.7"/>`
  );
}
