// Builds a single self-contained HTML preview of the homepage (scroll tour,
// floor plan, sections) from a running production server.
// usage: node build-snapshot.mjs <baseUrl> [out.html] [liveUrl]
import { chromium } from "playwright";
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? "http://localhost:3200";
const OUT = process.argv[3] ?? path.join(here, "..", "dist-snapshot", "krone-vorschau.html");
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const LIVE = process.argv[4] ?? null;
const ROOT = path.resolve(here, "../../..");

// 1) runtime bundle (real tour timeline + config)
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
const previewCss = fs.readFileSync(path.join(here, "preview.css"), "utf8");

// 2) data
const toDataUrl = async (url) => {
  const res = await fetch(new URL(url, BASE));
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const type = res.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
  return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
};
const { spaces: apiSpaces } = await (await fetch(new URL("/api/spaces", BASE))).json();
const spaces = [];
for (const s of apiSpaces) {
  const srcs = [s.media?.hero?.src, ...(s.media?.gallery ?? []).map((g) => g.src)].filter(Boolean);
  const unique = [...new Set(srcs)].slice(0, 4);
  spaces.push({
    id: s.id,
    slug: s.slug,
    code: s.code,
    name: s.name,
    color: s.color,
    shortDescription: s.shortDescription,
    longDescription: s.longDescription,
    areaSqm: s.areaSqm,
    capacitySeated: s.capacitySeated,
    capacityStanding: s.capacityStanding,
    bookable: s.bookable,
    includedInFullVenue: s.includedInFullVenue,
    images: await Promise.all(unique.map(toDataUrl)),
    shape: s.shape,
  });
}

