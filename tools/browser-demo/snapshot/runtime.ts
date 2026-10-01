/**
 * Runtime for the standalone preview file (no Next.js, no server).
 * Re-uses the real tour timeline + config; everything else is a light
 * vanilla re-implementation of the homepage interactions.
 */
import { tourConfig, WIDE_CAMERA } from "@/config/tour";
import { floorplanMeta } from "@/config/floorplan";
import { cameraTransform, chapterScrollTarget, chapterSpans, computeFrame, overviewCamera } from "@/features/home/tour-timeline";

interface PreviewSpace {
  id: string;
  slug: string;
  code: string;
  name: string;
  color: string;
  shortDescription: string | null;
  longDescription: string | null;
  areaSqm: number | null;
  capacitySeated: number | null;
  capacityStanding: number | null;
  bookable: boolean;
  includedInFullVenue: boolean;
  images: string[];
}

declare global {
  interface Window {
    __PREVIEW__: { spaces: PreviewSpace[]; headerTop: string; headerScrolled: string; liveUrl: string | null };
  }
}

const data = window.__PREVIEW__;
/** set by the full browser demo once it has taken over the page */
const off = () => (window as unknown as { __PREVIEW_OFF__?: boolean }).__PREVIEW_OFF__ === true;
type DemoWindow = { __DEMO_STATE__?: "booting" | "ready" | "failed"; __demoNavigate?: (href: string) => void };
const demo = () => window as unknown as DemoWindow;
const spaces = data.spaces;
const byId = new Map(spaces.map((s) => [s.id, s]));
const bySlug = new Map(spaces.map((s) => [s.slug, s]));
const selected = new Set<string>();

