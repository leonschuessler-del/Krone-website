// Builds the static preview of the event-location website from a running
// production server: one self-contained HTML file per public page (start =
// Eventlocation, Räume, Galerie, FAQ, Kontakt). The pages share the runtime
// bundle that drives the scroll tour, the planner, the request dialog (requests
// only – no prices, no payment), the map and the legal layers.
// Hotel, offers and sights are archived (see ARCHIV.md) and not part of the
// preview; links to them go to the start page or to the operator's main site.
// usage: node build-snapshot.mjs <baseUrl> [outDir]
import { chromium } from "playwright";
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? "http://localhost:3200";
const OUT_DIR = process.argv[3] ?? path.join(here, "..", "dist-snapshot");
fs.mkdirSync(OUT_DIR, { recursive: true });
const ROOT = path.resolve(here, "../../..");

// Event-only scope (10/2026). /buchen (React wizard) and /bereiche/<slug> are not
// snapshotted: their links open the runtime's request dialog / room dialog instead.
const ROUTES = [
  { path: "/", file: "index.html", title: "Eventlocation Zur Krone · Leidersbach" },
  { path: "/bereiche", file: "bereiche.html", title: "Räume · Eventlocation Zur Krone" },
  { path: "/galerie", file: "galerie.html", title: "Galerie · Eventlocation Zur Krone" },
  { path: "/faq", file: "faq.html", title: "Häufige Fragen · Eventlocation Zur Krone" },
  { path: "/kontakt", file: "kontakt.html", title: "Kontakt · Eventlocation Zur Krone" },
];
/** Archived pages (not routed any more) → where their old links go in the preview. */
const ARCHIVED = { "/aktuelles": "index.html", "/sehenswuerdigkeiten": "index.html#kontakt", "/eventlocation": "index.html" };

// 1) runtime bundle (real tour timeline + config + domain logic)
const bundle = await build({
  entryPoints: [path.join(here, "runtime.ts")],
  bundle: true,
  format: "iife",
  minify: true,
  write: false,
  target: "es2020",
  jsx: "automatic",
  // browser bundle: no Node `process` – site config falls back to the public domain
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_SITE_URL": '"https://krone-landhotel.de"',
    // same main-site URL as the server build (src/config/scope.ts falls back to its default)
    ...(process.env.NEXT_PUBLIC_MAIN_SITE_URL ? { "process.env.NEXT_PUBLIC_MAIN_SITE_URL": JSON.stringify(process.env.NEXT_PUBLIC_MAIN_SITE_URL) } : {}),
    "process.env": "{}",
    "process.emit": "undefined",
  },
  tsconfig: path.join(ROOT, "tsconfig.json"),
  absWorkingDir: ROOT,
});
const runtimeJs = bundle.outputFiles[0].text;
const previewCss = fs.readFileSync(path.join(ROOT, "node_modules/leaflet/dist/leaflet.css"), "utf8").replace(/url\(images\/[^)]+\)/g, "none") + "\n" + fs.readFileSync(path.join(here, "preview.css"), "utf8");

// 2) data
const spacesRes = await fetch(new URL("/api/spaces", BASE));
if (!spacesRes.ok) throw new Error(`${spacesRes.status} /api/spaces`);
const { spaces: apiSpaces } = await spacesRes.json();
const spaces = [];
for (const s of apiSpaces) {
  const srcs = [s.media?.hero?.src, ...(s.media?.gallery ?? []).map((g) => g.src)].filter(Boolean);
  const unique = [...new Set(srcs)];
  spaces.push({
    id: s.id,
    slug: s.slug,
    code: s.code,
    name: s.name,
    type: s.type,
    level: s.level,
    features: s.features ?? [],
    setupBufferMinutes: s.setupBufferMinutes ?? null,
    cleanupBufferMinutes: s.cleanupBufferMinutes ?? null,
    shortDescription: s.shortDescription,
    longDescription: s.longDescription,
    areaSqm: s.areaSqm,
    capacitySeated: s.capacitySeated,
    capacityStanding: s.capacityStanding,
    bookable: s.bookable,
    includedInFullVenue: s.includedInFullVenue,
    requires: s.requires ?? [],
    // no price fields: the preview only takes requests ("Preis auf Anfrage")
    images: unique.map((u) => (u.startsWith("/") ? u.slice(1) : u)),
    shape: s.shape,
  });
}

