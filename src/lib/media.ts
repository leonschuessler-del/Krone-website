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

/**
 * Descriptive alt texts for the real photos (WCAG 1.1.1), keyed by path without extension.
 * Written from what each picture actually shows – no claims beyond the image.
 * Missing entries fall back to a generic "<Raum> – Bild n".
 */
export const MEDIA_ALT: Readonly<Record<string, string>> = {
  // Das Haus
  "/media/property/gallery-01": "Die Krone von vorn aus der Luft: Hausfront mit Schriftzug „Zur Krone“ und Hofeinfahrt",
  "/media/property/gallery-02": "Gaststube mit gestreiften Polsterbänken, Holztischen und Holzbalkendecke",
  "/media/property/gallery-03": "Wintergarten mit Glasdach und Korbstühlen, durch die offene Tür der Blick in den Biergarten",
  "/media/property/gallery-04": "Saal unter dem Schild „Die Jäger“ mit langen Tafeln, blau-weiß gefalteten Servietten und Kachelofen",
  "/media/property/gallery-05": "Festlich gedeckter runder Hochzeitstisch mit Schriftzug „Mr & Mrs“, Kerzen und Grün",
  "/media/property/gallery-06": "Gästezimmer mit Doppelbett, Nachttischen und Schreibtisch unter der Dachschräge",
  // Restaurant
  "/media/restaurant/hero": "Gaststube mit Theke, Steinsäule, gestreiften Polsterbänken und gedeckten Holztischen",
  "/media/restaurant/gallery-01": "Lange, weiß eingedeckte Tafel entlang der Polsterbank unter dem Wandspruch „etwas Gutes“",
  "/media/restaurant/gallery-02": "Theke aus hellem Holz mit Gläserregal, davor Tische mit Polsterbank",
  "/media/restaurant/gallery-03": "Sitzecke mit Polsterbänken, Holzstühlen und Natursteinwand, Boden aus Terrakottafliesen",
  "/media/restaurant/gallery-04": "Blick auf Theke und Ausgabe der Gaststube mit hellen Holzschränken",
  "/media/restaurant/gallery-05": "Holzschränke und Türen am Gastraum, rechts gedeckte Tische und historische Fotowand",
  "/media/restaurant/gallery-06": "Tische mit Polsterbank vor der Theke, an der Wand der Spruch „etwas Gutes“",
  // Nebenzimmer
  "/media/side-room/hero": "Nebenzimmer mit drei langen, festlich eingedeckten Tafeln und Holzbalkendecke",
  "/media/side-room/gallery-01": "Lange Holztafel vor dem weißen Kachelofen, dahinter die Sitzecke mit karierten Sesseln",
  "/media/side-room/gallery-02": "Sitzecke mit karierten Sesseln und Holztisch neben dem Kachelofen",
  "/media/side-room/gallery-03": "Lange Tafeln vor der großen Holz-Schiebewand mit Glasfeldern",
  "/media/side-room/gallery-04": "Hochzeitstafel mit weißen Tischdecken, Servietten und Blumen, im Hintergrund Ballons",
  // Bühne
  "/media/stage/hero": "Raum mit Fensterfront, Holzstühlen, karierten Sesseln und Grünpflanzen auf den Tischen",
  "/media/stage/gallery-01": "Erhöhter Bereich unter dem Schild „Die Jäger“, davor lange Tafeln mit blau-weißen Servietten",
  "/media/stage/gallery-02": "Runde, festlich gedeckte Tische mit rosa Servietten, dahinter die Bühne mit Band-Banner",
  "/media/stage/gallery-03": "Durchgang mit karierten Sesseln und langen Holztafeln",
  "/media/stage/gallery-05": "Festtafel mit Blumen und Kerzen, im Hintergrund runde Tische und die Bühne",
  // Wintergarten
  "/media/winter-garden/hero": "Wintergarten mit Glasdach, weiß gedeckter Tafel und Korbstühlen, draußen der Biergarten",
  "/media/winter-garden/gallery-01": "Sonniger Wintergarten mit Holz-Glastüren, Glasdach und Korbstühlen",
  "/media/winter-garden/gallery-02": "Tisch mit Korbstühlen vor der Holz-Glastür des Wintergartens",
  "/media/winter-garden/gallery-03": "Offene Tür vom Wintergarten zum Hof mit Sandsteinmauer",
  "/media/winter-garden/gallery-04": "Wintergarten mit Glasdach, Holzbalken und langer Tafel",
  "/media/winter-garden/gallery-05": "Gedeckte Tische mit Korbstühlen und Sonnenblume, durch die Tür der Biergarten",
  // Biergarten
  "/media/beer-garden/hero": "Lange Tafel mit Lavendel und grünen Sitzkissen unter Weinlaub vor der Sandsteinmauer",
  "/media/beer-garden/gallery-01": "Gedeckte Tische mit grünen Sitzkissen im Schatten, hinten die geschwungene Sandsteinmauer",
  "/media/beer-garden/gallery-02": "Tischdekoration mit Lavendel, Windlicht und grünen Servietten vor der Hauswand",
  "/media/beer-garden/gallery-03": "Eingedeckte Tafel mit Lavendeltopf und grünen Servietten von oben",
  "/media/beer-garden/gallery-04": "Biergarten unter Weinlaub und Pergola mit Holztischen und Sonnenschirm",
  // Küche
  "/media/kitchen/hero": "Profiküche aus Edelstahl mit Herdblock, Abzugshaube und hängenden Kellen",
  "/media/kitchen/gallery-01": "Herdblock aus Edelstahl mit Pfannen, dahinter Regale und Arbeitsflächen",
  "/media/kitchen/gallery-02": "Kombidämpfer und Edelstahl-Arbeitsflächen vor den Küchenfenstern",
  // Alte Wirtschaft
  "/media/old-tavern/hero": "Alte Wirtschaft mit Holzdielen, Eckbank, Holztischen und kleiner Theke mit Fass",
  "/media/old-tavern/gallery-01": "Holztische und Stühle in der Alten Wirtschaft, hinten die Theke mit Zapffass",
  // Übernachten
  "/media/hotel/hero": "Gästezimmer mit Doppelbett, Nachttischen und Schreibtisch unter der Dachschräge",
  "/media/hotel/gallery-01": "Doppelzimmer mit Holzbett, Wandleuchten und Vorhängen",
  "/media/hotel/gallery-02": "Zimmer mit Bett, kleinem Tisch, Sessel und Fernseher",
  "/media/hotel/gallery-03": "Zimmer mit Einzelbett, Sessel, Schreibtisch und rundem Tisch",
  "/media/hotel/gallery-04": "Sitzecke mit dunklem Sofa, Holztisch und Fernseher",
  "/media/hotel/gallery-05": "Treppenhaus mit schmiedeeisernem Geländer und Kugelleuchte",
  "/media/hotel/gallery-06": "Badezimmer mit Dusche und Waschbecken",
};

