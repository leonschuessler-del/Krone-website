/**
 * Runtime for the standalone preview (no Next.js, no server, no database engine).
 *
 * The page HTML is a snapshot of the real homepage. This script brings it to
 * life with the same code the website uses where possible:
 *  - scroll film: the real tour player (image sequences on a canvas)
 *  - availability: the real domain logic (src/domain/availability) on the
 *    demo scenario (src/content/demo-scenario) – incl. double-booking guard
 *  - room facts: the same estimate helper as the website
 * Requests made here stay in the viewer's browser (localStorage).
 */
import { tourConfig } from "@/config/tour";
import { floorplanMeta } from "@/config/floorplan";
import { demoBlockSpecs } from "@/content/demo-scenario";
import { eventTypes } from "@/content/event-types";
import { demoSettings } from "@/content/settings";
import { displayFacts, ESTIMATE_NOTE } from "@/content/space-estimates";
import { checkSelection, selectionDayStatus, type AvailabilityContext, type SpaceAvailabilityProfile } from "@/domain/availability";
import { generateBookingNumber } from "@/domain/booking";
import type { AvailabilityBlock } from "@/domain/types";
import { addDays, isoWeekday, todayLocal, zonedDateTimeToUtc, zonedToUtc } from "@/domain/time";
import { mountTourPlayer } from "@/features/home/tour-player";

interface PreviewSpace {
  id: string;
  slug: string;
  code: string;
  name: string;
  type: string;
  level: string;
  shortDescription: string | null;
  longDescription: string | null;
  features: string[];
  areaSqm: number | null;
  capacitySeated: number | null;
  capacityStanding: number | null;
  bookable: boolean;
  includedInFullVenue: boolean;
  setupBufferMinutes: number | null;
  cleanupBufferMinutes: number | null;
  images: string[];
}

declare global {
  interface Window {
    __PREVIEW__: { spaces: PreviewSpace[]; headerTop: string; headerScrolled: string; legal: Record<string, { title: string; html: string }> };
  }
}

const data = window.__PREVIEW__;
const spaces = data.spaces;
const byId = new Map(spaces.map((s) => [s.id, s]));
const bySlug = new Map(spaces.map((s) => [s.slug, s]));
const bookable = spaces.filter((s) => s.bookable);
const selected = new Set<string>();
const rel = (src: string) => (src.startsWith("/") ? src.slice(1) : src);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const LEVEL: Record<string, string> = { "ground-floor": "Erdgeschoss", "first-floor": "1. Obergeschoss", outdoor: "Außenbereich", site: "Gelände" };

/* ------------------------------------------------------------------ tour */
function initTour() {
  const section = document.getElementById("rundgang");
  if (!section) return;
  mountTourPlayer(section, {
    chapters: tourConfig.chapters,
    map: floorplanMeta.viewBox,
    resolveUrl: rel,
  });
}

