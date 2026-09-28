import { describe, expect, it } from "vitest";
import { tourConfig, WIDE_CAMERA } from "@/config/tour";
import { cameraTransform, chapterSpans, computeFrame, overviewCamera, smoothstep } from "@/features/home/tour-timeline";

const chapters = tourConfig.chapters;
const spans = chapterSpans(chapters);

describe("scroll tour timeline", () => {
  it("covers every room in film order, starting with the intro and ending on the floor plan", () => {
    expect(chapters[0]!.id).toBe("intro");
    expect(chapters.at(-1)!.id).toBe("finale");
    expect(chapters.filter((c) => c.spaceId).map((c) => c.spaceId)).toEqual([
      "restaurant",
      "stage",
      "side-room",
      "old-tavern",
      "kitchen",
      "winter-garden",
      "beer-garden",
      "hotel",
    ]);
  });

  it("spans are contiguous and cover 0…1", () => {
    expect(spans[0]!.start).toBe(0);
    expect(spans.at(-1)!.end).toBe(1);
    for (let i = 1; i < spans.length; i++) expect(spans[i]!.start).toBeCloseTo(spans[i - 1]!.end);
  });

  it("derives spans from video chapter times in video mode", () => {
    const withTimes = chapters.map((c, i) => ({ ...c, videoTime: i * 10 }));
    const s = chapterSpans(withTimes, withTimes.length * 10);
    expect(s[1]).toEqual({ start: 0.1, end: 0.2 });
  });

  it("shows each room image in the middle of its chapter and nothing else", () => {
    chapters.forEach((c, i) => {
      if (!c.spaceId) return;
      const mid = (spans[i]!.start + spans[i]!.end) / 2;
      const frame = computeFrame(mid, chapters, spans, WIDE_CAMERA);
      expect(frame.index).toBe(i);
      expect(frame.roomOpacity[i]).toBeCloseTo(1, 2);
      expect(frame.captionOpacity[i]).toBeGreaterThan(0.95);
      frame.roomOpacity.forEach((o, j) => j !== i && expect(o).toBe(0));
    });
  });

  it("starts on the intro text and ends on the full bird's-eye view with all boundaries", () => {
    const start = computeFrame(0, chapters, spans, WIDE_CAMERA);
    expect(start.index).toBe(0);
    expect(start.captionOpacity[0]).toBe(1);
    expect(start.scrollHint).toBe(1);
    const end = computeFrame(1, chapters, spans, WIDE_CAMERA);
    expect(end.index).toBe(chapters.length - 1);
    expect(end.allPolygons).toBe(1);
    expect(end.camera.zoom).toBeCloseTo(WIDE_CAMERA.zoom);
    expect(end.roomOpacity.every((o) => o === 0)).toBe(true);
  });

  it("camera changes continuously (no jumps between chapters)", () => {
    // With a continuous path the change per step shrinks with the step size;
    // a discontinuity would stay large. 0.0005 ≈ 3 px of scroll on a laptop.
    // Also with the zoomed-out portrait overview as the finale target.
    const portrait = overviewCamera(WIDE_CAMERA, { width: 390, height: 664 }, { width: 1536, height: 1024 });
    for (const overview of [undefined, portrait]) {
      let prev = computeFrame(0, chapters, spans, WIDE_CAMERA, overview).camera;
      for (let i = 1; i <= 2000; i++) {
        const cam = computeFrame(i / 2000, chapters, spans, WIDE_CAMERA, overview).camera;
        expect(Math.abs(cam.x - prev.x)).toBeLessThan(15);
        expect(Math.abs(cam.y - prev.y)).toBeLessThan(15);
        expect(Math.abs(Math.log(cam.zoom / prev.zoom))).toBeLessThan(0.03);
        prev = cam;
      }
    }
  });

  it("camera transform always covers the viewport", () => {
    for (const vp of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
      { width: 1920, height: 1080 },
    ]) {
      for (const cam of [WIDE_CAMERA, { x: 0, y: 0, zoom: 2.5 }, { x: 1536, y: 1024, zoom: 2 }]) {
        const { tx, ty, scale } = cameraTransform(cam, vp, { width: 1536, height: 1024 });
        expect(tx).toBeLessThanOrEqual(0);
        expect(ty).toBeLessThanOrEqual(0);
        expect(tx + 1536 * scale).toBeGreaterThanOrEqual(vp.width - 0.01);
        expect(ty + 1024 * scale).toBeGreaterThanOrEqual(vp.height - 0.01);
      }
    }
  });

  it("finale overview keeps every bookable area in frame on portrait screens, unchanged on landscape", () => {
    const MAP = { width: 1536, height: 1024 };
    for (const vp of [
      { width: 390, height: 664 },
      { width: 820, height: 1180 },
    ]) {
      const cam = overviewCamera(WIDE_CAMERA, vp, MAP);
      expect(cam.zoom).toBeGreaterThan(0);
      const { tx, ty, scale } = cameraTransform(cam, vp, MAP);
      // Biergarten (x≈122) … Nebenzimmer (x≈996) fully visible
      expect(tx + 122 * scale).toBeGreaterThanOrEqual(0);
      expect(tx + 996 * scale).toBeLessThanOrEqual(vp.width);
      // letterboxed plan stays inside the viewport vertically
      expect(ty).toBeGreaterThanOrEqual(0);
      expect(ty + MAP.height * scale).toBeLessThanOrEqual(vp.height + 0.01);
      // the finale flies to exactly that camera
      const end = computeFrame(1, chapters, spans, WIDE_CAMERA, cam);
      expect(end.camera.zoom).toBeCloseTo(cam.zoom);
      expect(end.camera.x).toBeCloseTo(cam.x);
    }
    expect(overviewCamera(WIDE_CAMERA, { width: 1440, height: 900 }, MAP)).toBe(WIDE_CAMERA);
  });

  it("smoothstep is clamped and monotone", () => {
    expect(smoothstep(0.2, 0.4, 0)).toBe(0);
    expect(smoothstep(0.2, 0.4, 1)).toBe(1);
    expect(smoothstep(0.2, 0.4, 0.3)).toBeCloseTo(0.5);
  });
});
