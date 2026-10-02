import { and, desc, eq, gt, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { roomInventory, roomTypeSeeds } from "@/content/hotel";
import { freeRooms, generateReservationNumber, nightCount, stayPrice, validateStay, type RoomReservationLike } from "@/domain/hotel";
import { isLocalDate, todayLocal, type LocalDate } from "@/domain/time";
import { env } from "@/lib/env";
import { formatDateMedium, formatMoney } from "@/lib/format";
import type { Database } from "@/server/db/client";
import { customers, hotelReservations, roomTypes } from "@/server/db/schema";
import { pushCalendarEvent, removeCalendarEvent, type CalendarSyncResult } from "@/server/integrations/calendar";
import { hotelChannel } from "@/server/integrations/dirs21";
import { operatorEmail, sendEmail } from "./email-service";

/**
 * Hotel reservations: rooms are booked individually (not with an event).
 * Flow: guest requests → operator confirms or declines in the admin →
 * e-mails, Apple Calendar and the channel manager (DIRS21) follow.
 */

const localDate = z.string().refine(isLocalDate, "Datum im Format YYYY-MM-DD");
export const hotelAvailabilityQuerySchema = z.object({ arrival: localDate, departure: localDate });

export const hotelReservationSchema = z
  .object({
    roomTypeId: z.enum(roomTypeSeeds.map((t) => t.id) as [string, ...string[]]),
    arrival: localDate,
    departure: localDate,
    rooms: z.number().int().min(1).max(8),
    guests: z.number().int().min(1).max(16),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().max(40).optional().default(""),
    notes: z.string().trim().max(2000).optional().default(""),
    /** honeypot */
    website: z.string().max(0).optional(),
  })
  .strict();
export type HotelReservationInput = z.infer<typeof hotelReservationSchema>;

export class HotelError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function overlapping(db: Database, arrival: LocalDate, departure: LocalDate): Promise<RoomReservationLike[]> {
  const rows = await db
    .select({ roomTypeId: hotelReservations.roomTypeId, arrivalDate: hotelReservations.arrivalDate, departureDate: hotelReservations.departureDate, rooms: hotelReservations.rooms, status: hotelReservations.status })
    .from(hotelReservations)
    .where(and(ne(hotelReservations.status, "cancelled"), lt(hotelReservations.arrivalDate, departure), gt(hotelReservations.departureDate, arrival)));
  return rows;
}

export async function hotelAvailability(db: Database, arrival: LocalDate, departure: LocalDate, today = todayLocal()) {
  const issues = validateStay({ arrival, departure }, today);
  const taken = issues.length ? [] : await overlapping(db, arrival, departure);
  const nights = nightCount(arrival, departure);
  const channel = hotelChannel();
  const types = [];
  for (const t of roomTypeSeeds) {
    const local = issues.length ? 0 : freeRooms(t.id, { arrival, departure }, taken);
    const remote = issues.length || channel.name === "local" ? null : await channel.availability({ roomTypeId: t.id, arrival, departure });
    types.push({
      id: t.id,
      name: t.name,
      description: t.description,
      maxGuests: t.maxGuests,
      pricePerNight: t.basePricePerNight,
      total: stayPrice(t.id, { arrival, departure }, 1),
      free: remote === null ? local : Math.min(local, remote),
      totalRooms: roomInventory[t.inventoryGroup] ?? 0,
    });
  }
  return { arrival, departure, nights, issues, types, channel: channel.name };
}

export async function createHotelReservation(db: Database, input: HotelReservationInput, today = todayLocal()) {
  const stay = { arrival: input.arrival, departure: input.departure };
  const issues = validateStay(stay, today);
  if (issues.includes("past")) throw new HotelError(422, "PAST", "Die Anreise liegt in der Vergangenheit.");
  if (issues.includes("order")) throw new HotelError(422, "ORDER", "Die Abreise muss nach der Anreise liegen.");
  if (issues.includes("too_long")) throw new HotelError(422, "TOO_LONG", "Bitte fragen Sie Aufenthalte über 21 Nächte persönlich an.");
  const type = roomTypeSeeds.find((t) => t.id === input.roomTypeId)!;
  if (input.guests > type.maxGuests * input.rooms) throw new HotelError(422, "GUESTS", `${type.name}: höchstens ${type.maxGuests} Gäste pro Zimmer.`);

  const result = await db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Database;
    const taken = await overlapping(tx, input.arrival, input.departure);
    const free = freeRooms(input.roomTypeId, stay, taken);
    if (free < input.rooms) throw new HotelError(409, "NO_ROOMS", free === 0 ? `${type.name} ist in diesem Zeitraum leider belegt.` : `Nur noch ${free} × ${type.name} frei.`);
    const [customer] = await tx
      .insert(customers)
      .values({ firstName: input.firstName, lastName: input.lastName, email: input.email.toLowerCase(), phone: input.phone || "", street: "", houseNumber: "", postalCode: "", city: "", country: "DE" })
      .returning();
    const reservationNumber = generateReservationNumber(Number(input.arrival.slice(0, 4)));
    const [row] = await tx
      .insert(hotelReservations)
      .values({
        customerId: customer!.id,
        roomTypeId: input.roomTypeId,
        arrivalDate: input.arrival,
        departureDate: input.departure,
        rooms: input.rooms,
        guests: input.guests,
        status: "requested",
        reservationNumber,
        totalPrice: stayPrice(input.roomTypeId, stay, input.rooms),
        notes: input.notes || null,
      })
      .returning();
    return { reservation: row!, customer: customer! };
  });

  const ctx = {
    customerName: `${result.customer.firstName} ${result.customer.lastName}`,
    bookingNumber: result.reservation.reservationNumber ?? undefined,
    spaces: [`${input.rooms} × ${type.name}`],
    dateLabel: `${formatDateMedium(input.arrival)} – ${formatDateMedium(input.departure)} (${nightCount(input.arrival, input.departure)} Nächte)`,
    totalLabel: formatMoney(result.reservation.totalPrice, "auf Anfrage"),
    message: input.notes || undefined,
    phone: siteConfig.contact.phone ?? undefined,
  };
  await sendEmail(db, "hotel_request_received", result.customer.email, ctx);
  await sendEmail(db, "operator_new_hotel_request", operatorEmail() ?? "betreiber@krone.invalid (nicht konfiguriert)", ctx);
  return { reservationNumber: result.reservation.reservationNumber!, status: result.reservation.status, total: result.reservation.totalPrice };
}

