// Builds the static preview of the website from a running production server:
// one self-contained HTML file per top-level page (start, hotel, eventlocation,
// umgebung, aktuelles, kontakt). The pages share the runtime bundle that
// drives the scroll tour, the planner, the request and hotel dialogs, the map
// consent and the legal layers.
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

const ROUTES = [
  { path: "/", file: "index.html", title: "Zur Krone – Landhotel Leidersbach", map: "home" },
  { path: "/hotel", file: "hotel.html", title: "Hotel & Zimmer · Zur Krone" },
  { path: "/eventlocation", file: "eventlocation.html", title: "Eventlocation · Zur Krone", tour: true },
  { path: "/sehenswuerdigkeiten", file: "umgebung.html", title: "Umgebung · Zur Krone", map: "sights" },
  { path: "/aktuelles", file: "aktuelles.html", title: "Aktuelles & Angebote · Zur Krone" },
  { path: "/kontakt", file: "kontakt.html", title: "Kontakt · Zur Krone", map: "hotel" },
  { path: "/galerie", file: "galerie.html", title: "Galerie · Zur Krone" },
];

// 1) runtime bundle (real tour timeline + config + domain logic)
const bundle = await build({
  entryPoints: [path.join(here, "runtime.ts")],
  bundle: true,
  format: "iife",
  minify: true,
  write: false,
  target: "es2020",
  tsconfig: path.join(ROOT, "tsconfig.json"),
  absWorkingDir: ROOT,
});
const runtimeJs = bundle.outputFiles[0].text;
const previewCss = fs.readFileSync(path.join(ROOT, "node_modules/leaflet/dist/leaflet.css"), "utf8").replace(/url\(images\/[^)]+\)/g, "none") + "\n" + fs.readFileSync(path.join(here, "preview.css"), "utf8");

// 2) data
const toDataUrl = async (url) => {
  const res = await fetch(new URL(url, BASE));
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const type = res.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
  return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
};
void toDataUrl;
const { spaces: apiSpaces } = await (await fetch(new URL("/api/spaces", BASE))).json();
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
    basePrice: s.basePrice ?? null,
    priceModel: s.priceModel ?? null,
    cleaningFee: s.cleaningFee ?? null,
    images: unique.map((u) => (u.startsWith("/") ? u.slice(1) : u)),
    shape: s.shape,
  });
}

// content modules the pages need (same config the site uses)
const contentMod = await build({
  stdin: { contents: `export { tourConfig } from "@/config/tour"; export { sights, HOTEL_COORDS } from "@/content/sights";`, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
  tsconfig: path.join(ROOT, "tsconfig.json"),
  absWorkingDir: ROOT,
});
const tmpMod = path.join(OUT_DIR, ".content.mjs");
fs.writeFileSync(tmpMod, contentMod.outputFiles[0].text);
const { tourConfig, sights, HOTEL_COORDS } = await import(tmpMod + `?t=${Date.now()}`);
void tourConfig;

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

const fileFor = (p) => ROUTES.find((r) => r.path === p)?.file ?? null;

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
    async ({ spaces, headerTop, headerScrolled, route, routes }) => {
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
        const p = pathPart.split("?")[0];
        const hashPart = hash ? "#" + hash : "";
        let target = null;
        let m;
        if (fileOf(p || "/")) target = fileOf(p || "/") + hashPart;
        else if ((m = p.match(/^\/bereiche\/([\w-]+)/))) {
          target = "eventlocation.html#karte";
          a.dataset.room = m[1];
        } else if (p === "/bereiche") target = "eventlocation.html#bereiche";
        else if (p.startsWith("/faq")) target = "eventlocation.html#faq";
        else if (p.startsWith("/buchen")) {
          target = "eventlocation.html#karte";
          a.dataset.flow = "";
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
        for (const v of root.querySelectorAll("video")) {
          v.querySelectorAll("source").forEach((s) => {
            const src = s.getAttribute("src") ?? "";
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

      // --- tour (eventlocation): markup is driven by the shared tour player; reset the state captured at scroll 0
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

      // --- hotel booking widget (React) → one button that opens the runtime's hotel dialog
      doc.querySelectorAll("[data-testid=hotel-booking]").forEach((w) => {
        w.outerHTML = `<div class="pv-hotel-cta" data-testid="hotel-booking-cta">
          <button type="button" class="pv-btn pv-btn-gold pv-btn-lg" data-hotel-book>Zimmer buchen</button>
          <p class="pv-small">Vorschau: An- und Abreise im Kalender, Zimmerwahl, Extras und Anfrage öffnen sich hier als Dialog. Nichts wird versendet.</p>
        </div>`;
      });
      // --- booking bar (start page) → hotel page, dialog opens there
      doc.querySelectorAll("[data-testid=booking-bar]").forEach((f) => {
        f.setAttribute("action", "hotel.html");
        f.setAttribute("method", "get");
        f.setAttribute("data-pv-bookingbar", "");
      });
      // --- contact form → preview confirmation
      doc.querySelectorAll("main form:not([data-testid=booking-bar])").forEach((f) => f.setAttribute("data-pv-contact", ""));
      // --- map consent → runtime loads Leaflet
      doc.querySelectorAll("[data-testid=map]").forEach((m) => {
        m.setAttribute("data-pv-map", route.map ?? "hotel");
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
    { spaces, headerTop, headerScrolled, route, routes: ROUTES.map((r) => ({ path: r.path, file: r.file })) },
  );
  await page.close();
  return result;
}

const pill = `<div class="pv-pill" aria-hidden="true">Vorschau · Demo-Inhalte</div>`;
const written = [];
const ONLY = process.env.SNAPSHOT_ONLY?.split(",").filter(Boolean);
for (const route of ROUTES) {
  if (ONLY?.length && !ONLY.includes(route.file)) continue;
  const result = await snapshotRoute(route);
  const payload = {
    page: route.file,
    spaces: spaces.map(({ shape: _shape, ...s }) => s),
    headerTop: result.headers[0],
    headerScrolled: result.headers[1],
    legal,
    sights: sights.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, minutes: s.minutes })),
    hotelCoords: HOTEL_COORDS,
  };
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
console.log("wrote", written.join(", "), "→", OUT_DIR);
