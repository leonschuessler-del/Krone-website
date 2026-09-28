import manifest from "@/generated/media-manifest.json";
import type { MediaAsset } from "@/domain/types";

/**
 * Media resolution.
 *
 * Precedence for every slot:
 *   1. real media in /public/media/<folder>/...          → isReal: true
 *   2. generated demo illustration in /public/media/_demo/<folder>/...
 *                                                         → isReal: false ("Beispielbild")
 *   3. nothing → components render a neutral placeholder
 *
 * Files are known through the generated manifest (scripts/media-manifest.ts),
 * so this works identically on every hosting platform.
 */

const files = new Set<string>(manifest.files);
const IMAGE_EXTENSIONS = ["webp", "avif", "jpg", "jpeg", "png"] as const;
const VIDEO_EXTENSIONS = ["mp4", "webm"] as const;

export function mediaExists(path: string): boolean {
  return files.has(path);
}

function findFile(base: string, exts: readonly string[]): string | null {
  for (const ext of exts) {
    const p = `${base}.${ext}`;
    if (files.has(p)) return p;
  }
  return null;
}

function resolve(folder: string, name: string, exts: readonly string[]): { src: string; isReal: boolean } | null {
  const real = findFile(`/media/${folder}/${name}`, exts);
  if (real) return { src: real, isReal: true };
  const demo = findFile(`/media/_demo/${folder}/${name}`, exts);
  if (demo) return { src: demo, isReal: false };
  return null;
}

export interface SpaceMedia {
  hero: MediaAsset | null;
  gallery: MediaAsset[];
  video: MediaAsset | null;
}

export function getSpaceMedia(folder: string, name: string): SpaceMedia {
  const hero = resolve(folder, "hero", IMAGE_EXTENSIONS);

  // Gallery: real images win as a set; otherwise demo images.
  const collect = (prefix: string, isReal: boolean): MediaAsset[] => {
    const out: MediaAsset[] = [];
    for (let i = 1; i <= 24; i++) {
      const src = findFile(`${prefix}/gallery-${String(i).padStart(2, "0")}`, IMAGE_EXTENSIONS);
      if (src) out.push({ src, alt: `${name} – ${isReal ? "Bild" : "Beispielbild"} ${i}`, isReal, width: 1600, height: 1067 });
    }
    return out;
  };
  const realGallery = collect(`/media/${folder}`, true);
  const gallery = realGallery.length > 0 ? realGallery : collect(`/media/_demo/${folder}`, false);

  const video = resolve(folder, "tour", VIDEO_EXTENSIONS);
  const poster = resolve(folder, "poster", IMAGE_EXTENSIONS) ?? hero;

  return {
    hero: hero
      ? { src: hero.src, alt: hero.isReal ? `${name} – Zur Krone Leidersbach` : `${name} – Beispielbild (Illustration)`, isReal: hero.isReal, width: 1600, height: 1067 }
      : null,
    gallery,
    video: video
      ? { src: video.src, alt: `${name} – ${video.isReal ? "Rundgang" : "Testvideo"}`, isReal: video.isReal, poster: poster?.src }
      : null,
  };
}

export function getPropertyGallery(): MediaAsset[] {
  const real = manifest.files.filter((f) => /^\/media\/property\/gallery-\d+\.(webp|avif|jpe?g|png)$/.test(f));
  if (real.length) return real.map((src, i) => ({ src, alt: `Zur Krone – Impression ${i + 1}`, isReal: true, width: 1600, height: 1067 }));
  return manifest.files
    .filter((f) => /^\/media\/_demo\/property\/gallery-\d+\.(webp|avif|jpe?g|png)$/.test(f))
    .map((src, i) => ({ src, alt: `Zur Krone – Beispielbild ${i + 1}`, isReal: false, width: 1600, height: 1067 }));
}

export interface HeroVideoSources {
  mp4: string | null;
  webm: string | null;
  poster: string | null;
  isReal: boolean;
}

export function getHeroVideo(): HeroVideoSources {
  const mp4 = findFile("/media/hero/krone-property-tour", ["mp4"]);
  const webm = findFile("/media/hero/krone-property-tour", ["webm"]);
  const poster = findFile("/media/hero/poster", IMAGE_EXTENSIONS);
  if (mp4 || webm) return { mp4, webm, poster, isReal: true };
  return {
    mp4: findFile("/media/_demo/hero/krone-property-tour", ["mp4"]),
    webm: findFile("/media/_demo/hero/krone-property-tour", ["webm"]),
    poster: poster ?? findFile("/media/_demo/hero/poster", IMAGE_EXTENSIONS),
    isReal: false,
  };
}