export async function listHotelReservations(db: Database) {
  return db
    .select({ r: hotelReservations, customer: customers, type: roomTypes })
    .from(hotelReservations)
    .leftJoin(customers, eq(hotelReservations.customerId, customers.id))
    .innerJoin(roomTypes, eq(hotelReservations.roomTypeId, roomTypes.id))
    .orderBy(desc(hotelReservations.createdAt));
}

export async function updateHotelReservation(
  db: Database,
  id: string,
  patch: { status: "confirmed" | "cancelled"; declineReason?: string; note?: string },
  actor: string,
): Promise<{ status: string; email: string | null; calendar?: CalendarSyncResult; channel: { ok: boolean; error?: string } }> {
  const [row] = await db
    .select({ r: hotelReservations, customer: customers, type: roomTypes })
    .from(hotelReservations)
    .leftJoin(customers, eq(hotelReservations.customerId, customers.id))
    .innerJoin(roomTypes, eq(hotelReservations.roomTypeId, roomTypes.id))
    .where(eq(hotelReservations.id, id));
  if (!row) throw new HotelError(404, "NOT_FOUND", "Reservierung nicht gefunden.");
  const { r, customer, type } = row;
  if (r.status === "cancelled") throw new HotelError(422, "FINAL", "Die Reservierung ist bereits storniert.");
  if (patch.status === r.status) return { status: r.status, email: null, channel: { ok: true } };

  await db
    .update(hotelReservations)
    .set({ status: patch.status, declineReason: patch.declineReason ?? null, updatedAt: new Date() })
    .where(eq(hotelReservations.id, id));

  const channel = hotelChannel();
  const channelResult =
    patch.status === "confirmed"
      ? await channel.create({
          id: r.id,
          reservationNumber: r.reservationNumber ?? r.id,
          roomTypeId: r.roomTypeId,
          arrival: r.arrivalDate,
          departure: r.departureDate,
          rooms: r.rooms,
          guests: r.guests,
          guest: { firstName: customer?.firstName ?? "", lastName: customer?.lastName ?? "", email: customer?.email ?? "", phone: customer?.phone },
          notes: r.notes,
        })
      : await channel.cancel(r.id, r.channelRef);
  if (channelResult.ok && channelResult.ref) await db.update(hotelReservations).set({ channelRef: channelResult.ref }).where(eq(hotelReservations.id, id));

  const calendar =
    patch.status === "confirmed"
      ? await pushCalendarEvent({
          id: r.id,
          title: `Hotel: ${r.rooms}× ${type.name}${customer ? ` – ${customer.lastName}` : ""}`,
          start: new Date(`${r.arrivalDate}T00:00:00Z`),
          end: new Date(`${r.departureDate}T00:00:00Z`),
          allDay: true,
          description: [customer ? `${customer.firstName} ${customer.lastName} · ${customer.email}${customer.phone ? ` · ${customer.phone}` : ""}` : "", `${r.guests} Gäste`, `${env.siteUrl}/admin/hotel`].filter(Boolean).join("\n"),
        })
      : await removeCalendarEvent(r.id);

  let email: string | null = null;
  if (customer) {
    const template = patch.status === "confirmed" ? "hotel_confirmed" : r.status === "requested" ? "hotel_declined" : "hotel_cancelled";
    await sendEmail(db, template, customer.email, {
      customerName: `${customer.firstName} ${customer.lastName}`,
      bookingNumber: r.reservationNumber ?? undefined,
      spaces: [`${r.rooms} × ${type.name}`],
      dateLabel: `${formatDateMedium(r.arrivalDate)} – ${formatDateMedium(r.departureDate)}`,
      totalLabel: formatMoney(r.totalPrice, "auf Anfrage"),
      reasonText: patch.declineReason,
      note: patch.note,
      phone: siteConfig.contact.phone ?? undefined,
    });
    email = template;
  }
  void actor;
  return { status: patch.status, email, calendar, channel: channelResult.ok ? { ok: true } : { ok: false, error: channelResult.error } };
}