/** Gallery files that are another rendition of the folder's hero – skipped so a gallery never shows the same picture twice. */
const HERO_DUPLICATES = new Set<string>(["/media/side-room/gallery-05"]);

/** Descriptive alt text for a real photo, otherwise the given fallback. */
export function mediaAlt(src: string, fallback: string): string {
  return MEDIA_ALT[src.replace(/\.[a-z0-9]+$/i, "")] ?? fallback;
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
      if (src && !HERO_DUPLICATES.has(src.replace(/\.[a-z0-9]+$/i, ""))) out.push({ src, alt: isReal ? mediaAlt(src, `${name} – Bild ${i}`) : `${name} – Beispielbild ${i}`, isReal, width: 1600, height: 1067 });
    }
    return out;
  };
  const realGallery = collect(`/media/${folder}`, true);
  const gallery = realGallery.length > 0 ? realGallery : collect(`/media/_demo/${folder}`, false);

  const video = resolve(folder, "tour", VIDEO_EXTENSIONS);
  const poster = resolve(folder, "poster", IMAGE_EXTENSIONS) ?? hero;

  return {
    hero: hero
      ? { src: hero.src, alt: hero.isReal ? mediaAlt(hero.src, `${name} – Zur Krone Leidersbach`) : `${name} – Beispielbild (Illustration)`, isReal: hero.isReal, width: 1600, height: 1067 }
      : null,
    gallery,
    video: video
      ? { src: video.src, alt: `${name} – ${video.isReal ? "Rundgang" : "Testvideo"}`, isReal: video.isReal, poster: poster?.src }
      : null,
  };
}

export function getPropertyGallery(): MediaAsset[] {
  const real = manifest.files.filter((f) => /^\/media\/property\/gallery-\d+\.(webp|avif|jpe?g|png)$/.test(f));
  if (real.length) return real.map((src, i) => ({ src, alt: mediaAlt(src, `Zur Krone – Impression ${i + 1}`), isReal: true, width: 1600, height: 1067 }));
  return manifest.files
    .filter((f) => /^\/media\/_demo\/property\/gallery-\d+\.(webp|avif|jpe?g|png)$/.test(f))
    .map((src, i) => ({ src, alt: `Zur Krone – Beispielbild ${i + 1}`, isReal: false, width: 1600, height: 1067 }));
}

export interface HeroVideoSources {
  mp4: string | null;
  /** Smaller rendition (1280×720) for narrow viewports; null when not available. */
  mp4Small: string | null;
  webm: string | null;
  poster: string | null;
  isReal: boolean;
}

export function getHeroVideo(): HeroVideoSources {
  const poster = findFile("/media/hero/poster", IMAGE_EXTENSIONS);
  // Image film (tools/media/film_cut.py) wins over the older approach-only clip.
  const film = findFile("/media/hero/krone-film", ["mp4"]);
  if (film) {
    return {
      mp4: film,
      mp4Small: findFile("/media/hero/krone-film-720", ["mp4"]),
      webm: findFile("/media/hero/krone-film", ["webm"]),
      poster,
      isReal: true,
    };
  }
  const mp4 = findFile("/media/hero/krone-property-tour", ["mp4"]);
  const webm = findFile("/media/hero/krone-property-tour", ["webm"]);
  if (mp4 || webm) return { mp4, mp4Small: null, webm, poster, isReal: true };
  return {
    mp4: findFile("/media/_demo/hero/krone-property-tour", ["mp4"]),
    mp4Small: null,
    webm: findFile("/media/_demo/hero/krone-property-tour", ["webm"]),
    poster: poster ?? findFile("/media/_demo/hero/poster", IMAGE_EXTENSIONS),
    isReal: false,
  };
}