/* ---------------------------------------------------------------- header */
function initHeader() {
  let scrolled: boolean | null = null;
  const update = () => {
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

function updateSelectionUi() {
  const n = selected.size;
  document.querySelectorAll<SVGGElement>("[data-space-id]").forEach((g) => g.setAttribute("data-selected", String(selected.has(g.dataset.spaceId!))));
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
        (s) => `<li class="pv-sel"><span class="pv-badge">${esc(s!.code)}</span><span class="pv-sel-name">${esc(s!.type === "hotel" ? "Übernachtung (Hotel)" : s!.name)}</span>
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
  const hotelOn = selected.has("hotel");
  document.querySelectorAll<HTMLElement>("[data-hotel-toggle]").forEach((b) => {
    b.setAttribute("aria-pressed", String(hotelOn));
    b.textContent = hotelOn ? "✓ Übernachtung ist dabei" : "Übernachtung hinzufügen";
    b.classList.toggle("pv-on", hotelOn);
  });
  document.querySelectorAll<HTMLElement>("[data-testid=hotel-card]").forEach((c) => c.classList.toggle("pv-card-on", hotelOn));
}

/* ------------------------------------------------------------------ dialog */
let lastFocus: HTMLElement | null = null;
function openDialog(html: string, opts: { wide?: boolean; label?: string } = {}) {
  const existing = document.querySelector<HTMLElement>(".pv-dialog .pv-card");
  if (existing) {
    // re-render in place (keeps scroll position stable for multi-step flows)
    existing.innerHTML = `<button type="button" class="pv-close" data-close aria-label="Schließen">×</button>${html}`;
    existing.classList.toggle("pv-card-wide", !!opts.wide);
    return existing;
  }
  lastFocus = document.activeElement as HTMLElement | null;
  const wrap = document.createElement("div");
  wrap.className = "pv-dialog";
  wrap.innerHTML = `<div class="pv-backdrop" data-close></div><div class="pv-card${opts.wide ? " pv-card-wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(opts.label ?? "Dialog")}" tabindex="-1"><button type="button" class="pv-close" data-close aria-label="Schließen">×</button>${html}</div>`;
  document.body.appendChild(wrap);
  document.documentElement.style.overflow = "hidden";
  const card = wrap.querySelector<HTMLElement>(".pv-card")!;
  card.focus();
  return card;
}
function closeDialog() {
  document.querySelectorAll(".pv-dialog").forEach((d) => d.remove());
  document.documentElement.style.overflow = "";
  flowOpen = false;
  lastFocus?.focus?.();
}

/* ------------------------------------------------------------ room details */
let room: { slug: string; index: number } | null = null;

function roomHtml(s: PreviewSpace, index: number) {
  const imgs = s.images;
  const facts = displayFacts(s);
  const on = selected.has(s.id);
  const order = spaces.filter((x) => x.images.length > 0);
  const pos = order.findIndex((x) => x.id === s.id);
  const prev = order[(pos - 1 + order.length) % order.length]!;
  const next = order[(pos + 1) % order.length]!;
  const isHotel = s.type === "hotel";
  const selectLabel = isHotel ? (on ? "✓ Übernachtung ist dabei" : "Übernachtung hinzufügen") : on ? "✓ Ausgewählt – entfernen" : "Zur Auswahl hinzufügen";
  return `
    <div class="pv-gallery">
      <div class="pv-stage">
        ${imgs.length ? `<img src="${esc(imgs[index]!)}" alt="${esc(s.name)} – Bild ${index + 1} von ${imgs.length}" class="pv-stage-img">` : ""}
        ${imgs.length > 1 ? `<button type="button" class="pv-nav pv-nav-l" data-img="${(index - 1 + imgs.length) % imgs.length}" aria-label="Vorheriges Bild">‹</button><button type="button" class="pv-nav pv-nav-r" data-img="${(index + 1) % imgs.length}" aria-label="Nächstes Bild">›</button>` : ""}
        <span class="pv-count">${index + 1} / ${imgs.length}</span>
      </div>
      <div class="pv-thumbs" role="list">
        ${imgs.map((src, i) => `<button type="button" role="listitem" data-img="${i}" class="pv-thumb${i === index ? " is-on" : ""}" aria-label="Bild ${i + 1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join("")}
      </div>
    </div>
    <div class="pv-room">
      <div>
        <p class="pv-eyebrow">${esc(LEVEL[s.level] ?? "")}${isHotel ? " · Übernachten im Haus" : ""}</p>
        <div class="pv-head"><span class="pv-badge pv-badge-lg">${esc(s.code)}</span><h2>${esc(s.name)}</h2></div>
        ${s.shortDescription ? `<p class="pv-lead">${esc(s.shortDescription)}</p>` : ""}
        ${s.longDescription ? `<p class="pv-text">${esc(s.longDescription)}</p>` : ""}
        ${s.features.length ? `<ul class="pv-feat">${s.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
      </div>
      <aside>
        <dl class="pv-facts">
          <div><dt>Fläche</dt><dd>${esc(facts.area)}</dd></div>
          <div><dt>${isHotel ? "Zimmer" : "Sitzplätze"}</dt><dd>${esc(facts.seats)}</dd></div>
          <div><dt>Lage</dt><dd>${esc(LEVEL[s.level] ?? "–")}</dd></div>
          <div><dt>Buchung</dt><dd>${!s.bookable ? "nicht einzeln" : isHotel ? "nur komplett, auf Anfrage" : "einzeln oder kombiniert"}</dd></div>
        </dl>
        ${facts.estimated ? `<p class="pv-small">ca.-Werte: ${esc(ESTIMATE_NOTE)}</p>` : ""}
        <p class="pv-small">Toiletten sind bei jeder Buchung inklusive.</p>
        <div class="pv-actions">
          ${s.bookable ? `<button type="button" class="pv-btn ${on ? "pv-btn-dark" : "pv-btn-gold"}" data-room-select="${s.id}">${selectLabel}</button>` : ""}
          ${s.bookable ? `<button type="button" class="pv-btn" data-flow data-flow-with="${s.id}">Verfügbarkeit prüfen</button>` : ""}
        </div>
      </aside>
    </div>
    <nav class="pv-roomnav" aria-label="Weitere Räume">
      <button type="button" data-room="${prev.slug}">‹ ${esc(prev.name)}</button>
      <button type="button" data-room="${next.slug}">${esc(next.name)} ›</button>
    </nav>`;
}

function openRoom(slug: string, index = 0) {
  const s = bySlug.get(slug);
  if (!s) return;
  room = { slug, index };
  const card = openDialog(roomHtml(s, index), { wide: true, label: `${s.name} – Details` });
  card.scrollTop = 0;
}
function showImage(i: number) {
  if (!room) return;
  room.index = i;
  const s = bySlug.get(room.slug)!;
  const card = document.querySelector<HTMLElement>(".pv-dialog .pv-card");
  const top = card?.scrollTop ?? 0;
  openDialog(roomHtml(s, i), { wide: true });
  if (card) card.scrollTop = top;
}

/* ------------------------------------------------------- availability core */
const today = todayLocal();
const STORE_KEY = "krone-preview-requests-v1";
interface StoredRequest {
  ref: string;
  spaceIds: string[];
  date: string;
  from: string;
  to: string;
  name: string;
  guests: string;
  event: string;
}
function loadRequests(): StoredRequest[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as StoredRequest[]) : [];
  } catch {
    return [];
  }
}
function saveRequests(list: StoredRequest[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  } catch {
    /* private mode – keep in memory */
  }
}
let requests = loadRequests();

