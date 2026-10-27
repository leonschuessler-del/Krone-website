/**
 * Mosaic layout for a 4-column image grid (md and up) whose first image is a 2×2 tile.
 *
 * Without help such a grid only closes cleanly for 1 + 4n images; any other count leaves
 * orphaned empty cells in the last row. `mosaicSpan` widens the last tiles so every row is
 * full – no image is dropped. Only the first tile's span applies below md (2-column grids).
 */
export function mosaicSpan(i: number, n: number): string {
  if (i === 0) return n === 1 ? "col-span-2 row-span-2 md:col-span-4" : "col-span-2 row-span-2";
  const rest = n - 1; // tiles beside/below the large one
  if (rest === 1) return "md:col-span-2 md:row-span-2"; // 2 images: two halves
  if (rest === 2) return "md:row-span-2"; // 3 images: two tall tiles on the right
  if (rest === 3) return i === 3 ? "md:col-span-2" : ""; // 4 images: wide tile bottom right
  const tail = (n - 5) % 4; // images in the last, incomplete row
  const pos = i - (n - tail); // index within that row; negative = full row
  if (tail === 1 && pos === 0) return "md:col-span-4";
  if (tail === 2 && pos >= 0) return "md:col-span-2";
  if (tail === 3 && pos === 2) return "md:col-span-2";
  return "";
}

/** `sizes` hint matching the tile width produced by `mosaicSpan` (container max ≈ 1320px). */
export function mosaicSizes(i: number, n: number): string {
  const span = mosaicSpan(i, n);
  if (span.includes("col-span-4")) return "(min-width: 1408px) 1320px, 100vw";
  if (span.includes("col-span-2") || span.includes("row-span-2")) return "(min-width: 1408px) 660px, 50vw";
  return "(min-width: 1408px) 330px, 25vw";
}