// chapters (same config the site uses)
const tourMod = await build({
  stdin: { contents: `export { tourConfig } from "@/config/tour";`, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
  tsconfig: path.join(ROOT, "tsconfig.json"),
  absWorkingDir: ROOT,
});
const tmpMod = path.join(path.dirname(OUT), ".tour-config.mjs");
fs.writeFileSync(tmpMod, tourMod.outputFiles[0].text);
const { tourConfig } = await import(tmpMod + `?t=${Date.now()}`);
const chapters = tourConfig.chapters.map((c) => ({ id: c.id, spaceId: c.spaceId }));
const polyChapters = chapters
  .map((c, i) => (c.spaceId && spaces.find((s) => s.id === c.spaceId)?.shape?.polygon ? i : -1))
  .filter((i) => i >= 0);

// 3) snapshot the rendered page
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(BASE + "/", { waitUntil: "load" });
await page.waitForTimeout(1500);
const headerTop = await page.evaluate(() => document.querySelector("header").outerHTML);
await page.evaluate(() => window.scrollTo({ top: document.getElementById("karte").offsetTop, behavior: "instant" }));
await page.waitForTimeout(800);
const headerScrolled = await page.evaluate(() => document.querySelector("header").outerHTML);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
await page.waitForTimeout(1200);

const result = await page.evaluate(
  async ({ chapters, polyChapters, spaces, headerTop, headerScrolled }) => {
    const cache = new Map();
    const dataUrl = (url) => {
      if (!cache.has(url)) {
        cache.set(
          url,
          fetch(url)
            .then((r) => r.blob())
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

    async function processTree(root) {
      // links
      root.querySelectorAll("a[href]").forEach((a) => {
        const h = a.getAttribute("href");
        if (h.startsWith("#") || /^(mailto|tel|https?):/.test(h)) return;
        let m;
        if (h === "/") a.setAttribute("href", "#");
        else if ((m = h.match(/^\/#(.+)$/))) a.setAttribute("href", "#" + m[1]);
        else if ((m = h.match(/^\/bereiche\/([\w-]+)/))) {
          a.setAttribute("href", "#karte");
          a.dataset.room = m[1];
        } else if (h === "/bereiche") a.setAttribute("href", "#bereiche");
        else if (h.startsWith("/galerie")) a.setAttribute("href", "#galerie");
        else if (h.startsWith("/kontakt")) a.setAttribute("href", "#kontakt");
        else if (h.startsWith("/faq")) a.setAttribute("href", "#faq");
        else if (h.startsWith("/buchen")) {
          a.setAttribute("href", "#buchen");
          a.dataset.live = "Buchung & Kalender";
          a.dataset.liveRoute = h;
        } else {
          a.setAttribute("href", "#");
          a.dataset.live = a.textContent.trim() || "Diese Seite";
          a.dataset.liveRoute = h;
        }
      });
      root.querySelectorAll('button[aria-label="Menü öffnen"]').forEach((b) => b.setAttribute("data-pv-menu", ""));
      // select buttons (tour captions, space cards)
      root.querySelectorAll("button[aria-pressed][aria-label$=' auswählen']").forEach((b) => {
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
      // images
      for (const img of root.querySelectorAll("img")) {
        const src = img.getAttribute("src");
        if (!src || src.startsWith("data:")) continue;
        img.setAttribute("src", await dataUrl(original(src)));
        img.removeAttribute("srcset");
        img.removeAttribute("sizes");
        img.removeAttribute("loading");
        img.removeAttribute("fetchpriority");
      }
      for (const v of root.querySelectorAll("video")) {
        v.querySelectorAll("source").forEach((s) => s.remove());
        v.removeAttribute("src");
        const poster = v.getAttribute("poster");
        if (poster) v.setAttribute("poster", await dataUrl(poster));
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

    // --- tour
    const section = doc.querySelector("#rundgang");
    const sticky = section.firstElementChild;
    const roomIdx = chapters.map((c, i) => (c.spaceId ? i : -1)).filter((i) => i >= 0);
    const layerEls = [...sticky.children].filter((el) => el.classList.contains("overflow-hidden") && el.classList.contains("bg-anthracite"));
    layerEls.forEach((el, j) => {
      const i = roomIdx[j];
      const s = spaces.find((x) => x.id === chapters[i].spaceId);
      el.dataset.tl = String(i);
      const inner = el.firstElementChild;
      const [a, b] = s?.images ?? [];
      if (inner && a) {
        inner.innerHTML =
          `<img src="${a}" alt="" class="absolute inset-0 h-full w-full object-cover">` +
          (b ? `<div data-ts="${i}" class="absolute inset-0" style="opacity:0"><img src="${b}" alt="" class="absolute inset-0 h-full w-full object-cover"></div>` : "");
      }
    });
    const cap0 = section.querySelector("h1").closest(".container-page");
    [...cap0.parentElement.children].forEach((el, i) => (el.dataset.tc = String(i)));
    [...section.querySelectorAll("button")].find((b) => b.textContent.includes("Rundgang starten"))?.setAttribute("data-tstart", "");
    const svg = section.querySelector("[data-k] svg");
    [...svg.querySelectorAll(":scope > polygon")].forEach((p, j) => (p.dataset.tp = String(polyChapters[j])));
    svg.querySelector(":scope > g")?.setAttribute("data-tall", "");
    section.querySelector(".animate-bounce")?.closest("div")?.setAttribute("data-thint", "");
    section.querySelector("[style*='scaleX']")?.setAttribute("data-tprogress", "");
    section.querySelector("a.bottom-5.right-5")?.setAttribute("data-tskip", "");
    section.querySelectorAll("nav li button").forEach((btn, i) => {
      btn.dataset.rail = String(i);
      const [label, dot] = btn.children;
      if (label) label.className = "text-xs font-semibold tracking-wide transition-opacity duration-300 text-paper/70 opacity-0 group-hover:opacity-100";
      if (dot) {
        dot.className = "block rounded-full transition-all duration-300";
        dot.removeAttribute("style");
      }
    });

    // --- map / configurator
    const karte = doc.querySelector("#karte");
    const count = karte.querySelector("[data-testid=selection-count]");
    const hint = count?.nextElementSibling;
    if (hint) {
      hint.setAttribute("data-pv-hint", "");
      hint.insertAdjacentHTML("afterend", '<ul data-pv-list class="pv-list" hidden></ul>');
    }
    karte.querySelectorAll("button").forEach((b) => {
      const text = b.textContent.trim();
      if (b.dataset.selectSpace) return;
      if (text.startsWith("Gesamte Location")) b.setAttribute("data-full-venue", "");
      else if (b.dataset.testid === "panel-primary") b.dataset.live = "Gemeinsame Verfügbarkeit prüfen";
      else if (/^Datum (aus)?wählen$/.test(text)) {
        b.dataset.live = "Kalender & Mietdauer";
        b.dataset.liveClick = '[data-testid="open-schedule"]';
      }
      else if (text === "Liste") b.dataset.live = "Listenansicht";
      else if (text === "Vergrößern") b.dataset.live = "Kartenzoom";
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
        cta.dataset.live = "Verfügbarkeit prüfen";
      }
    }
    // gallery lightbox
    doc.querySelectorAll("button[aria-label$='vergrößern']").forEach((b) => {
      const img = b.parentElement?.querySelector("img") ?? b.querySelector("img");
      if (img) b.dataset.lightbox = original(img.getAttribute("src"));
    });

    await processTree(doc);
    for (const b of doc.querySelectorAll("[data-lightbox]")) {
      if (!b.dataset.lightbox.startsWith("data:")) b.dataset.lightbox = await dataUrl(b.dataset.lightbox);
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
  { chapters, polyChapters, spaces, headerTop, headerScrolled },
);
await browser.close();

const payload = {
  spaces: spaces.map(({ shape: _shape, ...s }) => s),
  headerTop: result.headers[0],
  headerScrolled: result.headers[1],
  liveUrl: LIVE,
};
const title = "Zur Krone Vorschau";
const pill = `<div class="pv-pill" aria-hidden="true">Vorschau · Demo-Inhalte</div>`;
const scripts =
  `<script>window.__PREVIEW__=${JSON.stringify(payload).replace(/</g, "\\u003c")};</script>` +
  `<script>${runtimeJs.replace(/<\/script/gi, "<\\/script")}</script>`;
const rootClasses = `<script>(function(){var d=document.documentElement;d.lang="de";d.className+=" ${result.htmlClass}";document.body.className+=" ${result.bodyClass}";})();</script>`;

// (a) page content for the artifact viewer (it adds doctype/head/body itself)
const content = [
  `<title>${title}</title>`,
  `<meta name="robots" content="noindex">`,
  rootClasses,
  result.styles,
  `<style>${previewCss}</style>`,
  result.bodyHtml,
  pill,
  scripts,
].join("\n");
// (b) complete standalone document (open in any browser, send as file)
const full = `<!DOCTYPE html><html lang="de" class="${result.htmlClass}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>${title}</title><meta name="robots" content="noindex">${result.styles}<style>${previewCss}</style></head><body class="${result.bodyClass}">${result.bodyHtml}${pill}${scripts}</body></html>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, full);
const artifactOut = path.join(path.dirname(OUT), "artifact", "zur-krone-vorschau.html");
fs.mkdirSync(path.dirname(artifactOut), { recursive: true });
fs.writeFileSync(artifactOut, content);
fs.rmSync(tmpMod, { force: true });
// parts for the full browser demo (static first paint + fallback)
fs.writeFileSync(
  path.join(path.dirname(OUT), "parts.json"),
  JSON.stringify({ title, rootClasses, styles: result.styles, previewCss, bodyHtml: result.bodyHtml, pill, scripts }),
);
console.log("wrote", OUT, (full.length / 1024 / 1024).toFixed(2), "MB and", artifactOut);
