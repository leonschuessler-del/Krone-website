/**
 * Embeds the site's own web fonts (installed via @fontsource) as base64
 * @font-face rules, so rendering works offline and matches the website.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const FILES: Array<{ family: string; weight: string; style: string; file: string }> = [
  { family: "Cormorant Garamond", weight: "500", style: "normal", file: "node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2" },
  { family: "Cormorant Garamond", weight: "600", style: "normal", file: "node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2" },
  { family: "Cormorant Garamond", weight: "500", style: "italic", file: "node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff2" },
  { family: "Source Sans 3", weight: "200 900", style: "normal", file: "node_modules/@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2" },
];

let cached: string | null = null;

export function fontFaceCss(): string {
  if (cached !== null) return cached;
  const rules: string[] = [];
  for (const f of FILES) {
    const p = join(root, f.file);
    if (!existsSync(p)) {
      console.warn(`[demo-media] font missing, falling back to Georgia/system: ${f.file}`);
      continue;
    }
    const b64 = readFileSync(p).toString("base64");
    rules.push(
      `@font-face{font-family:"${f.family}";font-style:${f.style};font-weight:${f.weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format("woff2");}`,
    );
  }
  cached = rules.join("\n");
  return cached;
}

export const SERIF = `"Cormorant Garamond", Georgia, "Times New Roman", serif`;
export const SANS = `"Source Sans 3", "Segoe UI", Arial, sans-serif`;
