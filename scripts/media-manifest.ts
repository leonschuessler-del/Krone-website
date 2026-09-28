/**
 * Scans public/media and writes src/generated/media-manifest.json.
 * The site uses the manifest to decide whether a real photo/video exists or
 * an elegant placeholder should be shown (no broken images, no black video
 * boxes). Runs automatically before `dev` and `build`.
 */
import { readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = join(process.cwd(), "public");
const mediaDir = join(root, "media");
const MEDIA_EXT = /\.(webp|avif|jpe?g|png|mp4|webm|svg)$/i;

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out = out.concat(walk(full));
    else if (MEDIA_EXT.test(entry)) out.push("/" + relative(root, full).split(sep).join("/"));
  }
  return out;
}

const files = walk(mediaDir).sort();
mkdirSync(join(process.cwd(), "src", "generated"), { recursive: true });
writeFileSync(
  join(process.cwd(), "src", "generated", "media-manifest.json"),
  JSON.stringify({ generatedBy: "scripts/media-manifest.ts", files }, null, 2) + "\n",
);
console.log(`[media-manifest] ${files.length} media file(s) found`);
