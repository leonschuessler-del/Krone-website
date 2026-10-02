import { roomInventory, roomTypeSeeds, type RoomTypeSeed } from "@/content/hotel";
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
      if (r.status === "cancelled" || !sameGroup.has(r.roomTypeId)) continue;
      if (r.arrivalDate <= night && night < r.departureDate) taken += r.rooms;
    }
    min = Math.min(min, total - taken);
  }
  return Math.max(0, min);
}

export function stayPrice(roomTypeId: string, stay: StayRequest, rooms: number): number | null {
  const type = roomTypeById(roomTypeId);
  if (!type || type.basePricePerNight === null) return null;
  return type.basePricePerNight * nightCount(stay.arrival, stay.departure) * rooms;
}

/** Reservation number: HZ-<year>-<5 chars> */
export function generateReservationNumber(year: number, random: () => number = Math.random): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += alphabet[Math.floor(random() * alphabet.length)];
  return `HZ-${year}-${s}`;
}
