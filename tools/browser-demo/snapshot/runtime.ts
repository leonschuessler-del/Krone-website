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
import { extraSeeds } from "@/content/extras";
import { hotelCopy, roomInventory, roomTypeSeeds } from "@/content/hotel";
import { freeRooms, fullyBookedNights, generateReservationNumber, nightCount, stayNudges, stayQuote, validateItems, validateStay, type RoomReservationLike } from "@/domain/hotel";
import { calculateQuote, type Quote } from "@/domain/pricing";
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
  requires: string[];
  basePrice: number | null;
  priceModel: "hourly" | "daily" | "flat" | "on_request" | null;
  cleaningFee: number | null;
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
const PRICE_POLICY = { mode: "none" as const, downPaymentPercent: null, depositCollection: "separately" as const, depositStrategy: "sum" as const };
const eur = (c: number | null) => (c === null ? "auf Anfrage" : (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" }));
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
let selectionHint = "";
/** The Restaurant is part of every booking: it comes along with any room and cannot be dropped while others are selected. */
function toggle(id: string, force?: boolean) {
  const on = force ?? !selected.has(id);
  selectionHint = "";
  if (on) {
    selected.add(id);
    if (id !== "restaurant" && byId.get(id)?.requires.includes("restaurant")) selected.add("restaurant");
  } else if (id === "restaurant" && [...selected].some((x) => x !== "restaurant")) {
    selectionHint = "Das Restaurant ist bei jeder Buchung dabei (Eingang, Theke). Entfernen Sie zuerst die anderen Räume.";
  } else selected.delete(id);
  updateSelectionUi();
}

function updateSelectionUi() {
  const n = selected.size;
  document.querySelectorAll<SVGGElement>("[data-space-id]").forEach((g) => g.setAttribute("data-selected", String(selected.has(g.dataset.spaceId!))));
  document.querySelectorAll<HTMLElement>("[data-toggle-space]").forEach((b) => b.setAttribute("aria-pressed", String(selected.has(b.dataset.toggleSpace!))));
  const label = n === 0 ? "Noch keine Auswahl" : n === 1 ? "1 Bereich ausgewählt" : `${n} Bereiche ausgewählt`;
  document.querySelectorAll<HTMLElement>("[data-testid=selection-count]").forEach((el) => (el.textContent = label));
  document.querySelectorAll<HTMLElement>("[data-pv-hint]").forEach((el) => (el.hidden = n > 0));
  document.querySelectorAll<HTMLElement>("[data-pv-rule]").forEach((el) => el.remove());
  if (selectionHint) document.querySelectorAll<HTMLElement>("[data-testid=selection-count]").forEach((el) => el.insertAdjacentHTML("afterend", `<span data-pv-rule class="pv-rule" role="alert">${esc(selectionHint)}</span>`));
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
  // price box in the planner: same engine as the request dialog
  const est = selected.size ? calculateQuote({
    request: { spaceIds: [...selected], start: Date.UTC(2030, 0, 4, 17), end: Date.UTC(2030, 0, 4, 22), rentalMode: "hourly", dates: ["2030-01-04"], guestCount: null, extras: [] },
    spaces: spaces.map((s) => ({ id: s.id, name: s.name, basePrice: s.basePrice, priceModel: s.priceModel, deposit: null, cleaningFee: s.cleaningFee, minimumDurationMinutes: null, bookingMode: "inquiry" as const })),
    rules: [], bundles: [], extras: [], policy: PRICE_POLICY,
  }) : null;
  document.querySelectorAll<HTMLElement>("[data-pv-pricebox]").forEach((box) => {
    box.classList.toggle("hidden", !est);
    box.querySelector("[data-pv-net]")!.textContent = eur(est?.total ?? null);
    box.querySelector("[data-pv-vat]")!.textContent = est?.vat.amount === null || est?.vat.amount === undefined ? "–" : eur(est.vat.amount);
    box.querySelector("[data-pv-gross]")!.textContent = eur(est?.grossTotal ?? null);
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
          <div><dt>Buchung</dt><dd>${isHotel ? "Zimmer einzeln, Frühstück inkl." : !s.bookable ? "als Zusatzleistung" : s.id === "restaurant" ? "immer dabei" : "zusätzlich zum Restaurant"}</dd></div>
        </dl>
        ${facts.estimated ? `<p class="pv-small">ca.-Werte: ${esc(ESTIMATE_NOTE)}</p>` : ""}
        ${!isHotel && s.bookable ? `<p class="pv-small">${s.basePrice === null ? "Preis auf Anfrage" : `${s.id === "restaurant" ? "" : "+ "}${eur(s.basePrice)} netto je Buchung (Fr–So)`} · Toiletten inklusive.</p>` : ""}
        <div class="pv-actions">
          ${isHotel ? `<button type="button" class="pv-btn pv-btn-gold" data-hotel-book>Zimmer buchen</button>` : ""}
          ${s.bookable ? `<button type="button" class="pv-btn ${on ? "pv-btn-dark" : "pv-btn-gold"}" data-room-select="${s.id}">${selectLabel}</button>` : ""}
          ${s.bookable ? `<button type="button" class="pv-btn" data-flow data-flow-with="${s.id}">Verfügbarkeit prüfen</button>` : ""}
          ${!s.bookable && !isHotel ? `<p class="pv-small">Die Küche wird als Zusatzleistung gebucht (nur mit Caterer).</p>` : ""}
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
  endDate?: string | null;
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
    const iv = interval(r.date, r.from, r.to, r.endDate ?? null);
    for (const id of r.spaceIds) blocks.push({ id: `req-${i}-${id}`, spaceId: id, start: iv.start, end: iv.end, type: "reserved", reason: `Anfrage ${r.ref}`, bookingId: r.ref, expiresAt: null, isDemo: true });
  });
  return { profiles, blocks, now: Date.now() };
}

/** end time ≤ start time means "until the next day" (e.g. 18:00 – 01:00) */
function interval(date: string, from: string, to: string, endDate: string | null = null) {
  const last = endDate && endDate > date ? endDate : to <= from ? addDays(date, 1) : date;
  return { start: zonedDateTimeToUtc(date, from), end: zonedDateTimeToUtc(last, to) };
}
function flowDates(): string[] {
  if (!flow.date) return [];
  const out = [flow.date];
  for (let d = addDays(flow.date, 1); flow.endDate && d <= flow.endDate && out.length < 60; d = addDays(d, 1)) out.push(d);
  return out;
}
const fmtRange = (long = true) => {
  if (!flow.date) return "";
  const f = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("de-DE", long ? { weekday: "short", day: "numeric", month: "long" } : { day: "numeric", month: "short" });
  return flow.endDate && flow.endDate !== flow.date ? `${f(flow.date)} – ${f(flow.endDate)}` : long ? fmtDate(flow.date) : f(flow.date);
};

/* ------------------------------------------------------------ request flow */
type Step = 1 | 2 | 3 | 4 | 5;
const flow = {
  step: 1 as Step,
  spaces: new Set<string>(),
  date: null as string | null,
  endDate: null as string | null,
  from: "18:00",
  to: "23:00",
  month: today.slice(0, 7),
  extras: new Set<string>(),
  guests: 60,
  form: { event: "", guests: "", firstName: "", lastName: "", email: "", phone: "", message: "" },
  mode: "inquiry" as "inquiry" | "booking",
  terms: false,
  error: "",
  ref: "",
};

/** Same price engine as the website: flat package per room (Fri–Sun), add-ons, 19 % VAT. */
function quote(): Quote {
  const ids = [...flow.spaces];
  const start = flow.date ? interval(flow.date, flow.from, flow.to, flow.endDate) : { start: Date.now(), end: Date.now() + 5 * 3_600_000 };
  return calculateQuote({
    request: { spaceIds: ids, start: start.start, end: start.end, rentalMode: "hourly", dates: flowDates(), today, guestCount: flow.guests || null, extras: [...flow.extras].map((extraId) => ({ extraId, quantity: 1 })) },
    spaces: spaces.map((s) => ({ id: s.id, name: s.name, basePrice: s.basePrice, priceModel: s.priceModel, deposit: null, cleaningFee: s.cleaningFee, minimumDurationMinutes: null, bookingMode: "inquiry" as const })),
    rules: [],
    bundles: [],
    extras: extraSeeds.map((e) => ({ id: e.id, name: e.name, priceModel: e.priceModel, unitPrice: e.unitPrice, active: true, isDemo: false })),
    policy: PRICE_POLICY,
  });
}

function totalLine(q: Quote) {
  return `<p class="pv-total-line"><span>Gesamt inkl. ${q.vat.rate} % MwSt.${flow.spaces.size ? ` · ${flow.spaces.size} ${flow.spaces.size === 1 ? "Raum" : "Räume"}` : ""}${flow.extras.size ? ` · ${flow.extras.size} Zusatzleistung${flow.extras.size === 1 ? "" : "en"}` : ""}</span><strong>${eur(q.grossTotal)}</strong></p>`;
}

function priceHtml(q: Quote) {
  const rows = q.lines.filter((l) => l.kind === "rental" || l.kind === "extra").map((l) => `<div><dt>${esc(l.kind === "rental" ? `Miete ${l.label}` : l.label)}${l.detail ? `<small>${esc(l.detail)}</small>` : ""}</dt><dd>${eur(l.amount)}</dd></div>`).join("");
  return `<dl class="pv-price">${rows}
    <div class="pv-price-sum"><dt>Netto</dt><dd>${eur(q.total)}</dd></div>
    <div><dt>${q.vat.rate} % MwSt.</dt><dd>${eur(q.vat.amount)}</dd></div>
    <div class="pv-price-total"><dt>Gesamt</dt><dd>${eur(q.grossTotal)}</dd></div>
  </dl>
  <p class="pv-small">Pauschale je Raum gilt Fr–So, jeder weitere Tag + 100 € · Kaution separat · Preise zzgl. MwSt.</p>`;
}
let flowOpen = false;

const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const nameOf = (id: string) => (id === "hotel" ? "Übernachtung (Hotel)" : (byId.get(id)?.name ?? id));

function openFlow(opts: { with?: string; step?: Step } = {}) {
  flow.spaces = new Set(selected);
  if (opts.with) flow.spaces.add(opts.with);
  if (flow.spaces.size) flow.spaces.add("restaurant");
  flow.error = "";
  flow.ref = "";
  flow.step = opts.step ?? (flow.spaces.size ? 2 : 1);
  flowOpen = true;
  renderFlow();
}

function stepper() {
  const labels = ["Räume", "Termin", "Zusatzleistungen", "Ihre Angaben", "Bestätigung"];
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
    const sel = flow.date === date || flow.endDate === date;
    const inRange = !!flow.date && !!flow.endDate && date > flow.date && date < flow.endDate;
    cells.push(
      `<button type="button" class="pv-day is-${cls}${sel ? " is-sel" : ""}${inRange ? " is-range" : ""}" data-date="${date}" ${past || cls === "busy" ? "disabled" : ""} aria-label="${fmtDate(date)}: ${title}" aria-pressed="${sel}">${d}</button>`,
    );
  }
  const monthName = new Date(y, m - 1, 15).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const canPrev = flow.month > today.slice(0, 7);
  return `<div class="pv-cal">
    <div class="pv-cal-head"><button type="button" data-month="-1" ${canPrev ? "" : "disabled"} aria-label="Vorheriger Monat">‹</button><strong>${monthName}</strong><button type="button" data-month="1" aria-label="Nächster Monat">›</button></div>
    <div class="pv-cal-grid">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => `<span class="pv-wd">${w}</span>`).join("")}${cells.join("")}</div>
    <p class="pv-legend"><span class="is-free"></span>frei <span class="is-partial"></span>teilweise frei <span class="is-busy"></span>belegt</p>
    <p class="pv-small">Mehrere Tage? Erst den ersten, dann den letzten Tag antippen (z. B. Freitag → Sonntag).</p>
  </div>`;
}

function renderFlow() {
  if (!flowOpen) return;
  const ctx = context();
  let body = "";
  if (flow.step === 1) {
    const others = [...flow.spaces].some((x) => x !== "restaurant");
    body = `<h2 class="pv-h2">Welche Räume möchten Sie nutzen?</h2>
      <p class="pv-text">Das Restaurant ist bei jeder Buchung dabei – Eingang, Theke und Toiletten gehören dazu. Alle weiteren Räume buchen Sie dazu.</p>
      <div class="pv-choices">${bookable
        .map(
          (s) => `<label class="pv-choice${s.id === "restaurant" ? " is-fixed" : ""}"><input type="checkbox" data-flow-space="${s.id}" ${flow.spaces.has(s.id) || s.id === "restaurant" ? "checked" : ""} ${s.id === "restaurant" && others ? "disabled" : ""}>
          ${s.images[0] ? `<img src="${esc(s.images[0])}" alt="" loading="lazy">` : ""}<span><strong>${esc(nameOf(s.id))}</strong><small>${esc(displayFacts(s).seats)} · ${s.basePrice === null ? "auf Anfrage" : `${s.id === "restaurant" ? "" : "+ "}${eur(s.basePrice)} netto`}</small></span></label>`,
        )
        .join("")}</div>
      ${totalLine(quote())}
      <div class="pv-actions"><button type="button" class="pv-btn pv-btn-gold" data-flow-next ${flow.spaces.size ? "" : "disabled"}>Weiter zum Termin</button></div>`;
  } else if (flow.step === 2) {
    const ids = [...flow.spaces];
    let check = "";
    let ok = false;
    if (flow.date) {
      const day = selectionDayStatus(ids, flow.date, ctx);
      const res = checkSelection(ids, interval(flow.date, flow.from, flow.to, flow.endDate), ctx, { enforceBookableHours: !flow.endDate });
      ok = res.bookingAllowed;
      const windows = day.common
        .map((w) => `${new Date(w.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })}–${new Date(w.end).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })}`)
        .join(", ");
      check = `<div class="pv-check ${ok ? "is-ok" : "is-no"}" role="status">
        ${ok ? `<strong>✓ Frei.</strong> ${esc(ids.map(nameOf).join(", "))}, ${esc(fmtRange())}, ${flow.from}–${flow.to} Uhr.` : `<strong>Nicht möglich.</strong> ${esc(res.results.filter((r) => !r.available).map((r) => `${nameOf(r.spaceId)}: ${r.reason ?? "belegt"}`).join(" · "))}`}
        ${windows ? `<br><small>Gemeinsam frei an diesem Tag: ${windows} Uhr</small>` : ""}
      </div>`;
    }
    body = `<h2 class="pv-h2">Wann möchten Sie feiern?</h2>
      <p class="pv-text">Gewählt: ${esc(ids.map(nameOf).join(", "))} · <button type="button" class="pv-link" data-flow-step="1">ändern</button></p>
      <div class="pv-flow-grid">
        ${calendarHtml(ctx)}
        <div class="pv-time">
          <p class="pv-label">${flow.date ? esc(fmtRange()) : "Bitte einen Tag im Kalender wählen"}</p>
          ${flow.endDate ? `<p class="pv-small">Von ${flow.from} Uhr am ersten bis ${flow.to} Uhr am letzten Tag.</p>` : ""}
          <div class="pv-row">
            <label>Von<select data-time="from">${TIMES.map((t) => `<option ${t === flow.from ? "selected" : ""}>${t}</option>`).join("")}</select></label>
            <label>Bis<select data-time="to">${TIMES.map((t) => `<option ${t === flow.to ? "selected" : ""}>${t}</option>`).join("")}</select></label>
          </div>
          <p class="pv-small">Ende vor Beginn = bis in die Nacht (z. B. 18:00–01:00).</p>
          ${check}
        </div>
      </div>
      ${totalLine(quote())}
      <div class="pv-actions"><button type="button" class="pv-btn" data-flow-step="1">Zurück</button><button type="button" class="pv-btn pv-btn-gold" data-flow-next ${ok ? "" : "disabled"}>Weiter zu den Zusatzleistungen</button></div>`;
  } else if (flow.step === 3) {
    const q = quote();
    body = `<h2 class="pv-h2">Was brauchen Sie dazu?</h2>
      <p class="pv-text">Zusatzleistungen aus der Preisliste – alles optional.</p>
      <div class="pv-flow-grid">
        <div class="pv-choices pv-choices-list">${extraSeeds
          .map(
            (e) => `<label class="pv-choice"><input type="checkbox" data-flow-extra="${e.id}" ${flow.extras.has(e.id) ? "checked" : ""}><span><strong>${esc(e.name)}</strong><small>${esc(e.description)}</small></span><b class="pv-choice-price">${eur(e.unitPrice)}${e.priceModel === "per_person" ? " / Gast" : ""}</b></label>`,
          )
          .join("")}
          <label class="pv-guests">Gäste (für Gläser, Geschirr &amp; Besteck)<input type="number" min="1" max="200" data-flow-guests value="${flow.guests}"></label>
        </div>
        <div>${priceHtml(q)}</div>
      </div>
      <div class="pv-actions"><button type="button" class="pv-btn" data-flow-step="2">Zurück</button><button type="button" class="pv-btn pv-btn-gold" data-flow-next>Weiter zu Ihren Angaben</button></div>`;
  } else if (flow.step === 4) {
    const f = flow.form;
    if (!f.guests) f.guests = String(flow.guests);
    body = `<h2 class="pv-h2">Ihre Angaben</h2>
      <p class="pv-text">${esc([...flow.spaces].map(nameOf).join(", "))} · ${esc(fmtRange())}, ${flow.from}–${flow.to} Uhr</p>
      ${totalLine(quote())}
      <form class="pv-form" data-flow-form novalidate>
        <label>Anlass<select name="event"><option value="">Bitte wählen</option>${eventTypes.map((e) => `<option value="${e.id}" ${f.event === e.id ? "selected" : ""}>${e.label}</option>`).join("")}</select></label>
        <label>Gäste (ca.)<input name="guests" type="number" min="1" inputmode="numeric" value="${esc(f.guests)}"></label>
        <label>Vorname *<input name="firstName" required autocomplete="given-name" value="${esc(f.firstName)}"></label>
        <label>Nachname *<input name="lastName" required autocomplete="family-name" value="${esc(f.lastName)}"></label>
        <label>E-Mail *<input name="email" type="email" required autocomplete="email" value="${esc(f.email)}"></label>
        <label>Telefon *<input name="phone" type="tel" required autocomplete="tel" value="${esc(f.phone)}"></label>
        <label class="pv-span">Nachricht<textarea name="message" rows="3">${esc(f.message)}</textarea></label>
        ${flow.error ? `<p class="pv-error pv-span" role="alert">${esc(flow.error)}</p>` : ""}
        <label class="pv-span pv-check-row"><input type="checkbox" name="terms" ${flow.terms ? "checked" : ""}> Ich habe die <button type="button" class="pv-link" data-legal="datenschutz">Datenschutzerklärung</button> gelesen.</label>
        <div class="pv-actions pv-span"><button type="button" class="pv-btn" data-flow-step="3">Zurück</button><button type="submit" name="mode" value="inquiry" class="pv-btn pv-btn-gold">Anfrage senden</button></div>
        <p class="pv-small pv-span">Die Krone prüft Ihre Anfrage und bestätigt persönlich. Vorschau: Es wird nichts versendet.</p>
      </form>`;
  } else {
    const q = quote();
    body = `<div class="pv-done">
      <p class="pv-eyebrow">Anfrage eingegangen</p>
      <h2 class="pv-h2">Vielen Dank, ${esc(flow.form.firstName)}!</h2>
      <p class="pv-ref">Ihre Anfragenummer <strong>${esc(flow.ref)}</strong></p>
      <p class="pv-text">Ihre Anfrage ist eingegangen und die Räume sind für Sie vorgemerkt. Die Krone meldet sich kurzfristig – bei Zusage telefonisch wegen Schlüsselübergabe und Kaution.</p>
      <h3 class="pv-h3">Voraussichtlicher Preis</h3>
      ${priceHtml(q)}
      <dl class="pv-facts">
        <div><dt>Bereiche</dt><dd>${esc([...flow.spaces].map(nameOf).join(", "))}</dd></div>
        <div><dt>Termin</dt><dd>${esc(fmtRange())}<br>${flow.from}–${flow.to} Uhr</dd></div>
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
    document.querySelectorAll<HTMLElement>("[data-flow-at=date] .truncate").forEach((el) => (el.textContent = `${flow.endDate ? fmtRange(false) : short} · ${flow.from}–${flow.to}`));
  }
}

function submitFlow(form: HTMLFormElement, submitter?: HTMLElement | null) {
  const fd = new FormData(form, submitter ?? undefined);
  for (const k of Object.keys(flow.form) as Array<keyof typeof flow.form>) flow.form[k] = String(fd.get(k) ?? "").trim();
  flow.mode = fd.get("mode") === "booking" ? "booking" : "inquiry";
  flow.terms = !!fd.get("terms");
  if (!flow.form.firstName || !flow.form.lastName) flow.error = "Bitte geben Sie Vor- und Nachnamen an.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(flow.form.email)) flow.error = "Bitte geben Sie eine gültige E-Mail-Adresse an.";
  else if (flow.form.phone.replace(/\D/g, "").length < 6) flow.error = "Bitte geben Sie eine Telefonnummer an, unter der wir Sie erreichen.";
  else if (!flow.terms) flow.error = "Bitte bestätigen Sie, dass Sie die Datenschutzerklärung gelesen haben.";
  else flow.error = "";
  if (flow.error || !flow.date) return renderFlow();
  // final check right before saving (another request could have taken the slot)
  const ids = [...flow.spaces];
  const res = checkSelection(ids, interval(flow.date, flow.from, flow.to, flow.endDate), context(), { enforceBookableHours: !flow.endDate });
  if (!res.bookingAllowed) {
    flow.step = 2;
    return renderFlow();
  }
  flow.mode = "inquiry";
  flow.ref = generateBookingNumber("inquiry", Number(flow.date.slice(0, 4)));
  requests = [...requests, { ref: flow.ref, spaceIds: ids, date: flow.date, endDate: flow.endDate, from: flow.from, to: flow.to, name: `${flow.form.firstName} ${flow.form.lastName}`, guests: flow.form.guests, event: flow.form.event }];
  saveRequests(requests);
  flow.step = 5;
  renderFlow();
}

/* ------------------------------------------------------------- hotel flow */
const HOTEL_KEY = "krone-preview-hotel-v1";
interface StoredStay extends RoomReservationLike {
  ref: string;
  name: string;
}
function loadStays(): StoredStay[] {
  try {
    return JSON.parse(localStorage.getItem(HOTEL_KEY) ?? "[]") as StoredStay[];
  } catch {
    return [];
  }
}
let stays = loadStays();
const hotel: { arrival: string | null; departure: string | null; counts: Record<string, number>; guests: number; name: string; email: string; error: string; ref: string; month: string; lines: Array<{ rooms: number; name: string }>; total: number | null } = {
  arrival: addDays(today, 7),
  departure: addDays(today, 9),
  counts: { double: 1 },
  guests: 2,
  name: "",
  email: "",
  error: "",
  ref: "",
  month: addDays(today, 7).slice(0, 7),
  lines: [],
  total: null,
};
const hotelStay = () => (hotel.arrival && hotel.departure ? { arrival: hotel.arrival, departure: hotel.departure } : null);
const hotelItems = () => roomTypeSeeds.map((t) => ({ roomTypeId: t.id, rooms: hotel.counts[t.id] ?? 0 })).filter((i) => i.rooms > 0);

function hotelSetCount(id: string, n: number) {
  const stay = hotelStay();
  const type = roomTypeSeeds.find((t) => t.id === id)!;
  const free = stay ? freeRooms(id, stay, stays) : roomInventory[type.inventoryGroup] ?? 1;
  const next = Math.max(0, Math.min(n, free));
  hotel.counts = { ...hotel.counts, [id]: next };
  if (id === "floor" && next > 0) for (const t of roomTypeSeeds) if (t.id !== "floor") hotel.counts[t.id] = 0;
  if (id !== "floor" && next > 0) hotel.counts.floor = 0;
}

/** Arrival/departure like on the booking portals: first tap arrival, second tap departure. */
function hotelPick(date: string) {
  if (!hotel.arrival || hotel.departure || date <= hotel.arrival) {
    hotel.arrival = date;
    hotel.departure = null;
    return;
  }
  hotel.departure = date;
}

function stayCalendarHtml(monthKey: string, full: Set<string>) {
  const [y, m] = monthKey.split("-").map(Number) as [number, number];
  const first = `${monthKey}-01`;
  const daysInMonth = new Date(y, m, 0).getDate();
  const lead = isoWeekday(first) - 1;
  const cells: string[] = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="pv-day pv-day-empty"></span>');
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${monthKey}-${String(d).padStart(2, "0")}`;
    const past = date < today;
    const isFull = full.has(date);
    const sel = date === hotel.arrival || date === hotel.departure;
    const inRange = !!hotel.arrival && !!hotel.departure && date > hotel.arrival && date < hotel.departure;
    const disabled = past || (isFull && !(hotel.arrival && !hotel.departure && date > hotel.arrival));
    cells.push(`<button type="button" class="pv-day is-${past ? "past" : isFull ? "busy" : "free"}${sel ? " is-sel" : ""}${inRange ? " is-range" : ""}" data-stay-date="${date}" ${disabled ? "disabled" : ""} aria-pressed="${sel}" aria-label="${fmtDate(date)}${isFull ? ": ausgebucht" : ""}">${d}</button>`);
  }
  const monthName = new Date(y, m - 1, 15).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  return `<div class="pv-stay-month"><strong>${monthName}</strong><div class="pv-cal-grid">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => `<span class="pv-wd">${w}</span>`).join("")}${cells.join("")}</div></div>`;
}

function renderHotel() {
  const stay = hotelStay();
  const issues = stay ? validateStay(stay, today) : [];
  const nights = stay ? nightCount(stay.arrival, stay.departure) : 0;
  const items = hotelItems();
  const quote = stay ? stayQuote(items, stay) : null;
  const maxGuests = Math.max(1, quote?.maxGuests ?? 1);
  if (hotel.guests > maxGuests) hotel.guests = maxGuests;
  const nudges = stay && !issues.length && items.length ? stayNudges(items, stay, hotel.guests) : [];
  const shortfall = stay ? items.some((i) => freeRooms(i.roomTypeId, stay, stays) < i.rooms) : false;
  if (hotel.ref) {
    return openDialog(`<p class="pv-eyebrow">Zimmeranfrage eingegangen</p><h2 class="pv-h2">Vielen Dank, ${esc(hotel.name.split(" ")[0] ?? "")}!</h2>
      <p class="pv-ref">Ihre Reservierungsnummer <strong>${esc(hotel.ref)}</strong></p>
      <dl class="pv-facts"><div><dt>Zimmer</dt><dd>${hotel.lines.map((l) => `${l.rooms} × ${esc(l.name)}`).join(", ")}</dd></div><div><dt>Aufenthalt</dt><dd>${esc(fmtDate(hotel.arrival!))} – ${esc(fmtDate(hotel.departure!))} (${nights} Nächte)</dd></div><div><dt>Preis inkl. Frühstück</dt><dd>${eur(hotel.total)}</dd></div></dl>
      <p class="pv-text">Die Krone prüft die Zimmer und bestätigt persönlich per E-Mail. Vorschau: nichts wird versendet; die Zimmer gelten in diesem Browser als belegt.</p>
      <div class="pv-actions"><button type="button" class="pv-btn pv-btn-gold" data-close>Fertig</button></div>`, { label: "Zimmeranfrage" });
  }
  // nights where no room of any type is free – struck through
  const from = today < (hotel.month + "-01") ? hotel.month + "-01" : today;
  const to = addDays(from, 70);
  const sets = roomTypeSeeds.filter((t) => t.id !== "floor").map((t) => fullyBookedNights(t.id, from, to, stays));
  const full = new Set([...sets[0]!].filter((n) => sets.every((s) => s.has(n))));
  const [y, m] = hotel.month.split("-").map(Number) as [number, number];
  const next = new Date(y, m, 15);
  const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  openDialog(`<p class="pv-eyebrow">${esc(hotelCopy.eyebrow)}</p><h2 class="pv-h2">${esc(hotelCopy.title)}</h2><p class="pv-text">${esc(hotelCopy.text)}</p>
    <div class="pv-row pv-stay-dates"><div class="pv-stay-date${hotel.arrival && !hotel.departure ? "" : " is-active"}"><small>Anreise</small><strong data-hotel-arrival>${hotel.arrival ? esc(fmtDate(hotel.arrival)) : "–"}</strong></div><div class="pv-stay-date${hotel.arrival && !hotel.departure ? " is-active" : ""}"><small>Abreise</small><strong data-hotel-departure>${hotel.departure ? esc(fmtDate(hotel.departure)) : "–"}</strong></div></div>
    <div class="pv-cal pv-stay-cal">
      <div class="pv-cal-head"><button type="button" data-stay-month="-1" ${hotel.month > today.slice(0, 7) ? "" : "disabled"} aria-label="Vorheriger Monat">‹</button><span class="pv-small">${!hotel.arrival ? "Anreisetag wählen" : !hotel.departure ? "Jetzt den Abreisetag wählen" : "Erneut tippen, um neu zu wählen"}</span><button type="button" data-stay-month="1" aria-label="Nächster Monat">›</button></div>
      <div class="pv-stay-months">${stayCalendarHtml(hotel.month, full)}${stayCalendarHtml(nextKey, full)}</div>
    </div>
    <p class="pv-small">${!stay ? "Erst Anreise, dann Abreise antippen." : issues.includes("past") ? "Die Anreise liegt in der Vergangenheit." : `${nights} ${nights === 1 ? "Nacht" : "Nächte"} · ${esc(hotelCopy.checkIn)}`}</p>
    <div class="pv-choices pv-choices-list pv-room-list">${roomTypeSeeds
      .map((r) => {
        const f = stay ? freeRooms(r.id, stay, stays) : roomInventory[r.inventoryGroup] ?? 1;
        const n = hotel.counts[r.id] ?? 0;
        return `<div class="pv-choice pv-room${f === 0 ? " is-off" : ""}${n > 0 ? " is-on" : ""}" data-testid="room-${r.id}"><span><strong>${esc(r.name)}</strong><small>${esc(r.description)} · ${f === 0 ? "belegt" : r.id === "floor" ? "exklusiv" : `${f} von ${roomInventory[r.inventoryGroup]} frei`}</small><b class="pv-choice-price">${r.basePricePerNight === null ? "auf Anfrage" : `${eur(r.basePricePerNight)} / Nacht`}${r.id === "floor" ? `<small>statt 936 € einzeln + Apartment</small>` : ""}</b></span>
          <span class="pv-stepper" role="group" aria-label="${esc(r.name)}: Anzahl"><button type="button" data-room-minus="${r.id}" ${n === 0 ? "disabled" : ""} aria-label="${esc(r.name)} entfernen">−</button><b data-room-count="${r.id}">${n}</b><button type="button" data-room-plus="${r.id}" ${f === 0 || n >= f ? "disabled" : ""} aria-label="${esc(r.name)} hinzufügen">+</button></span></div>`;
      })
      .join("")}</div>
    <form class="pv-form" data-hotel-form novalidate>
      <label>Gäste<select name="guests" data-hotel="guests">${Array.from({ length: maxGuests }, (_, i) => `<option ${i + 1 === hotel.guests ? "selected" : ""}>${i + 1}</option>`).join("")}</select></label>
      <label>Name *<input name="name" required value="${esc(hotel.name)}"></label>
      <label>E-Mail *<input name="email" type="email" required value="${esc(hotel.email)}"></label>
      <div class="pv-span pv-stay-sum">${quote ? quote.lines.map((l) => `<p><span>${l.rooms} × ${esc(l.name)}</span><span>${l.pricing ? eur(l.pricing.list) : "auf Anfrage"}</span></p>`).join("") : ""}${!items.length ? `<p class="pv-small">Noch kein Zimmer gewählt.</p>` : ""}${quote && quote.discount > 0 ? `<p class="pv-good"><span>Langzeit-Vorteil −${quote.discountPercent} %</span><span>−${eur(quote.discount)}</span></p>` : ""}</div>
      <p class="pv-span pv-price-total pv-hotel-total"><span>Gesamt inkl. Frühstück${nights ? ` · ${nights} ${nights === 1 ? "Nacht" : "Nächte"}` : ""}</span><strong>${items.length ? eur(quote?.total ?? null) : "–"}</strong></p>
      ${nudges.map((n) => `<p class="pv-span pv-tip">${esc(n)}</p>`).join("")}
      ${hotel.error ? `<p class="pv-error pv-span" role="alert">${esc(hotel.error)}</p>` : ""}
      <div class="pv-actions pv-span"><button type="submit" class="pv-btn pv-btn-gold" ${!stay || issues.length || !items.length || shortfall || validateItems(items).length ? "disabled" : ""}>${items.length > 1 ? `${quote?.rooms ?? 0} Zimmer anfragen` : "Zimmer anfragen"}</button></div>
      <p class="pv-small pv-span">Unverbindlich – die Krone bestätigt persönlich. Bezahlt wird vor Ort.</p>
    </form>`, { wide: true, label: "Zimmer buchen" });
}

function submitHotel(form: HTMLFormElement) {
  const fd = new FormData(form);
  hotel.name = String(fd.get("name") ?? "").trim();
  hotel.email = String(fd.get("email") ?? "").trim();
  hotel.guests = Number(fd.get("guests")) || 1;
  const stay = hotelStay();
  const items = hotelItems();
  if (!stay) hotel.error = "Bitte wählen Sie An- und Abreise im Kalender.";
  else if (!items.length) hotel.error = "Bitte wählen Sie mindestens ein Zimmer.";
  else if (!hotel.name) hotel.error = "Bitte geben Sie Ihren Namen an.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hotel.email)) hotel.error = "Bitte geben Sie eine gültige E-Mail-Adresse an.";
  else if (items.some((i) => freeRooms(i.roomTypeId, stay, stays) < i.rooms)) hotel.error = "In diesem Zeitraum sind nicht mehr genug Zimmer frei.";
  else hotel.error = "";
  if (hotel.error || !stay) return renderHotel();
  const quote = stayQuote(items, stay);
  hotel.ref = generateReservationNumber(Number(stay.arrival.slice(0, 4)));
  hotel.lines = quote.lines.map((l) => ({ rooms: l.rooms, name: l.name }));
  hotel.total = quote.total;
  stays = [...stays, ...items.map((i) => ({ ref: hotel.ref, name: hotel.name, roomTypeId: i.roomTypeId, arrivalDate: stay.arrival, departureDate: stay.departure, rooms: i.rooms, status: "requested" }) as StoredStay)];
  try {
    localStorage.setItem(HOTEL_KEY, JSON.stringify(stays));
  } catch {
    /* private mode */
  }
  renderHotel();
}

/* --------------------------------------------------------- legal on top */
/** Legal text as a layer above the current dialog: "Zurück" returns to the request with every input kept. */
function openLegal(doc: { title: string; html: string }) {
  const under = document.querySelector<HTMLElement>(".pv-dialog:not(.pv-dialog-top)");
  if (under) {
    // keep what the visitor typed so far
    under.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("[data-flow-form] [name]").forEach((el) => {
      if (el.name in flow.form) (flow.form as Record<string, string>)[el.name] = el.value;
      if (el.name === "terms") flow.terms = (el as HTMLInputElement).checked;
    });
    const html = `<div class="pv-legal">${doc.html}</div>`;
    const layer = document.createElement("div");
    layer.className = "pv-dialog pv-dialog-top";
    layer.innerHTML = `<div class="pv-backdrop" data-legal-back></div><div class="pv-card pv-card-wide" role="dialog" aria-modal="true" aria-label="${esc(doc.title)}" tabindex="-1">
      <button type="button" class="pv-back" data-legal-back>‹ Zurück zur Anfrage</button>${html}
      <div class="pv-actions"><button type="button" class="pv-btn pv-btn-gold" data-legal-back>Zurück zur Anfrage</button></div></div>`;
    document.body.appendChild(layer);
    layer.querySelector<HTMLElement>(".pv-card")!.focus();
    return;
  }
  openDialog(`<div class="pv-legal">${doc.html}</div>`, { wide: true, label: doc.title });
}
function closeTopLayer() {
  const top = document.querySelector(".pv-dialog-top");
  if (top) {
    top.remove();
    document.querySelector<HTMLElement>(".pv-dialog .pv-card")?.focus();
  } else closeDialog();
}

/* ----------------------------------------------------------- full gallery */
function openGalleryAll() {
  const groups = spaces.filter((s) => s.images.length);
  openDialog(
    `<p class="pv-eyebrow">Galerie</p><h2 class="pv-h2">Die Krone in Bildern</h2>
    ${groups
      .map(
        (s) => `<h3 class="pv-h3">${esc(s.name)}</h3><div class="pv-grid">${s.images
          .map((src, i) => `<button type="button" class="pv-grid-item" data-room="${s.slug}" data-room-index="${i}" aria-label="${esc(s.name)} – Bild ${i + 1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`)
          .join("")}</div>`,
      )
      .join("")}
    <div class="pv-actions"><button type="button" class="pv-btn" data-close>Schließen</button></div>`,
    { wide: true, label: "Galerie" },
  );
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
    if ((hit = t("[data-close]"))) return hit.closest(".pv-dialog-top") ? closeTopLayer() : closeDialog();
    if ((hit = t("[data-img]"))) return showImage(Number(hit.dataset.img));
    if ((hit = t("[data-room-select]"))) {
      toggle(hit.dataset.roomSelect!);
      return room && openRoom(room.slug, room.index);
    }
    if ((hit = t("[data-remove]"))) return toggle(hit.dataset.remove!, false);
    if ((hit = t("[data-room]"))) {
      e.preventDefault();
      return openRoom(hit.dataset.room!, Number(hit.dataset.roomIndex ?? 0));
    }
    if ((hit = t("[data-gallery-all]"))) {
      e.preventDefault();
      return openGalleryAll();
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
      flow.endDate = null;
      return openFlow({ step: 2 });
    }
    if ((hit = t("[data-date]"))) {
      const d = hit.dataset.date!;
      // first click = start, second click on a later day = end, any other click starts over
      if (flow.date && !flow.endDate && d > flow.date) flow.endDate = d;
      else {
        flow.date = d;
        flow.endDate = null;
      }
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
    if ((hit = t("[data-legal-back]"))) return closeTopLayer();
    if ((hit = t("[data-legal]"))) {
      e.preventDefault();
      const doc = data.legal?.[hit.dataset.legal!];
      if (doc) return openLegal(doc);
    }
    if ((hit = t("[data-page]"))) {
      e.preventDefault();
      return openInfo(hit.dataset.page!, "Diese Seite ist in der Vorschau nicht enthalten. Rechtstexte und weitere Unterseiten werden vor dem Start vom Betreiber ergänzt.");
    }
    if ((hit = t("[data-stay-date]"))) {
      hotelPick(hit.dataset.stayDate!);
      hotel.error = "";
      return renderHotel();
    }
    if ((hit = t("[data-stay-month]"))) {
      const [y, m] = hotel.month.split("-").map(Number) as [number, number];
      const d = new Date(y, m - 1 + Number(hit.dataset.stayMonth), 15);
      hotel.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return renderHotel();
    }
    if ((hit = t("[data-room-plus]"))) {
      hotelSetCount(hit.dataset.roomPlus!, (hotel.counts[hit.dataset.roomPlus!] ?? 0) + 1);
      return renderHotel();
    }
    if ((hit = t("[data-room-minus]"))) {
      hotelSetCount(hit.dataset.roomMinus!, (hotel.counts[hit.dataset.roomMinus!] ?? 0) - 1);
      return renderHotel();
    }
    if ((hit = t("[data-hotel-book]"))) {
      hotel.ref = "";
      hotel.error = "";
      return renderHotel();
    }
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
      if ((el as HTMLInputElement).checked) {
        flow.spaces.add(el.dataset.flowSpace);
        flow.spaces.add("restaurant");
      } else if (el.dataset.flowSpace === "restaurant" && [...flow.spaces].some((x) => x !== "restaurant")) {
        flow.error = "Das Restaurant ist bei jeder Buchung dabei.";
      } else flow.spaces.delete(el.dataset.flowSpace);
      return renderFlow();
    }
    if (el.dataset.flowExtra) {
      if ((el as HTMLInputElement).checked) flow.extras.add(el.dataset.flowExtra);
      else flow.extras.delete(el.dataset.flowExtra);
      return renderFlow();
    }
    if (el.dataset.flowGuests !== undefined) {
      flow.guests = Math.max(1, Number(el.value) || 1);
      return renderFlow();
    }
    if (el.dataset.toggleList) return toggle(el.dataset.toggleList, (el as HTMLInputElement).checked);
    if (el.dataset.hotel === "guests") {
      hotel.guests = Number(el.value) || 1;
      return renderHotel();
    }
    if (el.dataset.time === "from" || el.dataset.time === "to") {
      flow[el.dataset.time] = el.value;
      return renderFlow();
    }
  });
  document.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    if (form.matches("[data-flow-form]")) return submitFlow(form, (e as SubmitEvent).submitter);
    if (form.matches("[data-hotel-form]")) return submitHotel(form);
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
      if (document.querySelector(".pv-dialog-top")) closeTopLayer();
      else closeDialog();
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
