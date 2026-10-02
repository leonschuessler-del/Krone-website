import { FLOOR_PRICE_PER_NIGHT, FLOOR_ROOMS_SUM, LONG_STAY_NIGHTS, LONG_STAY_PERCENT, roomInventory, roomTypeSeeds, type RoomTypeSeed } from "@/content/hotel";
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

/** Hints shown in the booking: what would make the stay cheaper or simpler. */
export function hotelNudges(roomTypeId: string, stay: StayRequest, rooms: number, guests: number): string[] {
  const out: string[] = [];
  const nights = nightCount(stay.arrival, stay.departure);
  if (nights === LONG_STAY_NIGHTS - 1) out.push(`Tipp: Ab ${LONG_STAY_NIGHTS} Nächten sparen Sie ${LONG_STAY_PERCENT} % auf alle Zimmer.`);
  if (roomTypeId !== "floor" && (rooms >= 4 || guests >= 10)) {
    out.push(`Tipp: Die ganze Etage – alle 10 Zimmer und das Apartment – gibt es für ${(FLOOR_PRICE_PER_NIGHT / 100).toLocaleString("de-DE")} € pro Nacht (einzeln ${(FLOOR_ROOMS_SUM / 100).toLocaleString("de-DE")} € ohne Apartment).`);
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