function context(): AvailabilityContext {
  const profiles: Record<string, SpaceAvailabilityProfile> = {};
  for (const s of bookable) {
    profiles[s.id] = {
      spaceId: s.id,
      name: s.name,
      weeklyHours: demoSettings.bookableHours.weeklyHours,
      setupBufferMinutes: s.setupBufferMinutes ?? 0,
      cleanupBufferMinutes: s.cleanupBufferMinutes ?? 0,
      advanceBookingMinHours: null,
      advanceBookingMaxDays: null,
      minimumDurationMinutes: null,
      maximumDurationMinutes: null,
    };
  }
  const blocks: AvailabilityBlock[] = demoBlockSpecs(today).map((b, i) => ({
    id: `demo-${i}`,
    spaceId: b.spaceId,
    start: zonedToUtc(b.date, b.from),
    end: zonedToUtc(b.date, b.to),
    type: b.type,
    reason: b.reason,
    bookingId: null,
    expiresAt: null,
    isDemo: true,
  }));
  requests.forEach((r, i) => {
    const iv = interval(r.date, r.from, r.to);
    for (const id of r.spaceIds) blocks.push({ id: `req-${i}-${id}`, spaceId: id, start: iv.start, end: iv.end, type: "reserved", reason: `Anfrage ${r.ref}`, bookingId: r.ref, expiresAt: null, isDemo: true });
  });
  return { profiles, blocks, now: Date.now() };
}

