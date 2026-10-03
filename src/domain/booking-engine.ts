import { guestRoomTypes, roomInventory, stayExtras, type RoomTypeSeed } from "@/content/hotel";
import { defaultRateId, ratePlanById } from "@/content/rates";
import { nightCount, nightsBetween, roomTypeById, stayExtraLines, stayExtrasTotal, type StayItem } from "./hotel";
import type { LocalDate } from "./time";

/**
 * Booking engine (the "Fontenay" flow): search → rooms → cart → checkout.
 * Pure functions shared by the page, the static preview and the tests.
 *
 *  - the calendar shows the best available price per night
 *  - a cart holds one entry per room (a guest adds a second room with
 *    "Zimmer hinzufügen"); on submit the entries fold into the request format
 *    the API already knows (one line per room type)
 *  - filters and sorting work on the room types + live availability
 */

export interface GuestCount {
  adults: number;
  children: number;
}
export const totalGuests = (g: GuestCount) => Math.max(1, g.adults + g.children);

/** What the availability API returns per room type (subset the engine needs). */
export interface AvailabilityType {
  id: string;
  free: number;
  totalRooms: number;
  pricePerNight: number | null;
  /** nights without a free room of this type (calendar range) */
  fullNights: string[];
}

export type RoomTypeInfo = Pick<RoomTypeSeed, "id" | "name" | "maxGuests" | "basePricePerNight" | "sortOrder" | "features" | "bedKind" | "inventoryGroup">;

export const engineRoomTypes: RoomTypeSeed[] = guestRoomTypes;
export { roomTypeById };

/** Cheapest price for one night over all room types that still have a room that night. */
export function bestNightlyPrice(night: LocalDate, types: readonly AvailabilityType[] | null, seeds: readonly RoomTypeInfo[] = engineRoomTypes): number | null {
  let best: number | null = null;
  for (const t of seeds) {
    if (t.basePricePerNight === null) continue;
    const live = types?.find((x) => x.id === t.id);
    if (live && live.fullNights.includes(night)) continue;
    if (best === null || t.basePricePerNight < best) best = t.basePricePerNight;
  }
  return best;
}

/** Nights where no room of any type is free – nothing can be booked across them. */
export function houseFullNights(types: readonly AvailabilityType[] | null): Set<LocalDate> {
  if (!types) return new Set();
  const sets = types.filter((t) => t.id !== "floor" && t.totalRooms > 0).map((t) => new Set(t.fullNights));
  const first = sets[0];
  if (!first) return new Set();
  return new Set([...first].filter((n) => sets.every((s) => s.has(n))));
}

/** "Ab 204 € gesamt für 3 Nächte": cheapest room type that is free on every night of the stay. */
export function cheapestStayTotal(arrival: LocalDate, departure: LocalDate, types: readonly AvailabilityType[] | null, seeds: readonly RoomTypeInfo[] = engineRoomTypes): { total: number; nights: number } | null {
  const nights = nightsBetween(arrival, departure);
  if (!nights.length) return null;
  let best: number | null = null;
  for (const t of seeds) {
    if (t.basePricePerNight === null) continue;
    const live = types?.find((x) => x.id === t.id);
    if (live && (live.free === 0 || nights.some((n) => live.fullNights.includes(n)))) continue;
    const total = t.basePricePerNight * nights.length;
    if (best === null || total < best) best = total;
  }
  return best === null ? null : { total: best, nights: nights.length };
}

/* ----------------------------------------------------------------------------
 * Cart
 * ------------------------------------------------------------------------- */

export interface CartItem {
  id: string;
  roomTypeId: string;
  rateId: string;
  adults: number;
  children: number;
  /** extras for this room: id → quantity (per night) */
  extras: Record<string, number>;
  /** name of the guest staying in this room (second room onwards) */
  guestName?: string;
}

export interface Cart {
  arrival: LocalDate;
  departure: LocalDate;
  items: CartItem[];
}

export const CART_MAX_ROOMS = 8;

export function newCartItem(roomTypeId: string, guests: GuestCount, rateId = defaultRateId, id = Math.random().toString(36).slice(2, 10)): CartItem {
  const type = roomTypeById(roomTypeId);
  const cap = type?.maxGuests ?? 2;
  const adults = Math.max(1, Math.min(guests.adults, cap));
  const children = Math.max(0, Math.min(guests.children, cap - adults));
  return { id, roomTypeId, rateId, adults, children, extras: {} };
}

/** Rooms per type already in the cart – to cap the counter at the free rooms. */
export function roomsInCart(cart: Cart, roomTypeId: string): number {
  return cart.items.filter((i) => i.roomTypeId === roomTypeId).length;
}

