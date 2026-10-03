import { and, desc, eq, gt, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { roomInventory, roomTypeSeeds, stayExtras } from "@/content/hotel";
import { freeRooms, fullyBookedNights, generateReservationNumber, nightCount, stayExtraLines, stayExtrasTotal, stayPricing, stayQuote, validateItems, validateStay, type RoomReservationLike } from "@/domain/hotel";
import { addDays, isLocalDate, todayLocal, type LocalDate } from "@/domain/time";
import { env } from "@/lib/env";
import { formatDateMedium, formatMoney } from "@/lib/format";
import type { Database } from "@/server/db/client";
import { customers, hotelReservations, roomTypes } from "@/server/db/schema";
import { pushCalendarEvent, removeCalendarEvent, type CalendarSyncResult } from "@/server/integrations/calendar";
import { hotelChannel } from "@/server/integrations/dirs21";
import { operatorEmail, sendEmail } from "./email-service";
import { hotelPaymentsAvailable, startHotelPayment, type HotelPaymentStart } from "./hotel-payment-service";

/**
 * Hotel reservations: rooms are booked individually (not with an event).
 * Flow: guest requests → operator confirms or declines in the admin →
 * e-mails, Apple Calendar and the channel manager (DIRS21) follow.
 */

const localDate = z.string().refine(isLocalDate, "Datum im Format YYYY-MM-DD");
export const hotelAvailabilityQuerySchema = z.object({ arrival: localDate, departure: localDate });

const roomTypeId = z.enum(roomTypeSeeds.map((t) => t.id) as [string, ...string[]]);
export const hotelReservationSchema = z
  .object({
    /** one line per room type, e.g. 1 × Einzelzimmer + 2 × Doppelzimmer */
    items: z.array(z.object({ roomTypeId, rooms: z.number().int().min(1).max(8) }).strict()).min(1).max(5),
    arrival: localDate,
    departure: localDate,
    guests: z.number().int().min(1).max(30),
    /** extras per night: Zustellbett, Babybett, Hund … (content/hotel.ts) */
    extras: z.array(z.object({ id: z.enum(stayExtras.map((e) => e.id) as [string, ...string[]]), quantity: z.number().int().min(1).max(8) }).strict()).max(6).optional().default([]),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().max(40).optional().default(""),
    notes: z.string().trim().max(2000).optional().default(""),
    /** how the guest wants to pay – online/guarantee need a payment provider (docs/ZAHLUNG.md) */
    payment: z.enum(["hotel", "online", "guarantee"]).optional().default("hotel"),
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
  // calendar: nights without a free room of the type, for the booking month(s)
  const calFrom = today < arrival ? today : arrival;
  const calTo = addDays(departure > calFrom ? departure : calFrom, 62);
  const calTaken = await overlapping(db, calFrom, calTo);
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
      total: stayPricing(t.id, { arrival, departure }, 1)?.total ?? null,
      pricing: stayPricing(t.id, { arrival, departure }, 1),
      free: remote === null ? local : Math.min(local, remote),
      totalRooms: roomInventory[t.inventoryGroup] ?? 0,
      fullNights: [...fullyBookedNights(t.id, calFrom, calTo, calTaken)],
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
  const itemIssues = validateItems(input.items);
  if (itemIssues.includes("duplicate")) throw new HotelError(422, "ITEMS", "Jeder Zimmertyp darf nur einmal in der Anfrage stehen.");
  if (itemIssues.includes("floor_mix")) throw new HotelError(422, "ITEMS", "Die ganze Etage enthält bereits alle Zimmer – bitte nicht mit einzelnen Zimmern kombinieren.");
  const quote = stayQuote(input.items, stay);
  const extraLines = stayExtraLines(Object.fromEntries(input.extras.map((e) => [e.id, e.quantity])), quote.nights);
  const extrasSum = stayExtrasTotal(extraLines);
  if (input.guests > quote.maxGuests) throw new HotelError(422, "GUESTS", `Für ${input.guests} Gäste reichen die gewählten Zimmer nicht (Platz für ${quote.maxGuests}).`);

  const result = await db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Database;
    const taken = await overlapping(tx, input.arrival, input.departure);
    for (const line of quote.lines) {
      const free = freeRooms(line.roomTypeId, stay, taken);
      if (free < line.rooms) throw new HotelError(409, "NO_ROOMS", free === 0 ? `${line.name} ist in diesem Zeitraum leider belegt.` : `Nur noch ${free} × ${line.name} frei.`);
    }
    const [customer] = await tx
      .insert(customers)
      .values({ firstName: input.firstName, lastName: input.lastName, email: input.email.toLowerCase(), phone: input.phone || "", street: "", houseNumber: "", postalCode: "", city: "", country: "DE" })
      .returning();
    const reservationNumber = generateReservationNumber(Number(input.arrival.slice(0, 4)));
    const rows = await tx
      .insert(hotelReservations)
      .values(
        quote.lines.map((line, i) => ({
          customerId: customer!.id,
          roomTypeId: line.roomTypeId,
          arrivalDate: input.arrival,
          departureDate: input.departure,
          rooms: line.rooms,
          // guests are kept on the first line only, so sums over rows stay right
          guests: i === 0 ? input.guests : 0,
          status: "requested" as const,
          reservationNumber,
          // extras are carried on the first line
          totalPrice: line.pricing ? line.pricing.total + (i === 0 ? extrasSum : 0) : null,
          notes: i === 0 ? [input.notes, extraLines.length ? `Extras: ${extraLines.map((l) => `${l.quantity} × ${l.name}`).join(", ")}` : ""].filter(Boolean).join("\n") || null : null,
        })),
      )
      .returning();
    return { rows, customer: customer!, reservationNumber };
  });

  const ctx = {
    customerName: `${result.customer.firstName} ${result.customer.lastName}`,
    bookingNumber: result.reservationNumber,
    spaces: [...quote.lines.map((l) => `${l.rooms} × ${l.name}`), ...extraLines.map((l) => `${l.quantity} × ${l.name}`)],
    dateLabel: `${formatDateMedium(input.arrival)} – ${formatDateMedium(input.departure)} (${quote.nights} Nächte)`,
    totalLabel: formatMoney(quote.total === null ? null : quote.total + extrasSum, "auf Anfrage"),
    message: input.notes || undefined,
    phone: siteConfig.contact.phone ?? undefined,
  };
  await sendEmail(db, "hotel_request_received", result.customer.email, ctx);
  await sendEmail(db, "operator_new_hotel_request", operatorEmail() ?? "betreiber@krone.invalid (nicht konfiguriert)", ctx);
  const total = quote.total === null ? null : quote.total + extrasSum;

  // online payment / card guarantee – only with a priced stay and a configured provider
  let payment: HotelPaymentStart = { provider: "none" };
  if (input.payment !== "hotel" && hotelPaymentsAvailable() && (input.payment === "guarantee" || (total !== null && total > 0))) {
    try {
      payment = await startHotelPayment(db, {
        reservationNumber: result.reservationNumber,
        kind: input.payment === "online" ? "full" : "guarantee",
        amount: total ?? 0,
        customerEmail: result.customer.email,
        customerName: ctx.customerName,
        description: `Zur Krone – Zimmer ${result.reservationNumber} (${ctx.dateLabel})`,
      });
    } catch (err) {
      // the reservation stands; the guest pays at the hotel and the admin sees the attempt
      console.error("[hotel] payment start failed", err);
      payment = { provider: "none" };
    }
  }
  return { reservationNumber: result.reservationNumber, status: "requested" as const, total, lines: quote.lines.map((l) => ({ roomTypeId: l.roomTypeId, rooms: l.rooms, name: l.name })), payment };
}

