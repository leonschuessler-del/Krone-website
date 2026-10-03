import { FLOOR_NIGHT_TIERS, FLOOR_PRICE_PER_NIGHT, FLOOR_ROOMS_SUM, LONG_STAY_NIGHTS, LONG_STAY_PERCENT, roomInventory, roomTypeSeeds, stayExtras, type RoomTypeSeed } from "@/content/hotel";
import { addDays, type LocalDate } from "./time";

/**
 * Hotel logic: nights, prices and room availability per inventory group.
 * Pure functions – used by the server, the admin and the static preview.
 */

export interface StayRequest {
  arrival: LocalDate;
  departure: LocalDate;
}

export interface RoomReservationLike {
  roomTypeId: string;
  arrivalDate: LocalDate;
  departureDate: LocalDate;
  rooms: number;
  status: "requested" | "confirmed" | "cancelled";
}

export function nightsBetween(arrival: LocalDate, departure: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = arrival; d < departure && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

export function nightCount(arrival: LocalDate, departure: LocalDate): number {
  return nightsBetween(arrival, departure).length;
}

export type StayIssue = "past" | "order" | "too_long";

export function validateStay(req: StayRequest, today: LocalDate, maxNights = 21): StayIssue[] {
  const issues: StayIssue[] = [];
  if (req.arrival < today) issues.push("past");
  if (req.departure <= req.arrival) issues.push("order");
  if (nightCount(req.arrival, req.departure) > maxNights) issues.push("too_long");
  return issues;
}

export const roomTypeById = (id: string): RoomTypeSeed | undefined => roomTypeSeeds.find((t) => t.id === id);

/**
 * Free rooms of a type for every night of the stay (the minimum over nights).
 * Requested reservations count as taken too, so two guests never get the
 * same last room while the operator is still deciding.
 */
export function freeRooms(roomTypeId: string, stay: StayRequest, reservations: readonly RoomReservationLike[]): number {
  const type = roomTypeById(roomTypeId);
  if (!type) return 0;
  const total = roomInventory[type.inventoryGroup] ?? 0;
  const sameGroup = new Set(roomTypeSeeds.filter((t) => t.inventoryGroup === type.inventoryGroup).map((t) => t.id));
  let min = total;
  for (const night of nightsBetween(stay.arrival, stay.departure)) {
    let taken = 0;
    for (const r of reservations) {
      if (r.status === "cancelled") continue;
      if (r.arrivalDate > night || night >= r.departureDate) continue;
      // the whole floor blocks every room – and any room blocks the whole floor
      if (r.roomTypeId === "floor" || type.inventoryGroup === "floor") return 0;
      if (sameGroup.has(r.roomTypeId)) taken += r.rooms;
    }
    min = Math.min(min, total - taken);
  }
  return Math.max(0, min);
}

export interface StayPrice {
  nights: number;
  perNight: number;
  /** before the long-stay discount */
  list: number;
  discountPercent: number;
  total: number;
}

/** Price of a stay incl. the long-stay discount (from LONG_STAY_NIGHTS nights). */
export function stayPricing(roomTypeId: string, stay: StayRequest, rooms: number): StayPrice | null {
  const type = roomTypeById(roomTypeId);
  if (!type || type.basePricePerNight === null) return null;
  const nights = nightCount(stay.arrival, stay.departure);
  const list = type.basePricePerNight * nights * rooms;
  const discountPercent = nights >= LONG_STAY_NIGHTS ? LONG_STAY_PERCENT : 0;
  const total = Math.round(list * (1 - discountPercent / 100));
  return { nights, perNight: type.basePricePerNight, list, discountPercent, total };
}

export function stayPrice(roomTypeId: string, stay: StayRequest, rooms: number): number | null {
  return stayPricing(roomTypeId, stay, rooms)?.total ?? null;
}

/** One line of a room request: e.g. 2 × Doppelzimmer. A request has 1–n lines. */
export interface StayItem {
  roomTypeId: string;
  rooms: number;
}

export type ItemIssue = "empty" | "floor_mix" | "duplicate" | "unknown";

export function validateItems(items: readonly StayItem[]): ItemIssue[] {
  const issues: ItemIssue[] = [];
  const live = items.filter((i) => i.rooms > 0);
  if (!live.length) issues.push("empty");
  if (live.some((i) => !roomTypeById(i.roomTypeId))) issues.push("unknown");
  if (live.some((i) => i.roomTypeId === "floor") && live.length > 1) issues.push("floor_mix");
  if (new Set(live.map((i) => i.roomTypeId)).size !== live.length) issues.push("duplicate");
  return issues;
}

export interface StayItemLine extends StayItem {
  name: string;
  maxGuests: number;
  pricing: StayPrice | null;
}

export interface StayQuote {
  nights: number;
  lines: StayItemLine[];
  /** sum of rooms over all lines */
  rooms: number;
  maxGuests: number;
  /** null when at least one line is "on request" (apartment) */
  total: number | null;
  /** before long-stay discount, priced lines only */
  list: number;
  discount: number;
  discountPercent: number;
}

/** Price of a whole request (several room types) for one stay. */
export function stayQuote(items: readonly StayItem[], stay: StayRequest): StayQuote {
  const nights = nightCount(stay.arrival, stay.departure);
  const lines: StayItemLine[] = [];
  for (const it of items) {
    const type = roomTypeById(it.roomTypeId);
    if (!type || it.rooms <= 0) continue;
    lines.push({ ...it, name: type.name, maxGuests: type.maxGuests * it.rooms, pricing: stayPricing(it.roomTypeId, stay, it.rooms) });
  }
  const priced = lines.map((l) => l.pricing).filter((p): p is StayPrice => p !== null);
  const list = priced.reduce((a, p) => a + p.list, 0);
  const sum = priced.reduce((a, p) => a + p.total, 0);
  const onRequest = lines.some((l) => l.pricing === null);
  return {
    nights,
    lines,
    rooms: lines.reduce((a, l) => a + l.rooms, 0),
    maxGuests: lines.reduce((a, l) => a + l.maxGuests, 0),
    total: onRequest ? null : sum,
    list,
    discount: list - sum,
    discountPercent: nights >= LONG_STAY_NIGHTS ? LONG_STAY_PERCENT : 0,
  };
}

/** Occupied nights of a type, for the calendar (nights where no room of the type is free). */
export function fullyBookedNights(roomTypeId: string, from: LocalDate, to: LocalDate, reservations: readonly RoomReservationLike[]): Set<LocalDate> {
  const out = new Set<LocalDate>();
  for (const night of nightsBetween(from, to)) {
    if (freeRooms(roomTypeId, { arrival: night, departure: addDays(night, 1) }, reservations) === 0) out.add(night);
  }
  return out;
}

/**
 * Whole floor with an event: fixed price per night, a small discount per
 * night from the second night on (FLOOR_NIGHT_TIERS). Rooms booked
 * individually never get a discount – only the exclusive floor does.
 */
export interface FloorPrice {
  nights: number;
  perNight: number;
  list: number;
  percent: number;
  total: number;
  /** what one more night would cost in total, and the percent it unlocks */
  nextNight: { total: number; percent: number } | null;
}
export function floorStayPricing(nights: number): FloorPrice {
  const tier = (n: number) => [...FLOOR_NIGHT_TIERS].reverse().find((t) => n >= t.nights)?.percent ?? 0;
  const calc = (n: number) => {
    const list = FLOOR_PRICE_PER_NIGHT * n;
    const percent = tier(n);
    return { list, percent, total: Math.round(list * (1 - percent / 100)) };
  };
  const now = calc(Math.max(1, nights));
  const next = calc(Math.max(1, nights) + 1);
  return {
    nights: Math.max(1, nights),
    perNight: FLOOR_PRICE_PER_NIGHT,
    ...now,
    nextNight: next.percent > now.percent ? { total: next.total, percent: next.percent } : null,
  };
}

/** One sentence for the planner: "one more night and the floor costs x % less". */
export function floorNudge(nights: number): string | null {
  const p = floorStayPricing(nights);
  if (!p.nextNight) return null;
  const extra = p.nextNight.total - p.total;
  return `Tipp: Mit einer Nacht mehr sinkt der Etagenpreis um ${p.nextNight.percent} % pro Nacht – die zusätzliche Nacht kostet dann nur ${(extra / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}.`;
}

/** Hints shown in the booking – the hotel page sells comfort, not discounts. */
export function hotelNudges(roomTypeId: string, stay: StayRequest, rooms: number, guests: number): string[] {
  const out: string[] = [];
  const nights = nightCount(stay.arrival, stay.departure);
  if (LONG_STAY_PERCENT > 0 && nights === LONG_STAY_NIGHTS - 1) out.push(`Tipp: Ab ${LONG_STAY_NIGHTS} Nächten sparen Sie ${LONG_STAY_PERCENT} % auf alle Zimmer.`);
  if (roomTypeId !== "floor" && (rooms >= 4 || guests >= 10)) {
    out.push(`Tipp: Für Gesellschaften gibt es die ganze Etage – alle 10 Zimmer und das Apartment – exklusiv mit einer Veranstaltung ab ${(FLOOR_PRICE_PER_NIGHT / 100).toLocaleString("de-DE")} € pro Nacht (einzeln ${(FLOOR_ROOMS_SUM / 100).toLocaleString("de-DE")} € ohne Apartment).`);
  }
  return out;
}

/** Nudges for a multi-line request. */
export function stayNudges(items: readonly StayItem[], stay: StayRequest, guests: number): string[] {
  const live = items.filter((i) => i.rooms > 0);
  const onlyFloor = live.length === 1 && live[0]!.roomTypeId === "floor";
  const rooms = live.reduce((a, i) => a + i.rooms, 0);
  return hotelNudges(onlyFloor ? "floor" : "double", stay, rooms, guests);
}

/** Reservation number: HZ-<year>-<5 chars> */
export function generateReservationNumber(year: number, random: () => number = Math.random): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += alphabet[Math.floor(random() * alphabet.length)];
  return `HZ-${year}-${s}`;
}