export function canAddRoom(cart: Cart | null, roomTypeId: string, types: readonly AvailabilityType[] | null): { ok: boolean; reason?: string } {
  const type = roomTypeById(roomTypeId);
  if (!type) return { ok: false, reason: "Unbekannter Zimmertyp." };
  if (cart && cart.items.length >= CART_MAX_ROOMS) return { ok: false, reason: `Mehr als ${CART_MAX_ROOMS} Zimmer bitte persönlich anfragen.` };
  const live = types?.find((t) => t.id === roomTypeId);
  // double and double-single share the inventory
  const groupInCart = cart ? cart.items.filter((i) => roomTypeById(i.roomTypeId)?.inventoryGroup === type.inventoryGroup).length : 0;
  const free = live ? live.free : (roomInventory[type.inventoryGroup] ?? 1);
  if (groupInCart >= free) return { ok: false, reason: free === 0 ? "In diesem Zeitraum ausgebucht." : `Es ${free === 1 ? "ist" : "sind"} nur ${free} Zimmer dieser Art frei.` };
  return { ok: true };
}

export interface CartLine {
  item: CartItem;
  name: string;
  rateName: string;
  nights: number;
  perNight: number | null;
  roomTotal: number | null;
  extraLines: ReturnType<typeof stayExtraLines>;
  extrasTotal: number;
  /** room + extras, null = on request */
  total: number | null;
  guests: number;
}

export interface CartTotals {
  nights: number;
  lines: CartLine[];
  rooms: number;
  guests: number;
  /** null when any line is "on request" */
  total: number | null;
  onRequest: boolean;
}

export function cartTotals(cart: Cart): CartTotals {
  const nights = nightCount(cart.arrival, cart.departure);
  const lines: CartLine[] = cart.items.map((item) => {
    const type = roomTypeById(item.roomTypeId);
    const perNight = type?.basePricePerNight ?? null;
    const roomTotal = perNight === null ? null : perNight * nights;
    const extraLines = stayExtraLines(item.extras, nights);
    const extrasTotal = stayExtrasTotal(extraLines);
    return {
      item,
      name: type?.name ?? item.roomTypeId,
      rateName: ratePlanById(item.rateId)?.name ?? "",
      nights,
      perNight,
      roomTotal,
      extraLines,
      extrasTotal,
      total: roomTotal === null ? null : roomTotal + extrasTotal,
      guests: item.adults + item.children,
    };
  });
  const onRequest = lines.some((l) => l.total === null);
  return {
    nights,
    lines,
    rooms: lines.length,
    guests: lines.reduce((a, l) => a + l.guests, 0),
    total: onRequest ? null : lines.reduce((a, l) => a + (l.total ?? 0), 0),
    onRequest,
  };
}

/** Average per night over the whole cart (shown in the cart like the big engines do). */
export function averagePerNight(totals: CartTotals): number | null {
  if (totals.total === null || !totals.nights) return null;
  return Math.round(totals.total / totals.nights);
}

export interface ReservationPayload {
  items: StayItem[];
  arrival: LocalDate;
  departure: LocalDate;
  guests: number;
  extras: Array<{ id: string; quantity: number }>;
  /** per-room guest names and wishes, appended to the notes */
  roomNotes: string[];
}

/** Folds the cart into the request the API knows: one line per room type, extras summed. */
export function cartToReservation(cart: Cart): ReservationPayload {
  const byType = new Map<string, number>();
  for (const i of cart.items) byType.set(i.roomTypeId, (byType.get(i.roomTypeId) ?? 0) + 1);
  const extras = new Map<string, number>();
  for (const i of cart.items) for (const [id, q] of Object.entries(i.extras)) if (q > 0) extras.set(id, (extras.get(id) ?? 0) + q);
  const roomNotes = cart.items.map((i, n) => {
    const type = roomTypeById(i.roomTypeId);
    const who = `${i.adults} ${i.adults === 1 ? "Erwachsener" : "Erwachsene"}${i.children ? `, ${i.children} ${i.children === 1 ? "Kind" : "Kinder"}` : ""}`;
    return `Zimmer ${n + 1} (${type?.name ?? i.roomTypeId}): ${who}${i.guestName ? ` – ${i.guestName}` : ""}`;
  });
  return {
    items: [...byType.entries()].map(([roomTypeId, rooms]) => ({ roomTypeId, rooms })),
    arrival: cart.arrival,
    departure: cart.departure,
    guests: cart.items.reduce((a, i) => a + i.adults + i.children, 0),
    extras: [...extras.entries()].map(([id, quantity]) => ({ id, quantity: Math.min(8, quantity) })).filter((e) => stayExtras.some((x) => x.id === e.id)),
    roomNotes,
  };
}

/* ----------------------------------------------------------------------------
 * Filters & sorting ("Ein Zimmer wählen")
 * ------------------------------------------------------------------------- */

export type ViewMode = "rooms" | "rates";
export type SortMode = "recommended" | "price-asc" | "price-desc";