// content modules the pages need (same config the site uses)
const contentMod = await build({
  stdin: { contents: `export { HOTEL_COORDS } from "@/content/sights"; export { extraSeeds } from "@/content/extras"; export { siteScope } from "@/config/scope";`, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
  tsconfig: path.join(ROOT, "tsconfig.json"),
  absWorkingDir: ROOT,
});
const tmpMod = path.join(OUT_DIR, ".content.mjs");
fs.writeFileSync(tmpMod, contentMod.outputFiles[0].text);
const { HOTEL_COORDS, extraSeeds, siteScope } = await import(tmpMod + `?t=${Date.now()}`);
// add-ons for the request dialog: name and description only – the amounts stay out of the page
const extras = extraSeeds.map((e) => ({ id: e.id, name: e.name, description: e.description }));
const mainSiteUrl = siteScope.mainSiteUrl;

// 3) snapshot the rendered pages
const browser = await chromium.launch();
const legal = {};
{
  const lp = await browser.newPage();
  for (const slug of ["impressum", "datenschutz", "agb", "mietbedingungen", "hausordnung"]) {
    await lp.goto(`${BASE}/${slug}`, { waitUntil: "load" });
    legal[slug] = await lp.evaluate(() => {
      const h1 = document.querySelector("main h1, h1");
      const root = h1.parentElement;
      const parts = [h1.outerHTML, ...[...root.children].filter((el) => el !== h1 && !el.matches("nav")).map((el) => el.outerHTML)];
      return { title: h1.textContent.trim(), html: parts.join("") };
    });
  }
  await lp.close();
}

async function snapshotRoute(route) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(BASE + route.path, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const headerTop = await page.evaluate(() => document.querySelector("header").outerHTML);
  await page.evaluate(() => window.scrollTo({ top: Math.max(1600, (document.getElementById("karte")?.offsetTop ?? 0)), behavior: "instant" }));
  await page.waitForTimeout(800);
  const headerScrolled = await page.evaluate(() => document.querySelector("header").outerHTML);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(1200);

  const result = await page.evaluate(
    async ({ spaces, headerTop, headerScrolled, route, routes, archived, mainSiteUrl }) => {
      const cache = new Map();
      const dataUrl = (url) => {
        if (!cache.has(url)) {
          cache.set(
            url,
            fetch(url)
              .then((r) => { if (!r.ok) throw new Error("fetch " + r.status + " " + url); return r.blob(); })
              .catch((e) => { throw new Error("dataUrl failed for " + url + ": " + e.message); })
              .then(
                (b) =>
                  new Promise((res) => {
                    const fr = new FileReader();
                    fr.onload = () => res(fr.result);
                    fr.readAsDataURL(b);
                  }),
              ),
          );
        }
        return cache.get(url);
      };
      const original = (src) => {
        if (src.startsWith("/_next/image")) return new URL(src, location.origin).searchParams.get("url");
        return src;
      };
      const inlineCssUrls = async (css, baseUrl) => {
        const urls = [...css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)].map((m) => m[2]).filter((u) => !u.startsWith("data:"));
        for (const u of new Set(urls)) {
          const abs = new URL(u, baseUrl).href;
          css = css.split(u).join(await dataUrl(abs));
        }
        return css;
      };
      const byName = new Map(spaces.map((s) => [s.name, s]));
      const fileOf = (p) => routes.find((r) => r.path === p)?.file ?? null;

      /** site URL → preview URL (+ data attributes for the runtime) */
      const rewrite = (a) => {
        const h = a.getAttribute("href");
        if (!h || h.startsWith("#") || /^(mailto|tel|https?):/.test(h)) return;
        const [pathPart, hash = ""] = h.split("#");
        const [p, query = ""] = pathPart.split("?");
        const hashPart = hash ? "#" + hash : "";
        const queryPart = query ? "?" + query : "";
        let target = null;
        let m;
        if (fileOf(p || "/")) target = fileOf(p || "/") + queryPart + hashPart;
        else if (archived[p]) target = archived[p].includes("#") || !hashPart ? archived[p] : archived[p] + hashPart;
        else if (/^\/hotel(\/|$)/.test(p)) {
          // hotel & rooms live on the operator's main site
          a.setAttribute("href", mainSiteUrl);
          return;
        } else if (p === "/bereiche/hotel") target = "index.html#hotel"; // the whole floor is an event add-on
        else if ((m = p.match(/^\/bereiche\/([\w-]+)/))) {
          // room page → room dialog of the runtime (href = fallback without JS)
          target = "index.html#bereiche";
          a.dataset.room = m[1];
        } else if (p.startsWith("/buchen")) {
          // booking wizard → request dialog of the runtime (same rooms preselected)
          target = "index.html#karte";
          a.dataset.flow = "";
          const pre = new URLSearchParams(query).get("spaces");
          if (pre) a.dataset.flowSpaces = pre;
        } else if ((m = p.match(/^\/(impressum|datenschutz|agb|mietbedingungen|hausordnung)$/))) {
          a.setAttribute("href", "#");
          a.dataset.legal = m[1];
          return;
        } else {
          a.setAttribute("href", "#");
          a.dataset.page = a.textContent.trim() || "Diese Seite";
          return;
        }
        // same page → stay in the page (hash only)
        if (target.startsWith(route.file)) target = target.slice(route.file.length) || "#";
        a.setAttribute("href", target);
      };

      async function processTree(root) {
        root.querySelectorAll("a[href]").forEach(rewrite);
        root.querySelectorAll('button[aria-label="Menü öffnen"]').forEach((b) => b.setAttribute("data-pv-menu", ""));
        // select buttons (tour captions, space cards)
        root.querySelectorAll("button[aria-pressed][aria-label$=' auswählen']:not([data-toggle-space])").forEach((b) => {
          const name = b.getAttribute("aria-label").replace(/ auswählen$/, "");
          const s = byName.get(name);
          if (!s) return;
          b.dataset.selectSpace = s.id;
          const text = [...b.childNodes].reverse().find((n) => n.nodeType === 3 && n.textContent.trim());
          if (text) {
            const span = document.createElement("span");
            span.dataset.pvLabel = "";
            span.textContent = text.textContent;
            text.replaceWith(span);
          }
        });
        for (const src of root.querySelectorAll("source[srcset]")) {
          const v = src.getAttribute("srcset");
          if (v.startsWith("/media/")) src.setAttribute("srcset", v.slice(1));
        }
        for (const img of root.querySelectorAll("img")) {
          const src = img.getAttribute("src");
          if (!src || src.startsWith("data:")) continue;
          const o = original(src);
          // site media and brand files are published next to the page → relative path; anything else inline
          img.setAttribute("src", o.startsWith("/media/") || o.startsWith("/map/") || o.startsWith("/brand/") ? o.slice(1) : await dataUrl(o));
          img.removeAttribute("srcset");
          img.removeAttribute("sizes");
          img.removeAttribute("loading");
          img.removeAttribute("fetchpriority");
        }
        // the logo mark is an external <use> reference (public/brand/logo-mark.svg) → relative next to the page
        for (const u of root.querySelectorAll("use[href^='/brand/'], use[href^='/media/']")) {
          u.setAttribute("href", u.getAttribute("href").slice(1));
        }
        for (const v of root.querySelectorAll("video")) {
          v.querySelectorAll("source").forEach((s) => {
            let src = s.getAttribute("src") ?? "";
            // the artifact keeps binaries ≤ 15 MB → the preview plays the 720p rendition of the hero film
            if (src === "/media/hero/krone-film.mp4") src = "/media/hero/krone-film-720.mp4";
            if (src.startsWith("/media/")) s.setAttribute("src", src.slice(1));
            else s.remove();
          });
          const src = v.getAttribute("src");
          if (src) v.setAttribute("src", src.startsWith("/media/") ? src.slice(1) : "");
          v.setAttribute("preload", "metadata");
          v.setAttribute("autoplay", "");
          const poster = v.getAttribute("poster");
          if (poster) v.setAttribute("poster", poster.startsWith("/media/") ? poster.slice(1) : await dataUrl(poster));
        }
        for (const el of root.querySelectorAll("[style*='url(']")) {
          el.setAttribute("style", await inlineCssUrls(el.getAttribute("style"), location.href));
        }
      }

      const doc = document.documentElement.cloneNode(true);
      doc.querySelectorAll("script:not([type='application/ld+json']), link[rel=preload], link[rel=modulepreload], link[rel=prefetch], next-route-announcer, nextjs-portal").forEach((el) => el.remove());
      for (const link of doc.querySelectorAll("link[rel=stylesheet]")) {
        const href = new URL(link.getAttribute("href"), location.href).href;
        const css = await (await fetch(href)).text();
        const style = document.createElement("style");
        style.textContent = await inlineCssUrls(css, href);
        link.replaceWith(style);
      }
      for (const style of doc.querySelectorAll("style")) {
        if (style.textContent.includes("url(")) style.textContent = await inlineCssUrls(style.textContent, location.href);
      }
      doc.querySelectorAll("link[rel~=icon], link[rel=apple-touch-icon], link[rel=manifest]").forEach((el) => el.remove());

      // --- tour (start page): markup is driven by the shared tour player; reset the state captured at scroll 0
      const section = doc.querySelector("#rundgang");
      if (section) section.querySelectorAll("[data-tour-poster]").forEach((img) => (img.style.visibility = ""));

      // --- map / configurator
      const karte = doc.querySelector("#karte [data-testid=site-map]")?.closest("#karte");
      if (karte) {
        const count = karte.querySelector("[data-testid=selection-count]");
        const hint = count?.nextElementSibling;
        if (hint) {
          hint.setAttribute("data-pv-hint", "");
          hint.insertAdjacentHTML("afterend", '<ul data-pv-list class="pv-list" hidden></ul>');
        }
        karte.querySelectorAll("button").forEach((b) => {
          const text = b.textContent.trim();
          if (b.dataset.selectSpace) return;
          if (b.dataset.testid === "hotel-toggle") b.setAttribute("data-hotel-toggle", "");
          else if (text.startsWith("Gesamte Location")) b.setAttribute("data-full-venue", "");
          else if (b.dataset.testid === "panel-primary") b.setAttribute("data-flow", "");
          else if (/^Datum (aus)?wählen$/.test(text) || text === "Termin wählen") {
            b.setAttribute("data-flow", "");
            b.dataset.flowAt = "date";
          } else if (text === "Liste") b.setAttribute("data-area-list", "");
          else if (text === "Vergrößern") b.setAttribute("data-map-zoom", "");
          else if (text === "Zurücksetzen") b.setAttribute("data-pv-reset", "");
          else if (b.hasAttribute("aria-pressed")) {
            const s = spaces.find((x) => text.endsWith(x.name));
            if (s) b.dataset.toggleSpace = s.id;
          }
        });
        const bar = karte.querySelector(".fixed.bottom-0");
        if (bar) {
          bar.setAttribute("data-pv-mobilebar", "");
          const [sheetBtn, cta] = bar.querySelectorAll("button");
          sheetBtn?.setAttribute("data-pv-sheet", "");
          sheetBtn?.querySelector("span span")?.setAttribute("data-pv-mobile-count", "");
          if (cta) {
            cta.setAttribute("data-pv-mobile-cta", "");
            cta.setAttribute("data-flow", "");
          }
        }
      }

      // (the hotel booking engine and the hotel booking bar are archived – not part of the event site)
      // --- contact form → preview confirmation
      doc.querySelectorAll("main form").forEach((f) => f.setAttribute("data-pv-contact", ""));
      // --- map consent → runtime loads Leaflet (the house only)
      doc.querySelectorAll("[data-testid=map]").forEach((m) => {
        m.setAttribute("data-pv-map", "hotel");
        m.className = m.className.replace(/\bleaflet-[\w-]+/g, "").replace(/\s+/g, " ").trim();
        m.replaceChildren();
      });
      // gallery lightbox
      doc.querySelectorAll("button[aria-label$='vergrößern']").forEach((b) => {
        const img = b.parentElement?.querySelector("img") ?? b.querySelector("img");
        if (img) b.dataset.lightbox = original(img.getAttribute("src"));
      });

      await processTree(doc);
      for (const b of doc.querySelectorAll("[data-lightbox]")) {
        const lb = b.dataset.lightbox;
        if (lb.startsWith("/media/")) b.dataset.lightbox = lb.slice(1);
        else if (!lb.startsWith("data:")) b.dataset.lightbox = await dataUrl(lb);
      }
      const headers = [];
      for (const h of [headerTop, headerScrolled]) {
        const tpl = document.createElement("template");
        tpl.innerHTML = h;
        await processTree(tpl.content);
        headers.push(tpl.innerHTML);
      }
      doc.querySelectorAll("script[type='application/ld+json']").forEach((s) => s.remove());
      const head = doc.querySelector("head");
      const body = doc.querySelector("body");
      return {
        htmlClass: doc.className,
        bodyClass: body.className,
        styles: [...head.querySelectorAll("style")].map((s) => s.outerHTML).join("\n"),
        bodyHtml: body.innerHTML,
        headers,
      };
    },
    { spaces, headerTop, headerScrolled, route, routes: ROUTES.map((r) => ({ path: r.path, file: r.file })), archived: ARCHIVED, mainSiteUrl },
  );
  await page.close();
  return result;
}