/** end time ≤ start time means "until the next day" (e.g. 18:00 – 01:00) */
function interval(date: string, from: string, to: string) {
  const endDate = to <= from ? addDays(date, 1) : date;
  return { start: zonedDateTimeToUtc(date, from), end: zonedDateTimeToUtc(endDate, to) };
}

/* ------------------------------------------------------------ request flow */
type Step = 1 | 2 | 3 | 4;
const flow = {
  step: 1 as Step,
  spaces: new Set<string>(),
  date: null as string | null,
  from: "18:00",
  to: "23:00",
  month: today.slice(0, 7),
  form: { event: "", guests: "", name: "", email: "", phone: "", message: "" },
  mode: "inquiry" as "inquiry" | "booking",
  terms: false,
  error: "",
  ref: "",
};
let flowOpen = false;

const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const nameOf = (id: string) => (id === "hotel" ? "Übernachtung (Hotel)" : (byId.get(id)?.name ?? id));

function openFlow(opts: { with?: string; step?: Step } = {}) {
  flow.spaces = new Set(selected);
  if (opts.with) flow.spaces.add(opts.with);
  flow.error = "";
  flow.ref = "";
  flow.step = opts.step ?? (flow.spaces.size ? 2 : 1);
  flowOpen = true;
  renderFlow();
}

function stepper() {
  const labels = ["Bereiche", "Termin", "Ihre Angaben", "Bestätigung"];
  return `<ol class="pv-steps">${labels.map((l, i) => `<li class="${i + 1 === flow.step ? "is-on" : i + 1 < flow.step ? "is-done" : ""}"><span>${i + 1}</span>${l}</li>`).join("")}</ol>`;
}