export interface RoomFilters {
  view: ViewMode;
  sort: SortMode;
  /** "1" | "2" | "3+" */
  occupancy: string[];
  features: string[];
  beds: string[];
  rates: string[];
  categories: string[];
  priceMin: number | null;
  priceMax: number | null;
}

export const emptyFilters = (): RoomFilters => ({ view: "rooms", sort: "recommended", occupancy: [], features: [], beds: [], rates: [], categories: [], priceMin: null, priceMax: null });

export const BED_LABEL: Record<RoomTypeSeed["bedKind"], string> = { double: "Doppelbett", single: "Einzelbett", multi: "Mehrere Schlafzimmer" };
export const OCCUPANCY_OPTIONS = [
  { id: "1", label: "1 Gast" },
  { id: "2", label: "2 Gäste" },
  { id: "3+", label: "3 Gäste und mehr" },
];

export interface Facets {
  features: string[];
  beds: Array<{ id: RoomTypeSeed["bedKind"]; label: string }>;
  categories: Array<{ id: string; label: string }>;
  price: { min: number; max: number };
}

export function roomFacets(seeds: readonly RoomTypeSeed[] = engineRoomTypes): Facets {
  const features = [...new Set(seeds.flatMap((s) => s.features))];
  const bedKinds = [...new Set(seeds.map((s) => s.bedKind))];
  const prices = seeds.map((s) => s.basePricePerNight).filter((p): p is number => p !== null);
  return {
    features,
    beds: bedKinds.map((id) => ({ id, label: BED_LABEL[id] })),
    categories: seeds.map((s) => ({ id: s.id, label: s.name })),
    price: { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 },
  };
}

export function activeFilterCount(f: RoomFilters): number {
  return f.occupancy.length + f.features.length + f.beds.length + f.rates.length + f.categories.length + (f.priceMin !== null ? 1 : 0) + (f.priceMax !== null ? 1 : 0);
}

function occupancyMatches(type: RoomTypeSeed, wanted: string[]): boolean {
  if (!wanted.length) return true;
  return wanted.some((w) => (w === "1" ? type.maxGuests >= 1 : w === "2" ? type.maxGuests >= 2 : type.maxGuests >= 3));
}

export function filterRooms(seeds: readonly RoomTypeSeed[], f: RoomFilters): RoomTypeSeed[] {
  let out = seeds.filter((t) => {
    if (!occupancyMatches(t, f.occupancy)) return false;
    if (f.features.length && !f.features.every((x) => t.features.includes(x))) return false;
    if (f.beds.length && !f.beds.includes(t.bedKind)) return false;
    if (f.categories.length && !f.categories.includes(t.id)) return false;
    if (f.rates.length && !f.rates.includes(defaultRateId)) return false;
    if (t.basePricePerNight !== null) {
      if (f.priceMin !== null && t.basePricePerNight < f.priceMin) return false;
      if (f.priceMax !== null && t.basePricePerNight > f.priceMax) return false;
    }
    return true;
  });
  if (f.sort === "recommended") out = [...out].sort((a, b) => a.sortOrder - b.sortOrder);
  else {
    const price = (t: RoomTypeSeed) => t.basePricePerNight ?? Number.MAX_SAFE_INTEGER; // "on request" last
    out = [...out].sort((a, b) => (f.sort === "price-asc" ? price(a) - price(b) : (b.basePricePerNight ?? -1) - (a.basePricePerNight ?? -1)));
  }
  return out;
}

/** Toggle helper for checkbox groups. */
export function toggleIn<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

/* ----------------------------------------------------------------------------
 * URL ↔ search state
 * ------------------------------------------------------------------------- */

export interface SearchState {
  arrival: LocalDate | null;
  departure: LocalDate | null;
  guests: GuestCount;
  code: string;
}

export function searchToParams(s: SearchState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.arrival) p.set("anreise", s.arrival);
  if (s.departure) p.set("abreise", s.departure);
  p.set("erwachsene", String(s.guests.adults));
  if (s.guests.children) p.set("kinder", String(s.guests.children));
  if (s.code) p.set("code", s.code);
  return p;
}

export function searchFromParams(p: URLSearchParams, isDate: (v: unknown) => boolean, fallback: { adults: number }): SearchState {
  const arrival = p.get("anreise");
  const departure = p.get("abreise");
  const legacyGuests = Number(p.get("gaeste"));
  const adults = Number(p.get("erwachsene")) || (legacyGuests > 0 ? legacyGuests : fallback.adults);
  const children = Math.max(0, Number(p.get("kinder")) || 0);
  return {
    arrival: arrival && isDate(arrival) ? arrival : null,
    departure: departure && isDate(departure) ? departure : null,
    guests: { adults: Math.min(22, Math.max(1, adults)), children: Math.min(10, children) },
    code: (p.get("code") ?? "").slice(0, 40),
  };
}
