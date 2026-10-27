import { describe, expect, it } from "vitest";
import { mosaicSpan } from "@/components/media/mosaic";
import { getPropertyGallery, getSpaceMedia, mediaAlt } from "@/lib/media";

/** Places tiles on a 4-column grid in order (CSS grid auto-placement) and counts empty cells. */
function holes(n: number): number {
  const grid: boolean[][] = [];
  const row = (r: number) => (grid[r] ??= [false, false, false, false]);
  for (let i = 0; i < n; i++) {
    const s = mosaicSpan(i, n).split(" ").map((c) => c.replace(/^md:/, "")).join(" ");
    const cs = s.includes("col-span-4") ? 4 : s.includes("col-span-2") ? 2 : 1;
    const rs = s.includes("row-span-2") ? 2 : 1;
    let placed = false;
    for (let r = 0; !placed; r++) {
      for (let c = 0; c + cs <= 4 && !placed; c++) {
        let free = true;
        for (let dr = 0; dr < rs; dr++) for (let dc = 0; dc < cs; dc++) if (row(r + dr)[c + dc]) free = false;
        if (free) {
          for (let dr = 0; dr < rs; dr++) for (let dc = 0; dc < cs; dc++) row(r + dr)[c + dc] = true;
          placed = true;
        }
      }
    }
  }
  return grid.flat().filter((x) => !x).length;
}

describe("mosaicSpan", () => {
  it("fills every row of the 4-column grid for 1–20 images", () => {
    for (let n = 1; n <= 20; n++) expect(holes(n), `${n} images`).toBe(0);
  });
  it("keeps the large first tile", () => {
    expect(mosaicSpan(0, 7)).toContain("col-span-2 row-span-2");
  });
});

describe("media alt texts", () => {
  it("describes the new aerial front shot", () => {
    expect(mediaAlt("/media/property/gallery-01.webp", "x")).toBe("Die Krone von vorn aus der Luft: Hausfront mit Schriftzug „Zur Krone“ und Hofeinfahrt");
  });
  it("gives every real photo a descriptive text instead of „Bild n“ / „Impression n“", () => {
    const folders = ["restaurant", "side-room", "stage", "winter-garden", "beer-garden", "kitchen", "old-tavern", "hotel"];
    const real = [...getPropertyGallery(), ...folders.flatMap((f) => { const m = getSpaceMedia(f, f); return [m.hero, ...m.gallery]; })].filter((m) => m?.isReal);
    expect(real.length).toBeGreaterThan(0);
    for (const m of real) expect(m!.alt, m!.src).not.toMatch(/– (Bild|Impression) \d+$|– Zur Krone Leidersbach$/);
  });
  it("never repeats the hero inside its own gallery", () => {
    const m = getSpaceMedia("side-room", "Nebenzimmer");
    expect(m.gallery.map((g) => g.src)).not.toContain("/media/side-room/gallery-05.webp");
  });
});