/** Extras of a stay (Zustellbett, Hund …): quantity × nights × price. */
export interface StayExtraLine {
  id: string;
  name: string;
  quantity: number;
  nights: number;
  pricePerNight: number;
  total: number;
}
export function stayExtraLines(selected: Readonly<Record<string, number>>, nights: number): StayExtraLine[] {
  const out: StayExtraLine[] = [];
  for (const e of stayExtras) {
    const q = selected[e.id] ?? 0;
    if (q <= 0) continue;
    out.push({ id: e.id, name: e.name, quantity: q, nights, pricePerNight: e.pricePerNight, total: e.pricePerNight * q * Math.max(1, nights) });
  }
  return out;
}
export const stayExtrasTotal = (lines: readonly StayExtraLine[]) => lines.reduce((a, l) => a + l.total, 0);

/**
 * Room suggestions for a number of guests – what the big booking sites do:
 * the cheapest combination first, then sensible alternatives (more comfort,
 * more privacy, the apartment). Uses only the four guest room types; a double
 * room takes up to 2 guests, extra beds are offered as extras.
 */
export interface RoomSuggestion {
  id: string;
  title: string;
  items: StayItem[];
  /** total per night in cents, null = on request */
  perNight: number | null;
  note: string;
  tag?: "günstigste" | "komfort" | "apartment";
}
export function suggestRooms(guests: number): RoomSuggestion[] {
  const g = Math.max(1, Math.min(22, guests));
  const price = (items: StayItem[]) => {
    let sum = 0;
    for (const i of items) {
      const t = roomTypeById(i.roomTypeId);
      if (!t || t.basePricePerNight === null) return null;
      sum += t.basePricePerNight * i.rooms;
    }
    return sum;
  };
  const out: RoomSuggestion[] = [];
  const push = (id: string, title: string, items: StayItem[], note: string, tag?: RoomSuggestion["tag"]) => {
    const total = items.reduce((a, i) => a + i.rooms, 0);
    if (!total) return;
    out.push({ id, title, items, perNight: price(items), note, tag });
  };
  const singles = Math.min(2, g);
  if (g === 1) {
    push("single", "Einzelzimmer", [{ roomTypeId: "single", rooms: 1 }], "Das klassische Zimmer für eine Person.", "günstigste");
    push("double-single", "Doppelzimmer zur Einzelnutzung", [{ roomTypeId: "double-single", rooms: 1 }], "Mehr Platz, das ganze Doppelzimmer für Sie.", "komfort");
  } else {
    const doubles = Math.floor(g / 2);
    const odd = g % 2;
    const base: StayItem[] = [];
    if (doubles) base.push({ roomTypeId: "double", rooms: Math.min(8, doubles) });
    if (odd) base.push({ roomTypeId: "single", rooms: 1 });
    push("doubles", doubles === 1 && !odd ? "Doppelzimmer" : `${doubles} × Doppelzimmer${odd ? " + 1 Einzelzimmer" : ""}`, base, odd ? "Paare im Doppelzimmer, eine Person im Einzelzimmer." : "Je zwei Gäste teilen sich ein Doppelzimmer.", "günstigste");
    if (odd && doubles) {
      push("doubles-ds", `${doubles} × Doppelzimmer + 1 Doppelzimmer zur Einzelnutzung`, [{ roomTypeId: "double", rooms: Math.min(8, doubles) }, { roomTypeId: "double-single", rooms: 1 }], "Alle im gleichen Zimmertyp, mehr Platz für die einzelne Person.", "komfort");
    }
    if (g <= 4 && g >= 3) {
      push("double-extra", "1 Doppelzimmer mit Zustellbett", [{ roomTypeId: "double", rooms: 1 }], `Familie in einem Zimmer: Zustellbett${g === 4 ? "en" : ""} als Extra (25 € pro Nacht).`, "komfort");
    }
    if (g >= 2 && g <= singles + 0 && g <= 2) push("singles", "2 × Einzelzimmer", [{ roomTypeId: "single", rooms: 2 }], "Jeder sein eigenes Zimmer.", "komfort");
  }
  if (g <= 5) push("apartment", "Apartment", [{ roomTypeId: "apartment", rooms: 1 }], "Drei Schlafzimmer, eigene Küche, Südbalkon – Preis auf Anfrage.", "apartment");
  // cheapest first, "on request" last
  return out.sort((a, b) => (a.perNight ?? Infinity) - (b.perNight ?? Infinity));
}
