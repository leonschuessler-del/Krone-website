import { existsSync } from "node:fs";
import { packCount, progressiveOrder } from "@/features/home/tour-player";
import { describe, expect, it } from "vitest";
import { FINALE_START_CAMERA, tourConfig, WIDE_CAMERA } from "@/config/tour";
import { cameraTransform, chapterSpans, computeFrame, overviewCamera, smoothstep, TAIL } from "@/features/home/tour-timeline";

const chapters = tourConfig.chapters;
const spans = chapterSpans(chapters);
const MAP = { width: 1536, height: 1024 };
const frame = (p: number) => computeFrame(p, chapters, spans, FINALE_START_CAMERA, WIDE_CAMERA);

describe("scroll film timeline", () => {
  it("runs outside → every area in a sensible order → map", () => {
    expect(chapters[0]!.id).toBe("intro");
    expect(chapters.at(-1)!.id).toBe("finale");
    expect(chapters.filter((c) => c.spaceId).map((c) => c.spaceId)).toEqual([
      "restaurant", "side-room", "stage", "winter-garden", "beer-garden", "kitchen", "old-tavern", "hotel",
    ]);
    chapters.forEach((c) => {
      expect(c.frames.dir).toBe(`/media/tour/frames/${c.id}/`);
      expect(c.poster).toBe(`${c.frames.dir}poster.webp`);
      expect(c.frames.count).toBeGreaterThanOrEqual(40);
      // every pack, the preview track and the poster exist in /public
      for (let p = 0; p < packCount(c.frames.count); p++) {
        expect(existsSync(`public${c.frames.dir}p${String(p).padStart(2, "0")}.webp`)).toBe(true);
      }
      expect(existsSync(`public${c.frames.dir}preview.webp`)).toBe(true);
      expect(existsSync(`public${c.frames.dir}poster.webp`)).toBe(true);
    });
  });

  it("spans are contiguous and cover 0…1", () => {
    expect(spans[0]!.start).toBe(0);
    expect(spans.at(-1)!.end).toBe(1);
    for (let i = 1; i < spans.length; i++) expect(spans[i]!.start).toBeCloseTo(spans[i - 1]!.end);
  });

  it("mid-chapter: only that clip is visible and its caption is shown", () => {
    chapters.forEach((c, i) => {
      if (!c.spaceId) return;
      const f = frame((spans[i]!.start + spans[i]!.end) / 2);
      expect(f.index).toBe(i);
      expect(f.layerOpacity[i]).toBe(1);
      expect(f.layerProgress[i]).toBeCloseTo(0.5 * (1 - TAIL), 5);
      expect(f.captionOpacity[i]).toBeGreaterThan(0.95);
      f.layerOpacity.forEach((o, j) => j !== i && expect(o).toBe(0));
      expect(f.mapOpacity).toBe(0);
    });
  });

  it("crossfades without a black gap", () => {
    for (let i = 1; i < chapters.length; i++) {
      const f = frame(spans[i]!.start + 0.001);
      expect(f.layerOpacity[i - 1]! + f.layerOpacity[i]!).toBeGreaterThanOrEqual(1);
    }
  });

  it("starts on the intro and ends on the map with all areas", () => {
    const start = frame(0);
    expect(start.captionOpacity[0]).toBe(1);
    expect(start.scrollHint).toBe(1);
    const end = frame(1);
    expect(end.index).toBe(chapters.length - 1);
    expect(end.mapOpacity).toBe(1);
    expect(end.areasOpacity).toBe(1);
    expect(end.camera.zoom).toBeCloseTo(WIDE_CAMERA.zoom);
  });

  it("clip progress is monotone within each chapter", () => {
    let prev = -1;
    for (let k = 0; k <= 100; k++) {
      const p = spans[3]!.start + ((spans[3]!.end - spans[3]!.start) * k) / 100 - 1e-9;
      const f = frame(Math.max(spans[3]!.start, p));
      expect(f.layerProgress[3]!).toBeGreaterThanOrEqual(prev);
      prev = f.layerProgress[3]!;
    }
  });

  it("camera transform always covers the viewport for zoom >= 1", () => {
    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
      for (const cam of [WIDE_CAMERA, FINALE_START_CAMERA, { x: 0, y: 0, zoom: 2 }]) {
        const { tx, ty, scale } = cameraTransform(cam, vp, MAP);
        expect(tx).toBeLessThanOrEqual(0);
        expect(ty).toBeLessThanOrEqual(0);
        expect(tx + MAP.width * scale).toBeGreaterThanOrEqual(vp.width - 0.01);
        expect(ty + MAP.height * scale).toBeGreaterThanOrEqual(vp.height - 0.01);
      }
    }
  });

  it("portrait overview keeps all areas in frame; landscape unchanged", () => {
    const vp = { width: 390, height: 664 };
    const { tx, scale } = cameraTransform(overviewCamera(WIDE_CAMERA, vp, MAP), vp, MAP);
    expect(tx + 487 * scale).toBeGreaterThanOrEqual(0);
    expect(tx + 1377 * scale).toBeLessThanOrEqual(vp.width);
    expect(overviewCamera(WIDE_CAMERA, { width: 1440, height: 900 }, MAP)).toEqual(WIDE_CAMERA);
  });

  it("smoothstep is clamped", () => {
    expect(smoothstep(0.2, 0.4, 0)).toBe(0);
    expect(smoothstep(0.2, 0.4, 1)).toBe(1);
  });
});

describe("scroll weights", () => {
  it("chapters with more movement get more scroll distance", () => {
    const sp = chapterSpans([{ id: "a", frames: { count: 40 } }, { id: "b", frames: { count: 120 } }]);
    expect(sp[1]!.end - sp[1]!.start).toBeCloseTo(2 * (sp[0]!.end - sp[0]!.start), 5);
  });
});

describe("cuts keep moving", () => {
  it("the outgoing clip plays its tail while the next one fades in", () => {
    const i = 2;
    const a = frame(spans[i]!.start + 0.001);
    const b = frame(spans[i]!.start + (spans[i]!.end - spans[i]!.start) * 0.2);
    expect(a.layerOpacity[i - 1]).toBe(1);
    expect(b.layerProgress[i - 1]!).toBeGreaterThan(a.layerProgress[i - 1]!);
    expect(b.layerProgress[i - 1]!).toBeLessThanOrEqual(1);
  });
});

describe("progressive frame order", () => {
  it("starts coarse and contains every frame exactly once", () => {
    const order = progressiveOrder(36);
    expect(order.slice(0, 3)).toEqual([0, 35, 18]);
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: 36 }, (_, i) => i));
  });
});
