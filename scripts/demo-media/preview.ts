/**
 * Dev helper: renders selected shots to PNG/WebP in a scratch folder for
 * quick visual review (does NOT touch public/).
 *
 *   npx tsx --tsconfig tsconfig.json scripts/demo-media/preview.ts <outDir> [folder[:shot]] …
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { newImagePage, renderSvg, toWebp } from "./lib/render";
import { ALL_SCENES } from "./scenes";

async function main() {
  const [outDir, ...filters] = process.argv.slice(2);
  if (!outDir) throw new Error("usage: preview.ts <outDir> [folder[:shot]] …");
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await newImagePage(browser);
    for (const space of ALL_SCENES) {
      for (const shot of space.shots) {
        const id = `${space.folder}:${shot.name}`;
        if (filters.length && !filters.some((f) => f === space.folder || f === id)) continue;
        const t0 = Date.now();
        const svg = shot.render();
        const { labelled } = await renderSvg(page, svg);
        const { buf, quality } = await toWebp(labelled);
        const base = join(outDir, `${space.folder}-${shot.name}`);
        writeFileSync(`${base}.png`, labelled);
        writeFileSync(`${base}.webp`, buf);
        console.log(`${id}: ${(buf.length / 1024).toFixed(0)} KB webp q${quality}, svg ${(svg.length / 1024).toFixed(0)} KB, ${Date.now() - t0} ms`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