/* ------------------------------------------------------------------ tour */
function initTour() {
  const section = document.getElementById("rundgang");
  // the video scroll film runs only in the live app; the snapshot shows its first frame
  if (!section || !section.querySelector("[data-tl]")) return;
  const chapters = tourConfig.chapters;
  const spans = chapterSpans(chapters, null);
  const { width: MAP_W, height: MAP_H } = floorplanMeta.viewBox;
  const aerial = section.querySelector<HTMLElement>("[data-k]");
  const layers = new Map<number, HTMLElement>();
  section.querySelectorAll<HTMLElement>("[data-tl]").forEach((el) => layers.set(Number(el.dataset.tl), el));
  const secondaries = new Map<number, HTMLElement>();
  section.querySelectorAll<HTMLElement>("[data-ts]").forEach((el) => secondaries.set(Number(el.dataset.ts), el));
  const captions = new Map<number, HTMLElement>();
  section.querySelectorAll<HTMLElement>("[data-tc]").forEach((el) => captions.set(Number(el.dataset.tc), el));
  const polygons = new Map<number, SVGElement>();
  section.querySelectorAll<SVGElement>("[data-tp]").forEach((el) => polygons.set(Number(el.dataset.tp), el));
  const all = section.querySelector<SVGElement>("[data-tall]");
  const hint = section.querySelector<HTMLElement>("[data-thint]");
  const skip = section.querySelector<HTMLElement>("[data-tskip]");
  const progress = section.querySelector<HTMLElement>("[data-tprogress]");
  const rail = new Map<number, HTMLElement>();
  section.querySelectorAll<HTMLElement>("[data-rail]").forEach((el) => rail.set(Number(el.dataset.rail), el));
  let active = -1;

  const setActive = (index: number) => {
    if (index === active) return;
    active = index;
    captions.forEach((el, i) => (el.style.pointerEvents = i === index ? "auto" : "none"));
    rail.forEach((btn, i) => {
      const on = i === index;
      const [label, dot] = [btn.children[0] as HTMLElement, btn.children[1] as HTMLElement];
      if (label) {
        label.style.opacity = on ? "1" : "";
        label.style.color = on ? "var(--color-paper)" : "";
      }
      if (dot) {
        dot.style.width = dot.style.height = on ? "0.75rem" : "0.5rem";
        dot.style.background = on ? "var(--color-gold-light)" : "rgb(255 255 255 / 0.45)";
        const s = chapters[i]?.spaceId ? byId.get(chapters[i]!.spaceId!) : undefined;
        dot.style.boxShadow = on && s ? `0 0 0 3px ${s.color}` : "none";
      }
    });
  };

  let raf = 0;
  let current = -1;
  const measure = () => {
    const rect = section.getBoundingClientRect();
    const scrollable = Math.max(1, rect.height - window.innerHeight);
    return Math.min(1, Math.max(0, -rect.top / scrollable));
  };
  const tick = () => {
    raf = 0;
    const target = measure();
    current = current < 0 ? target : current + (target - current) * 0.2;
    if (Math.abs(target - current) < 0.0004) current = target;
    const vp = { width: window.innerWidth, height: window.innerHeight };
    const frame = computeFrame(current, chapters, spans, WIDE_CAMERA, overviewCamera(WIDE_CAMERA, vp, { width: MAP_W, height: MAP_H }));
    if (aerial) {
      const k = Number(aerial.dataset.k ?? 1);
      const { tx, ty, scale } = cameraTransform(frame.camera, vp, { width: MAP_W, height: MAP_H });
      aerial.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${(scale / k).toFixed(5)})`;
    }
    chapters.forEach((_, i) => {
      const layer = layers.get(i);
      if (layer) {
        layer.style.opacity = frame.roomOpacity[i]!.toFixed(3);
        layer.style.visibility = frame.roomOpacity[i]! > 0.001 ? "visible" : "hidden";
        const inner = layer.firstElementChild as HTMLElement | null;
        if (inner) inner.style.transform = `scale(${frame.roomScale[i]!.toFixed(4)})`;
      }
      const sec = secondaries.get(i);
      if (sec) sec.style.opacity = frame.roomSecondary[i]!.toFixed(3);
      const cap = captions.get(i);
      if (cap) {
        const o = frame.captionOpacity[i]!;
        cap.style.opacity = o.toFixed(3);
        cap.style.transform = `translate3d(0, ${((1 - o) * 18).toFixed(1)}px, 0)`;
        cap.style.visibility = o > 0.01 ? "visible" : "hidden";
      }
      const poly = polygons.get(i);
      if (poly) poly.style.opacity = frame.polygonOpacity[i]!.toFixed(3);
    });
    if (all) all.style.opacity = frame.allPolygons.toFixed(3);
    if (hint) {
      hint.style.opacity = frame.scrollHint.toFixed(3);
      hint.style.display = frame.scrollHint > 0.001 ? "" : "none";
    }
    if (skip) {
      const o = 1 - frame.allPolygons;
      skip.style.opacity = o.toFixed(3);
      skip.style.visibility = o > 0.01 ? "visible" : "hidden";
    }
    if (progress) progress.style.transform = `scaleX(${current.toFixed(4)})`;
    setActive(frame.index);
    if (current !== target) raf = requestAnimationFrame(tick);
  };
  const schedule = () => {
    if (off()) return;
    if (!raf) raf = requestAnimationFrame(tick);
  };
  schedule();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);

  const jumpTo = (index: number) => {
    const scrollable = section.offsetHeight - window.innerHeight;
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + chapterScrollTarget(spans[index]!, scrollable, index === 0 ? 0 : 0.55), behavior: "smooth" });
  };
  rail.forEach((btn, i) => btn.addEventListener("click", () => jumpTo(i)));
  section.querySelector<HTMLElement>("[data-tstart]")?.addEventListener("click", () => jumpTo(1));
}

/* ---------------------------------------------------------------- header */
function initHeader() {
  let scrolled: boolean | null = null;
  const update = () => {
    if (off()) return;
    const tour = document.getElementById("rundgang");
    const heroEnd = tour && tour.offsetHeight > 0 ? tour.offsetHeight : 0;
    const next = window.scrollY > (heroEnd > 0 ? heroEnd - 80 : 24);
    if (next === scrolled) return;
    scrolled = next;
    const header = document.querySelector("header");
    if (header) header.outerHTML = next ? data.headerScrolled : data.headerTop;
    updateSelectionUi();
  };
  update();
  window.addEventListener("scroll", update, { passive: true });
}

/* ------------------------------------------------------------- selection */
function toggle(id: string, force?: boolean) {
  const on = force ?? !selected.has(id);
  if (on) selected.add(id);
  else selected.delete(id);
  updateSelectionUi();
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function updateSelectionUi() {
  const n = selected.size;
  document.querySelectorAll<SVGGElement>("#karte [data-space-id]").forEach((g) => g.setAttribute("data-selected", String(selected.has(g.dataset.spaceId!))));
  document.querySelectorAll<HTMLElement>("[data-toggle-space]").forEach((b) => b.setAttribute("aria-pressed", String(selected.has(b.dataset.toggleSpace!))));
  const label = n === 0 ? "Noch keine Auswahl" : n === 1 ? "1 Bereich ausgewählt" : `${n} Bereiche ausgewählt`;
  document.querySelectorAll<HTMLElement>("[data-testid=selection-count]").forEach((el) => (el.textContent = label));
  document.querySelectorAll<HTMLElement>("[data-pv-hint]").forEach((el) => (el.hidden = n > 0));
  document.querySelectorAll<HTMLElement>("[data-pv-list]").forEach((el) => {
    el.hidden = n === 0;
    el.innerHTML = [...selected]
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map(
        (s) => `<li class="pv-sel"><span class="pv-badge" style="background:${s!.color}">${esc(s!.code)}</span><span class="pv-sel-name">${esc(s!.name)}</span>
          <button type="button" data-room="${s!.slug}" class="pv-sel-link">Details</button>
          <button type="button" data-remove="${s!.id}" class="pv-sel-x" aria-label="${esc(s!.name)} entfernen">×</button></li>`,
      )
      .join("");
  });
  document.querySelectorAll<HTMLButtonElement>("[data-testid=panel-primary], [data-pv-mobile-cta]").forEach((b) => (b.disabled = n === 0));
  document.querySelectorAll<HTMLElement>("[data-pv-mobile-count]").forEach((el) => (el.textContent = n === 0 ? "Noch nichts ausgewählt" : label));
  document.querySelectorAll<HTMLElement>("[data-select-space]").forEach((b) => {
    const on = selected.has(b.dataset.selectSpace!);
    const text = b.querySelector("[data-pv-label]") ?? b;
    text.textContent = on ? "Ausgewählt ✓" : "Auswählen";
    b.setAttribute("aria-pressed", String(on));
  });
  const full = spaces.filter((s) => s.includedInFullVenue && s.bookable);
  const fullOn = full.length > 0 && full.every((s) => selected.has(s.id));
  document.querySelectorAll<HTMLElement>("[data-full-venue]").forEach((b) => b.setAttribute("aria-pressed", String(fullOn)));
}

/* ------------------------------------------------------------------ modal */
function openDialog(html: string) {
  closeDialog();
  const wrap = document.createElement("div");
  wrap.className = "pv-dialog";
  wrap.innerHTML = `<div class="pv-backdrop" data-close></div><div class="pv-card" role="dialog" aria-modal="true"><button type="button" class="pv-close" data-close aria-label="Schließen">×</button>${html}</div>`;
  document.body.appendChild(wrap);
  document.documentElement.style.overflow = "hidden";
}
function closeDialog() {
  document.querySelectorAll(".pv-dialog").forEach((d) => d.remove());
  document.documentElement.style.overflow = "";
}

const fact = (v: number | null, unit: string) => (v === null ? '<span class="pv-muted">Angabe folgt</span>' : `${v} ${unit}`);

function openRoom(slug: string) {
  const s = bySlug.get(slug);
  if (!s) return;
  const imgs = s.images.map((src, i) => `<img src="${src}" alt="${esc(s.name)} – Beispielbild ${i + 1}" class="${i === 0 ? "pv-img-main" : "pv-img-thumb"}">`).join("");
  const on = selected.has(s.id);
  openDialog(`
    <div class="pv-imgs">${imgs}</div>
    <p class="pv-note">Beispielbilder (Illustration) – echte Aufnahmen folgen</p>
    <div class="pv-head"><span class="pv-badge pv-badge-lg" style="background:${s.color}">${esc(s.code)}</span><h2>${esc(s.name)}</h2></div>
    ${s.shortDescription ? `<p class="pv-lead">${esc(s.shortDescription)}</p>` : ""}
    ${s.longDescription ? `<p class="pv-text">${esc(s.longDescription)}</p>` : ""}
    <dl class="pv-facts">
      <div><dt>Fläche</dt><dd>${fact(s.areaSqm, "m²")}</dd></div>
      <div><dt>Sitzplätze</dt><dd>${fact(s.capacitySeated, "Personen")}</dd></div>
      <div><dt>Stehplätze</dt><dd>${fact(s.capacityStanding, "Personen")}</dd></div>
      <div><dt>Buchbar</dt><dd>${s.bookable ? "Ja – einzeln oder kombiniert" : "Nicht über den Location-Kalender"}</dd></div>
    </dl>
    <div class="pv-actions">
      ${s.bookable ? `<button type="button" class="pv-btn pv-btn-gold" data-room-select="${s.id}">${on ? "Ausgewählt ✓ – entfernen" : "Zur Auswahl hinzufügen"}</button>` : ""}
      <button type="button" class="pv-btn" data-live="Verfügbarkeit &amp; Buchung" data-live-route="/buchen?spaces=${s.id}">Verfügbarkeit prüfen</button>
    </div>`);
}

function openSelection() {
  const items = [...selected].map((id) => byId.get(id)!).filter(Boolean);
  openDialog(`
    <p class="pv-eyebrow">Ihre Auswahl</p>
    <h2 class="pv-h2">${items.length ? `${items.length} ${items.length === 1 ? "Bereich" : "Bereiche"} ausgewählt` : "Noch keine Auswahl"}</h2>
    ${items.length ? `<ul class="pv-list">${items.map((s) => `<li class="pv-sel"><span class="pv-badge" style="background:${s.color}">${esc(s.code)}</span><span class="pv-sel-name">${esc(s.name)}</span><button type="button" data-room="${s.slug}" class="pv-sel-link">Details</button></li>`).join("")}</ul>` : `<p class="pv-text">Tippen Sie auf der Karte auf einen oder mehrere Bereiche.</p>`}
    <div class="pv-actions">${items.length ? `<button type="button" class="pv-btn pv-btn-gold" data-live="Gemeinsame Verfügbarkeit prüfen">Verfügbarkeit prüfen</button>` : ""}<button type="button" class="pv-btn" data-close>Schließen</button></div>`);
}

function openLive(feature: string, route: string | null = null, click: string | null = null) {
  const state = demo().__DEMO_STATE__;
  const continueLive = () => {
    if (route) demo().__demoNavigate?.(route);
    else if (click) setTimeout(() => document.querySelector<HTMLElement>(click)?.click(), 400);
  };
  if (state === "ready" && (route || click)) return continueLive();
  if (state === "booting") {
    openDialog(`
      <p class="pv-eyebrow">Einen Moment bitte</p>
      <h2 class="pv-h2">${esc(feature)}</h2>
      <p class="pv-text">Kalender, Verfügbarkeit und Buchung werden gerade im Hintergrund vorbereitet. Es geht gleich automatisch weiter.</p>
      <div class="pv-loading"><span></span></div>`);
    const go = () => {
      closeDialog();
      continueLive();
    };
    window.addEventListener("demo-ready", go, { once: true });
    window.addEventListener("demo-failed", () => openLive(feature, route, click), { once: true });
    return;
  }
  const link = data.liveUrl
    ? `<a class="pv-btn pv-btn-gold" href="${data.liveUrl}" target="_blank" rel="noopener">Live-Version öffnen</a>`
    : "";
  openDialog(`
    <p class="pv-eyebrow">Vorschau</p>
    <h2 class="pv-h2">${esc(feature)}</h2>
    <p class="pv-text">In dieser Ansicht sind Startseite, Scroll-Rundgang und Grundriss zu sehen.
    Kalender, Verfügbarkeitsprüfung, Mietdauer, Preisberechnung und Buchung konnten in diesem Browser nicht gestartet werden – sie funktionieren in der Live-Version der Website.</p>
    <div class="pv-actions">${link}<button type="button" class="pv-btn" data-close>Zurück zur Vorschau</button></div>`);
}

/* ---------------------------------------------------------------- events */
function initEvents() {
  document.addEventListener("click", (e) => {
    if (off()) return;
    const el = e.target as Element;
    const t = (sel: string) => el.closest<HTMLElement>(sel);
    let hit: HTMLElement | null;
    if ((hit = t("[data-close]"))) return closeDialog();
    if ((hit = t("[data-room-select]"))) {
      toggle(hit.dataset.roomSelect!);
      return closeDialog();
    }
    if ((hit = t("[data-remove]"))) return toggle(hit.dataset.remove!, false);
    if ((hit = t("[data-room]"))) {
      e.preventDefault();
      return openRoom(hit.dataset.room!);
    }
    if ((hit = t("[data-live]"))) {
      e.preventDefault();
      let route = hit.dataset.liveRoute ?? null;
      if (hit.dataset.live === "Gemeinsame Verfügbarkeit prüfen" || hit.dataset.live === "Verfügbarkeit prüfen") {
        route = selected.size ? `/buchen?spaces=${[...selected].join(",")}` : "/buchen";
      }
      return openLive(hit.dataset.live!, route, hit.dataset.liveClick ?? null);
    }
    if ((hit = t("[data-select-space]"))) return toggle(hit.dataset.selectSpace!);
    if ((hit = t("[data-toggle-space]"))) return toggle(hit.dataset.toggleSpace!);
    if ((hit = t("[data-full-venue]"))) {
      const full = spaces.filter((s) => s.includedInFullVenue && s.bookable);
      const allOn = full.every((s) => selected.has(s.id));
      full.forEach((s) => (allOn ? selected.delete(s.id) : selected.add(s.id)));
      return updateSelectionUi();
    }
    if ((hit = t("#karte [data-space-id]"))) return toggle(hit.dataset.spaceId!);
    if ((hit = t("[data-pv-menu]"))) return toggleMenu();
    if ((hit = t("[data-pv-sheet]"))) return openSelection();
    if ((hit = t("[data-lightbox]"))) return openDialog(`<img src="${hit.dataset.lightbox}" alt="" class="pv-img-main pv-img-full">`);
    if ((hit = t("a[href^='#']")) && document.querySelector(".pv-menu")) closeMenu();
  });
  document.addEventListener("submit", (e) => {
    if (off()) return;
    e.preventDefault();
    openLive("Kontaktformular");
  });
  // mobile bottom bar only while the map is on screen (as on the website)
  const karte = document.getElementById("karte");
  const bar = document.querySelector<HTMLElement>("[data-pv-mobilebar]");
  if (karte && bar && "IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      const on = entries.some((en) => en.isIntersecting);
      bar.style.transform = on ? "translateY(0)" : "translateY(100%)";
    }, { threshold: 0.05 }).observe(karte);
  }
  document.addEventListener("keydown", (e) => {
    if (off()) return;
    if (e.key === "Escape") {
      closeDialog();
      closeMenu();
    }
    const g = (e.target as Element).closest?.<SVGGElement>("#karte [data-space-id]");
    if (g && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      toggle(g.dataset.spaceId!);
    }
  });
}

function toggleMenu() {
  if (document.querySelector(".pv-menu")) return closeMenu();
  const nav = document.querySelector("header nav");
  const menu = document.createElement("div");
  menu.className = "pv-menu";
  menu.innerHTML = nav ? nav.innerHTML : "";
  document.body.appendChild(menu);
}
function closeMenu() {
  document.querySelectorAll(".pv-menu").forEach((m) => m.remove());
}

initTour();
initHeader();
initEvents();
updateSelectionUi();