const pill = `<div class="pv-pill" aria-hidden="true">Vorschau · Demo-Inhalte</div>`;
const written = [];
/** Anything that looks like an amount of money or a discount must not reach the page (siteScope.showPrices === false). */
const PRICE_PATTERNS = [/€/, /\bEUR\b/, /\d[\d.,]*\s?(?:Euro|%)/i, /\bab\s+\d[\d.,]*\s?(?:€|Euro)/i, /currency/i];
const priceHits = [];
const scanPrices = (label, text) => {
  // only visible text and data: drop tags/attributes of the markup, keep the payload JSON as is
  for (const re of PRICE_PATTERNS) {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    for (const m of text.matchAll(g)) {
      priceHits.push(`${label}: …${text.slice(Math.max(0, m.index - 50), m.index + 30).replace(/\s+/g, " ")}…`);
      if (priceHits.length > 40) return;
    }
  }
};
const visibleText = (html) => html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
const ONLY = process.env.SNAPSHOT_ONLY?.split(",").filter(Boolean);
for (const route of ROUTES) {
  if (ONLY?.length && !ONLY.includes(route.file)) continue;
  const result = await snapshotRoute(route);
  const payload = {
    page: route.file,
    spaces: spaces.map(({ shape: _shape, ...s }) => s),
    extras,
    mainSiteUrl,
    headerTop: result.headers[0],
    headerScrolled: result.headers[1],
    legal,
    hotelCoords: HOTEL_COORDS,
  };
  if (!siteScope.showPrices) {
    scanPrices(route.file, visibleText(result.bodyHtml + result.headers.join("")));
    scanPrices(`${route.file} (Daten)`, JSON.stringify({ ...payload, legal: undefined, headerTop: undefined, headerScrolled: undefined }));
    if (route.file === "index.html") for (const [slug, l] of Object.entries(legal)) scanPrices(`Rechtstext ${slug}`, visibleText(l.html));
  }
  const scripts =
    `<script>window.__PREVIEW__=${JSON.stringify(payload).replace(/</g, "\\u003c")};</script>` +
    `<script>${runtimeJs.replace(/<\/script/gi, "<\\/script")}</script>`;
  const rootClasses = `<script>(function(){var d=document.documentElement;d.lang="de";d.className+=" ${result.htmlClass}";document.body.className+=" ${result.bodyClass}";})();</script>`;
  // (a) page content for the artifact viewer (it adds doctype/head/body itself) – start page only
  const content = [`<title>${route.title}</title>`, `<meta name="robots" content="noindex">`, rootClasses, result.styles, `<style>${previewCss}</style>`, result.bodyHtml, pill, scripts].join("\n");
  // (b) complete standalone document
  const full = `<!DOCTYPE html><html lang="de" class="${result.htmlClass}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>${route.title}</title><meta name="robots" content="noindex">${result.styles}<style>${previewCss}</style></head><body class="${result.bodyClass}">${result.bodyHtml}${pill}${scripts}</body></html>`;
  fs.writeFileSync(path.join(OUT_DIR, route.file), full);
  fs.mkdirSync(path.join(OUT_DIR, "artifact"), { recursive: true });
  if (route.file === "index.html") {
    fs.writeFileSync(path.join(OUT_DIR, "artifact", "zur-krone-vorschau.html"), content);
    fs.writeFileSync(path.join(OUT_DIR, "krone-vorschau.html"), full);
    fs.writeFileSync(path.join(OUT_DIR, "parts.json"), JSON.stringify({ title: route.title, rootClasses, styles: result.styles, previewCss, bodyHtml: result.bodyHtml, pill, scripts }));
  } else fs.writeFileSync(path.join(OUT_DIR, "artifact", route.file), full);
  written.push(`${route.file} ${(full.length / 1024 / 1024).toFixed(2)} MB`);
}
await browser.close();
fs.rmSync(tmpMod, { force: true });
// pages of earlier builds that are no longer part of the site (hotel, offers, sights …) must not be
// published by mistake → moved aside (not deleted) into _alt/
if (!ONLY?.length) {
  const keep = new Set([...ROUTES.map((r) => r.file), "krone-vorschau.html", "zur-krone-vorschau.html"]);
  for (const dir of [OUT_DIR, path.join(OUT_DIR, "artifact")]) {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".html") || keep.has(f)) continue;
      const aside = path.join(dir, "_alt");
      fs.mkdirSync(aside, { recursive: true });
      fs.renameSync(path.join(dir, f), path.join(aside, f));
      console.log("moved stale", path.relative(OUT_DIR, path.join(dir, f)), "→ _alt/");
    }
  }
}
console.log("wrote", written.join(", "), "→", OUT_DIR);
if (priceHits.length) {
  // files are written so they can be inspected – but the build is marked as failed
  console.error(`\nPreis-Prüfung: ${priceHits.length} Stelle(n) mit Betrag/Prozent gefunden (siteScope.showPrices = false):`);
  for (const h of priceHits) console.error("  - " + h);
  if (!process.env.SNAPSHOT_ALLOW_PRICES) process.exitCode = 1;
}