function calendarHtml(ctx: AvailabilityContext) {
  const [y, m] = flow.month.split("-").map(Number) as [number, number];
  const first = `${flow.month}-01`;
  const daysInMonth = new Date(y, m, 0).getDate();
  const lead = isoWeekday(first) - 1;
  const ids = [...flow.spaces];
  const cells: string[] = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="pv-day pv-day-empty"></span>');
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${flow.month}-${String(d).padStart(2, "0")}`;
    const past = date < today;
    const st = past ? "past" : selectionDayStatus(ids, date, ctx).status;
    const cls = past ? "past" : st === "available" ? "free" : st === "partially_available" ? "partial" : "busy";
    const title = past ? "vergangen" : cls === "free" ? "frei" : cls === "partial" ? "teilweise frei" : "belegt";
    cells.push(
      `<button type="button" class="pv-day is-${cls}${flow.date === date ? " is-sel" : ""}" data-date="${date}" ${past || cls === "busy" ? "disabled" : ""} aria-label="${fmtDate(date)}: ${title}" aria-pressed="${flow.date === date}">${d}</button>`,
    );
  }
  const monthName = new Date(y, m - 1, 15).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const canPrev = flow.month > today.slice(0, 7);
  return `<div class="pv-cal">
    <div class="pv-cal-head"><button type="button" data-month="-1" ${canPrev ? "" : "disabled"} aria-label="Vorheriger Monat">‹</button><strong>${monthName}</strong><button type="button" data-month="1" aria-label="Nächster Monat">›</button></div>
    <div class="pv-cal-grid">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => `<span class="pv-wd">${w}</span>`).join("")}${cells.join("")}</div>
    <p class="pv-legend"><span class="is-free"></span>frei <span class="is-partial"></span>teilweise frei <span class="is-busy"></span>belegt</p>
  </div>`;
}

function renderFlow() {
  if (!flowOpen) return;
  const ctx = context();
  let body = "";
  if (flow.step === 1) {
    body = `<h2 class="pv-h2">Welche Bereiche möchten Sie nutzen?</h2>
      <p class="pv-text">Mehrfachauswahl möglich. Toiletten sind immer inklusive.</p>
      <div class="pv-choices">${bookable
        .map(
          (s) => `<label class="pv-choice"><input type="checkbox" data-flow-space="${s.id}" ${flow.spaces.has(s.id) ? "checked" : ""}>
          ${s.images[0] ? `<img src="${esc(s.images[0])}" alt="" loading="lazy">` : ""}<span><strong>${esc(nameOf(s.id))}</strong><small>${esc(displayFacts(s).area)} · ${esc(displayFacts(s).seats)}</small></span></label>`,
        )
        .join("")}</div>
      <div class="pv-actions"><button type="button" class="pv-btn pv-btn-gold" data-flow-next ${flow.spaces.size ? "" : "disabled"}>Weiter zum Termin</button></div>`;
  } else if (flow.step === 2) {
    const ids = [...flow.spaces];
    let check = "";
    let ok = false;
    if (flow.date) {
      const day = selectionDayStatus(ids, flow.date, ctx);
      const res = checkSelection(ids, interval(flow.date, flow.from, flow.to), ctx, { enforceBookableHours: true });
      ok = res.bookingAllowed;
      const windows = day.common
        .map((w) => `${new Date(w.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })}–${new Date(w.end).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })}`)
        .join(", ");
      check = `<div class="pv-check ${ok ? "is-ok" : "is-no"}" role="status">
        ${ok ? `<strong>✓ Frei.</strong> ${esc(ids.map(nameOf).join(", "))} am ${fmtDate(flow.date)}, ${flow.from}–${flow.to} Uhr.` : `<strong>Nicht möglich.</strong> ${esc(res.results.filter((r) => !r.available).map((r) => `${nameOf(r.spaceId)}: ${r.reason ?? "belegt"}`).join(" · "))}`}
        ${windows ? `<br><small>Gemeinsam frei an diesem Tag: ${windows} Uhr</small>` : ""}
      </div>`;
    }
    body = `<h2 class="pv-h2">Wann möchten Sie feiern?</h2>
      <p class="pv-text">Gewählt: ${esc(ids.map(nameOf).join(", "))} · <button type="button" class="pv-link" data-flow-step="1">ändern</button></p>
      <div class="pv-flow-grid">
        ${calendarHtml(ctx)}
        <div class="pv-time">
          <p class="pv-label">${flow.date ? esc(fmtDate(flow.date)) : "Bitte einen Tag im Kalender wählen"}</p>
          <div class="pv-row">
            <label>Von<select data-time="from">${TIMES.map((t) => `<option ${t === flow.from ? "selected" : ""}>${t}</option>`).join("")}</select></label>
            <label>Bis<select data-time="to">${TIMES.map((t) => `<option ${t === flow.to ? "selected" : ""}>${t}</option>`).join("")}</select></label>
          </div>
          <p class="pv-small">Ende vor Beginn = bis in die Nacht (z. B. 18:00–01:00).</p>
          ${check}
        </div>
      </div>
      <div class="pv-actions"><button type="button" class="pv-btn" data-flow-step="1">Zurück</button><button type="button" class="pv-btn pv-btn-gold" data-flow-next ${ok ? "" : "disabled"}>Weiter zu Ihren Angaben</button></div>`;
  } else if (flow.step === 3) {
    const f = flow.form;
    body = `<h2 class="pv-h2">Ihre Angaben</h2>
      <p class="pv-text">${esc([...flow.spaces].map(nameOf).join(", "))} · ${flow.date ? esc(fmtDate(flow.date)) : ""}, ${flow.from}–${flow.to} Uhr</p>
      <form class="pv-form" data-flow-form novalidate>
        <label>Anlass<select name="event"><option value="">Bitte wählen</option>${eventTypes.map((e) => `<option value="${e.id}" ${f.event === e.id ? "selected" : ""}>${e.label}</option>`).join("")}</select></label>
        <label>Gäste (ca.)<input name="guests" type="number" min="1" inputmode="numeric" value="${esc(f.guests)}"></label>
        <label class="pv-span">Name *<input name="name" required autocomplete="name" value="${esc(f.name)}"></label>
        <label>E-Mail *<input name="email" type="email" required autocomplete="email" value="${esc(f.email)}"></label>
        <label>Telefon<input name="phone" type="tel" autocomplete="tel" value="${esc(f.phone)}"></label>
        <label class="pv-span">Nachricht<textarea name="message" rows="3">${esc(f.message)}</textarea></label>
        ${flow.error ? `<p class="pv-error pv-span" role="alert">${esc(flow.error)}</p>` : ""}
        <label class="pv-span pv-check-row"><input type="checkbox" name="terms" ${flow.terms ? "checked" : ""}> Ich habe die <button type="button" class="pv-link" data-legal="datenschutz">Datenschutzerklärung</button> gelesen.</label>
        <div class="pv-actions pv-span"><button type="button" class="pv-btn" data-flow-step="2">Zurück</button><button type="submit" name="mode" value="inquiry" class="pv-btn">Unverbindlich anfragen</button><button type="submit" name="mode" value="booking" class="pv-btn pv-btn-gold">Verbindlich buchen</button></div>
        <p class="pv-small pv-span">Vorschau: Es wird keine echte Buchung angelegt und nichts versendet.</p>
      </form>`;
  } else {
    const booking = flow.mode === "booking";
    body = `<div class="pv-done">
      <p class="pv-eyebrow">${booking ? "Buchung eingegangen" : "Anfrage eingegangen"}</p>
      <h2 class="pv-h2">Vielen Dank, ${esc(flow.form.name.split(" ")[0] ?? "")}!</h2>
      <p class="pv-ref">${booking ? "Ihre Buchungsnummer" : "Ihre Anfragenummer"} <strong>${esc(flow.ref)}</strong></p>
      <p class="pv-text">${booking ? "Die Räume sind für Sie reserviert. Die Krone bestätigt die Buchung persönlich und meldet sich zu Ablauf, Bewirtung und Übernachtung." : "Die Krone prüft Ihre Anfrage und meldet sich mit einem Angebot."}</p>
      <dl class="pv-facts">
        <div><dt>Bereiche</dt><dd>${esc([...flow.spaces].map(nameOf).join(", "))}</dd></div>
        <div><dt>Termin</dt><dd>${flow.date ? esc(fmtDate(flow.date)) : ""}<br>${flow.from}–${flow.to} Uhr</dd></div>
        <div><dt>Anlass</dt><dd>${esc(eventTypes.find((e) => e.id === flow.form.event)?.label ?? "–")}</dd></div>
        <div><dt>Gäste</dt><dd>${esc(flow.form.guests || "–")}</dd></div>
      </dl>
      <p class="pv-text">Der Zeitraum ist jetzt für Sie vorgemerkt – eine zweite Anfrage für dieselben Bereiche zur selben Zeit wird abgelehnt (probieren Sie es aus).</p>
      <p class="pv-small">Vorschau: Es wurde keine E-Mail versendet. Die Anfrage ist nur in diesem Browser gespeichert.</p>
      <div class="pv-actions"><button type="button" class="pv-btn pv-btn-gold" data-close>Fertig</button><button type="button" class="pv-btn" data-flow-new>Weitere Anfrage</button></div>
    </div>`;
  }
  openDialog(`<p class="pv-eyebrow">Verfügbarkeit &amp; Anfrage</p>${stepper()}${body}`, { wide: true, label: "Verfügbarkeit und Anfrage" });
  if (flow.date) {
    const short = new Date(`${flow.date}T12:00:00`).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });
    document.querySelectorAll<HTMLElement>("[data-flow-at=date] .truncate").forEach((el) => (el.textContent = `${short} · ${flow.from}–${flow.to}`));
  }
}

function submitFlow(form: HTMLFormElement, submitter?: HTMLElement | null) {
  const fd = new FormData(form, submitter ?? undefined);
  for (const k of Object.keys(flow.form) as Array<keyof typeof flow.form>) flow.form[k] = String(fd.get(k) ?? "").trim();
  flow.mode = fd.get("mode") === "booking" ? "booking" : "inquiry";
  flow.terms = !!fd.get("terms");
  if (!flow.form.name) flow.error = "Bitte geben Sie Ihren Namen an.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(flow.form.email)) flow.error = "Bitte geben Sie eine gültige E-Mail-Adresse an.";
  else if (!flow.terms) flow.error = "Bitte bestätigen Sie, dass Sie die Datenschutzerklärung gelesen haben.";
  else flow.error = "";
  if (flow.error || !flow.date) return renderFlow();
  // final check right before saving (another request could have taken the slot)
  const ids = [...flow.spaces];
  const res = checkSelection(ids, interval(flow.date, flow.from, flow.to), context(), { enforceBookableHours: true });
  if (!res.bookingAllowed) {
    flow.step = 2;
    return renderFlow();
  }
  flow.ref = generateBookingNumber(flow.mode, Number(flow.date.slice(0, 4)));
  requests = [...requests, { ref: flow.ref, spaceIds: ids, date: flow.date, from: flow.from, to: flow.to, name: flow.form.name, guests: flow.form.guests, event: flow.form.event }];
  saveRequests(requests);
  flow.step = 4;
  renderFlow();
}

/* ------------------------------------------------------------ misc dialogs */
function openAreaList() {
  openDialog(
    `<p class="pv-eyebrow">Listenansicht</p><h2 class="pv-h2">Alle Bereiche</h2>
    <div class="pv-choices">${bookable
      .map(
        (s) => `<div class="pv-choice"><input type="checkbox" data-toggle-list="${s.id}" ${selected.has(s.id) ? "checked" : ""} aria-label="${esc(s.name)} auswählen">
        ${s.images[0] ? `<img src="${esc(s.images[0])}" alt="" loading="lazy">` : ""}<span><strong>${esc(nameOf(s.id))}</strong><small>${esc(displayFacts(s).area)} · ${esc(displayFacts(s).seats)}</small></span><button type="button" class="pv-link" data-room="${s.slug}">Details</button></div>`,
      )
      .join("")}</div>
    <div class="pv-actions"><button type="button" class="pv-btn pv-btn-gold" data-flow>Verfügbarkeit prüfen</button><button type="button" class="pv-btn" data-close>Schließen</button></div>`,
    { wide: true, label: "Alle Bereiche" },
  );
}

function openInfo(title: string, text: string) {
  openDialog(`<p class="pv-eyebrow">Vorschau</p><h2 class="pv-h2">${esc(title)}</h2><p class="pv-text">${esc(text)}</p><div class="pv-actions"><button type="button" class="pv-btn" data-close>Schließen</button></div>`, { label: title });
}

/* ---------------------------------------------------------------- events */
function initEvents() {
  document.addEventListener("click", (e) => {
    const el = e.target as Element;
    const t = (sel: string) => el.closest<HTMLElement>(sel);
    let hit: HTMLElement | null;
    if ((hit = t("[data-close]"))) return closeDialog();
    if ((hit = t("[data-img]"))) return showImage(Number(hit.dataset.img));
    if ((hit = t("[data-room-select]"))) {
      toggle(hit.dataset.roomSelect!);
      return room && openRoom(room.slug, room.index);
    }
    if ((hit = t("[data-remove]"))) return toggle(hit.dataset.remove!, false);
    if ((hit = t("[data-room]"))) {
      e.preventDefault();
      return openRoom(hit.dataset.room!);
    }
    if ((hit = t("[data-flow-next]"))) {
      flow.step = (flow.step + 1) as Step;
      return renderFlow();
    }
    if ((hit = t("[data-flow-step]"))) {
      flow.step = Number(hit.dataset.flowStep) as Step;
      return renderFlow();
    }
    if ((hit = t("[data-flow-new]"))) {
      flow.date = null;
      return openFlow({ step: 2 });
    }
    if ((hit = t("[data-date]"))) {
      flow.date = hit.dataset.date!;
      return renderFlow();
    }
    if ((hit = t("[data-month]"))) {
      const [y, m] = flow.month.split("-").map(Number) as [number, number];
      const d = new Date(y, m - 1 + Number(hit.dataset.month), 1);
      flow.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return renderFlow();
    }
    if ((hit = t("[data-flow]"))) {
      e.preventDefault();
      return openFlow({ with: hit.dataset.flowWith, step: hit.dataset.flowAt === "date" && selected.size ? 2 : undefined });
    }
    if ((hit = t("[data-area-list]"))) return openAreaList();
    if ((hit = t("[data-map-zoom]"))) return openDialog(`<img src="media/floorplan/aerial-2900.webp" alt="Drohnenaufnahme der Krone von oben" class="pv-img-full">`, { wide: true, label: "Karte groß" });
    if ((hit = t("[data-legal]"))) {
      e.preventDefault();
      const doc = data.legal?.[hit.dataset.legal!];
      if (doc) return openDialog(`<div class="pv-legal">${doc.html}</div>`, { wide: true, label: doc.title });
    }
    if ((hit = t("[data-page]"))) {
      e.preventDefault();
      return openInfo(hit.dataset.page!, "Diese Seite ist in der Vorschau nicht enthalten. Rechtstexte und weitere Unterseiten werden vor dem Start vom Betreiber ergänzt.");
    }
    if ((hit = t("[data-hotel-toggle]"))) return toggle("hotel");
    if ((hit = t("[data-select-space]"))) return toggle(hit.dataset.selectSpace!);
    if ((hit = t("[data-toggle-space]"))) return toggle(hit.dataset.toggleSpace!);
    if ((hit = t("[data-full-venue]"))) {
      const full = spaces.filter((s) => s.includedInFullVenue && s.bookable);
      const allOn = full.every((s) => selected.has(s.id));
      full.forEach((s) => (allOn ? selected.delete(s.id) : selected.add(s.id)));
      return updateSelectionUi();
    }
    if ((hit = t("[data-pv-reset]"))) {
      selected.clear();
      return updateSelectionUi();
    }
    if ((hit = t("[data-space-id]"))) return toggle(hit.dataset.spaceId!);
    if ((hit = t("[data-pv-menu]"))) return toggleMenu();
    if ((hit = t("[data-pv-sheet]"))) return openAreaList();
    if ((hit = t("[data-lightbox]"))) return openDialog(`<img src="${hit.dataset.lightbox}" alt="" class="pv-img-full">`, { wide: true, label: "Bild" });
    if ((hit = t("a[href^='#']")) && document.querySelector(".pv-menu")) closeMenu();
  });
  document.addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement | HTMLSelectElement;
    if (el.dataset.flowSpace) {
      if ((el as HTMLInputElement).checked) flow.spaces.add(el.dataset.flowSpace);
      else flow.spaces.delete(el.dataset.flowSpace);
      return renderFlow();
    }
    if (el.dataset.toggleList) return toggle(el.dataset.toggleList, (el as HTMLInputElement).checked);
    if (el.dataset.time === "from" || el.dataset.time === "to") {
      flow[el.dataset.time] = el.value;
      return renderFlow();
    }
  });
  document.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    if (form.matches("[data-flow-form]")) return submitFlow(form, (e as SubmitEvent).submitter);
    openDialog(`<p class="pv-eyebrow">Kontakt</p><h2 class="pv-h2">Danke für Ihre Nachricht!</h2><p class="pv-text">In der fertigen Website geht sie direkt an die Krone. In dieser Vorschau wird nichts versendet.</p><div class="pv-actions"><button type="button" class="pv-btn pv-btn-gold" data-close>Schließen</button></div>`, { label: "Kontakt" });
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
    if (e.key === "Escape") {
      closeDialog();
      closeMenu();
    }
    if (room && document.querySelector(".pv-dialog .pv-stage") && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      const n = bySlug.get(room.slug)!.images.length;
      showImage((room.index + (e.key === "ArrowRight" ? 1 : n - 1)) % n);
    }
    const g = (e.target as Element).closest?.<SVGGElement>("[data-space-id]");
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
