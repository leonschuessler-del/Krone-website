/**
 * Static preview: the real booking engine (React) mounted into the snapshot
 * of /hotel/buchen with a local stand-in for the API – availability from the
 * domain logic, reservations kept in the viewer's browser (localStorage).
 */
import { createRoot } from "react-dom/client";
import manifest from "@/generated/media-manifest.json";
import { guestRoomTypes, roomInventory } from "@/content/hotel";
import { BookingEngine } from "@/features/hotel/engine/BookingEngine";
import type { EngineApi, EngineRoom, ReserveResult } from "@/features/hotel/engine/types";
import { freeRooms, fullyBookedNights, generateReservationNumber, nightCount, stayPricing, validateStay, type RoomReservationLike } from "@/domain/hotel";
import { addDays, todayLocal } from "@/domain/time";

const KEY = "krone-preview-hotel-v2";
const files = new Set<string>(manifest.files);
const rel = (src: string) => (src.startsWith("/") ? src.slice(1) : src);

interface StoredStay extends RoomReservationLike {
  ref: string;
}
function load(): StoredStay[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as StoredStay[];
  } catch {
    return [];
  }
}

function rooms(): EngineRoom[] {
  const gallery = Array.from({ length: 24 }, (_, i) => `/media/hotel/gallery-${String(i + 1).padStart(2, "0")}.webp`).filter((f) => files.has(f));
  return guestRoomTypes.map((t) => {
    const photo = files.has(t.image) ? rel(t.image) : null;
    const others = gallery.filter((g) => g !== t.image).map((g) => ({ src: rel(g), alt: `${t.name} – Bild` }));
    const all = [...(photo ? [{ src: photo, alt: t.name }] : []), ...others];
    return { ...t, photo, gallery: t.id === "apartment" ? all.slice(0, 1) : all };
  });
}

const api: EngineApi = {
  async availability(arrival, departure) {
    const today = todayLocal();
    const stays = load();
    const issues = validateStay({ arrival, departure }, today);
    const from = today < arrival ? today : arrival;
    const to = addDays(departure > from ? departure : from, 62);
    return {
      nights: nightCount(arrival, departure),
      issues,
      types: guestRoomTypes.map((t) => ({
        id: t.id,
        free: issues.length ? 0 : freeRooms(t.id, { arrival, departure }, stays),
        totalRooms: roomInventory[t.inventoryGroup] ?? 0,
        pricePerNight: t.basePricePerNight,
        fullNights: [...fullyBookedNights(t.id, from, to, stays)],
        total: stayPricing(t.id, { arrival, departure }, 1)?.total ?? null,
      })),
    };
  },
  async reserve(input): Promise<ReserveResult> {
    const stays = load();
    const stay = { arrival: input.arrival, departure: input.departure };
    for (const it of input.items) {
      const free = freeRooms(it.roomTypeId, stay, stays);
      if (free < it.rooms) return { ok: false, message: `${guestRoomTypes.find((t) => t.id === it.roomTypeId)?.name ?? "Zimmer"}: nur noch ${free} frei.` };
    }
    const ref = generateReservationNumber(Number(input.arrival.slice(0, 4)));
    const nights = nightCount(input.arrival, input.departure);
    let total: number | null = 0;
    const lines = input.items.map((it) => {
      const t = guestRoomTypes.find((x) => x.id === it.roomTypeId)!;
      if (t.basePricePerNight === null) total = null;
      else if (total !== null) total += t.basePricePerNight * nights * it.rooms;
      return { roomTypeId: it.roomTypeId, rooms: it.rooms, name: t.name };
    });
    try {
      localStorage.setItem(KEY, JSON.stringify([...stays, ...input.items.map((it) => ({ ref, roomTypeId: it.roomTypeId, arrivalDate: input.arrival, departureDate: input.departure, rooms: it.rooms, status: "requested" as const }))]));
    } catch {
      /* private mode */
    }
    const payment: ReserveResult extends { ok: true; payment: infer P } ? P : never = input.payment === "hotel" ? { provider: "none" } : { provider: "demo", status: input.payment === "online" ? "paid" : "guaranteed" };
    return { ok: true, reservationNumber: ref, total, lines, payment };
  },
};

export function mountPreviewEngine(_ctx: { legal?: Record<string, { title: string; html: string }> }) {
  const host = document.querySelector<HTMLElement>("[data-pv-engine]");
  if (!host) return;
  // legal links inside the engine open the preview's legal layer
  host.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href='#agb'], a[href='#datenschutz']");
    if (!a) return;
    e.preventDefault();
    const slug = a.getAttribute("href")!.slice(1);
    document.querySelector<HTMLElement>(`[data-legal='${slug}']`)?.click();
  });
  const note = document.createElement("p");
  note.className = "pv-small pv-engine-note";
  note.textContent = "Vorschau: Verfügbarkeit und Reservierungen gelten nur in diesem Browser – es wird nichts versendet, kein Geld bewegt.";
  host.after(note);
  createRoot(host).render(<BookingEngine rooms={rooms()} api={api} paymentProvider="demo" initialQuery={window.location.search.slice(1)} links={{ agb: "#agb", datenschutz: "#datenschutz", home: "index.html" }} />);
}