export async function listHotelReservations(db: Database) {
  return db
    .select({ r: hotelReservations, customer: customers, type: roomTypes })
    .from(hotelReservations)
    .leftJoin(customers, eq(hotelReservations.customerId, customers.id))
    .innerJoin(roomTypes, eq(hotelReservations.roomTypeId, roomTypes.id))
    .orderBy(desc(hotelReservations.createdAt));
}

export type HotelReservationRow = Awaited<ReturnType<typeof listHotelReservations>>[number];

/** Rows of one request (same reservation number) folded into one entry for the admin. */
export interface HotelReservationGroup {
  id: string;
  reservationNumber: string;
  customer: HotelReservationRow["customer"];
  lines: Array<{ rooms: number; name: string; totalPrice: number | null; channelRef: string | null }>;
  guests: number;
  arrivalDate: LocalDate;
  departureDate: LocalDate;
  status: HotelReservationRow["r"]["status"];
  paymentStatus: HotelReservationRow["r"]["paymentStatus"];
  total: number | null;
  notes: string | null;
  createdAt: Date;
}

export function groupHotelReservations(rows: HotelReservationRow[]): HotelReservationGroup[] {
  const map = new Map<string, HotelReservationGroup>();
  for (const { r, customer, type } of rows) {
    const key = r.reservationNumber ?? r.id;
    let g = map.get(key);
    if (!g) {
      g = { id: r.id, reservationNumber: key, customer, lines: [], guests: 0, arrivalDate: r.arrivalDate, departureDate: r.departureDate, status: r.status, paymentStatus: r.paymentStatus, total: 0, notes: null, createdAt: r.createdAt };
      map.set(key, g);
    }
    g.lines.push({ rooms: r.rooms, name: type.name, totalPrice: r.totalPrice, channelRef: r.channelRef });
    g.guests += r.guests;
    g.notes = g.notes ?? r.notes;
    g.total = g.total === null || r.totalPrice === null ? null : g.total + r.totalPrice;
    // a confirmed line wins over a requested one, cancelled only when all are cancelled
    if (r.status === "confirmed") g.status = "confirmed";
    else if (r.status === "requested" && g.status === "cancelled") g.status = "requested";
  }
  return [...map.values()];
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
  const { r, customer } = row;
  // every line of the same request (same reservation number) moves together
  const group = r.reservationNumber
    ? await db
        .select({ r: hotelReservations, customer: customers, type: roomTypes })
        .from(hotelReservations)
        .leftJoin(customers, eq(hotelReservations.customerId, customers.id))
        .innerJoin(roomTypes, eq(hotelReservations.roomTypeId, roomTypes.id))
        .where(eq(hotelReservations.reservationNumber, r.reservationNumber))
    : [row];
  if (r.status === "cancelled") throw new HotelError(422, "FINAL", "Die Reservierung ist bereits storniert.");
  if (patch.status === r.status) return { status: r.status, email: null, channel: { ok: true } };

  for (const g of group) {
    await db
      .update(hotelReservations)
      .set({ status: patch.status, declineReason: patch.declineReason ?? null, updatedAt: new Date() })
      .where(eq(hotelReservations.id, g.r.id));
  }

  const channel = hotelChannel();
  let channelResult: { ok: boolean; ref?: string; error?: string } = { ok: true };
  for (const g of group) {
    const res =
      patch.status === "confirmed"
        ? await channel.create({
            id: g.r.id,
            reservationNumber: g.r.reservationNumber ?? g.r.id,
            roomTypeId: g.r.roomTypeId,
            arrival: g.r.arrivalDate,
            departure: g.r.departureDate,
            rooms: g.r.rooms,
            guests: g.r.guests,
            guest: { firstName: customer?.firstName ?? "", lastName: customer?.lastName ?? "", email: customer?.email ?? "", phone: customer?.phone },
            notes: g.r.notes,
          })
        : await channel.cancel(g.r.id, g.r.channelRef);
    if (res.ok && res.ref) await db.update(hotelReservations).set({ channelRef: res.ref }).where(eq(hotelReservations.id, g.r.id));
    if (!res.ok) channelResult = { ok: false, error: res.error };
  }

  const lines = group.map((g) => `${g.r.rooms} × ${g.type.name}`);
  const guests = group.reduce((a, g) => a + g.r.guests, 0);
  const total = group.reduce<number | null>((a, g) => (a === null || g.r.totalPrice === null ? null : a + g.r.totalPrice), 0);
  const calendarId = r.reservationNumber ?? r.id;
  const calendar =
    patch.status === "confirmed"
      ? await pushCalendarEvent({
          id: calendarId,
          title: `Hotel: ${lines.join(", ")}${customer ? ` – ${customer.lastName}` : ""}`,
          start: new Date(`${r.arrivalDate}T00:00:00Z`),
          end: new Date(`${r.departureDate}T00:00:00Z`),
          allDay: true,
          description: [customer ? `${customer.firstName} ${customer.lastName} · ${customer.email}${customer.phone ? ` · ${customer.phone}` : ""}` : "", `${guests} Gäste`, `${env.siteUrl}/admin/hotel`].filter(Boolean).join("\n"),
        })
      : await removeCalendarEvent(calendarId);

  let email: string | null = null;
  if (customer) {
    const template = patch.status === "confirmed" ? "hotel_confirmed" : r.status === "requested" ? "hotel_declined" : "hotel_cancelled";
    await sendEmail(db, template, customer.email, {
      customerName: `${customer.firstName} ${customer.lastName}`,
      bookingNumber: r.reservationNumber ?? undefined,
      spaces: lines,
      dateLabel: `${formatDateMedium(r.arrivalDate)} – ${formatDateMedium(r.departureDate)}`,
      totalLabel: formatMoney(total, "auf Anfrage"),
      reasonText: patch.declineReason,
      note: patch.note,
      phone: siteConfig.contact.phone ?? undefined,
    });
    email = template;
  }
  void actor;
  return { status: patch.status, email, calendar, channel: channelResult.ok ? { ok: true } : { ok: false, error: channelResult.error } };
}
