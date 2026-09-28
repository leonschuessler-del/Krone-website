/**
 * Generates clearly-marked DEMO media (stylised illustrations + test films)
 * into public/media/_demo/. Real media in public/media/<bereich>/ always take
 * precedence on the website; these files are only a preview fallback.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/demo-media/generate.ts [options]
 *   npm run media:demo -- [options]
 *
 * Options:
 *   --only a,b      only these folders (restaurant, kitchen, …, property, hero)
 *   --skip-video    stills only (no tour.webm / hero film)
 *   --skip-hero     skip the hero test film
 *   --skip-tours    skip the per-space tour videos
 */
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { newImagePage, renderSvg, toWebp } from "./lib/render";
import { demoReadme } from "./readme";
import { ALL_SCENES } from "./scenes";
import { renderHeroFilm } from "./video/hero-film";
import { renderTour } from "./video/tour";

const OUT = join(process.cwd(), "public", "media", "_demo");

interface Args {
  only: Set<string> | null;
  tours: boolean;
  hero: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { only: null, tours: true, hero: true };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--only") a.only = new Set((argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean));
    else if (v?.startsWith("--only=")) a.only = new Set(v.slice(7).split(",").map((s) => s.trim()).filter(Boolean));
    else if (v === "--skip-video") {
      a.tours = false;
      a.hero = false;
    } else if (v === "--skip-hero") a.hero = false;
    else if (v === "--skip-tours") a.tours = false;
  }
  return a;
}

const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      for (let it = queue.shift(); it !== undefined; it = queue.shift()) await fn(it);
    }),
  );
}

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else out.push(p);
  }
  return out;
}

async function main(): Promise<void> {
  const t0 = Date.now();
  const args = parseArgs(process.argv.slice(2));
  const want = (folder: string) => !args.only || args.only.has(folder);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "README.md"), demoReadme());

  const browser = await chromium.launch();
  try {
    // 1) stills --------------------------------------------------------------
    const clean = new Map<string, Buffer[]>();
    const page = await newImagePage(browser);
    for (const space of ALL_SCENES) {
      if (!want(space.folder)) continue;
      const dir = join(OUT, space.folder);
      mkdirSync(dir, { recursive: true });
      const buffers: Buffer[] = [];
      for (const shot of space.shots) {
        const t = Date.now();
        const { labelled, clean: raw } = await renderSvg(page, shot.render());
        const { buf, quality } = await toWebp(labelled);
        writeFileSync(join(dir, `${shot.name}.webp`), buf);
        buffers.push(raw);
        console.log(`[demo-media] ${space.folder}/${shot.name}.webp  ${kb(buf.length)} (q${quality}, ${Date.now() - t} ms) – ${shot.title}`);
      }
      clean.set(space.folder, buffers);
    }
    await page.close();

    // 2) Ken-Burns tours -----------------------------------------------------
    if (args.tours) {
      const spaces = ALL_SCENES.filter((s) => s.tour && clean.has(s.folder));
      await pool(spaces, 3, async (space) => {
        const t = Date.now();
        const images = clean.get(space.folder) ?? [];
        const outWebm = join(OUT, space.folder, "tour.webm");
        const { poster, seconds } = await renderTour(browser, { images, outWebm });
        const posterWebp = await sharp(poster).webp({ quality: 82, effort: 6 }).toBuffer();
        writeFileSync(join(OUT, space.folder, "poster.webp"), posterWebp);
        console.log(`[demo-media] ${space.folder}/tour.webm  ${kb(statSync(outWebm).size)} (${seconds.toFixed(1)} s, ${((Date.now() - t) / 1000).toFixed(1)} s render)`);
      });
    }

    // 3) hero test film ------------------------------------------------------
    if (args.hero && want("hero")) {
      const t = Date.now();
      const dir = join(OUT, "hero");
      mkdirSync(dir, { recursive: true });
      const outWebm = join(dir, "krone-property-tour.webm");
      const { poster, seconds } = await renderHeroFilm(browser, { outWebm });
      writeFileSync(join(dir, "poster.webp"), await sharp(poster).webp({ quality: 82, effort: 6 }).toBuffer());
      console.log(`[demo-media] hero/krone-property-tour.webm  ${kb(statSync(outWebm).size)} (${seconds.toFixed(1)} s, ${((Date.now() - t) / 1000).toFixed(1)} s render)`);
    }
  } finally {
    await browser.close();
  }

  const files = walk(OUT).sort();
  const total = files.reduce((s, f) => s + statSync(f).size, 0);
  console.log(`\n[demo-media] ${files.length} files in ${relative(process.cwd(), OUT)}, total ${(total / 1024 / 1024).toFixed(2)} MB, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
