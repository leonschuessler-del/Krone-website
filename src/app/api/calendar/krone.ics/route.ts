import { timingSafeEqual } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { calendarConfig, renderCalendar, type CalendarEvent } from "@/server/integrations/calendar";
import { getDb } from "@/server/db/client";
import { bookingItems, bookings, customers, hotelReservations, roomTypes, spaces } from "@/server/db/schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/calendar/krone.ics?key=…
 * Subscription feed for Apple Calendar: every confirmed event booking and
 * confirmed hotel reservation. Needs CALENDAR_FEED_KEY (see docs/INTEGRATIONS.md).
 */
export async function GET(req: Request) {
  const key = calendarConfig.feedKey;
  const given = new URL(req.url).searchParams.get("key") ?? "";
  if (!key) return new Response("Kalender-Abo nicht eingerichtet (CALENDAR_FEED_KEY fehlt).", { status: 404 });
  const a = Buffer.from(given);
  const b = Buffer.from(key);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return new Response("Forbidden", { status: 403 });

  const db = await getDb();
  const rows = await db
    .select({ booking: bookings, customer: customers })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .where(inArray(bookings.status, ["confirmed", "completed"]));
  const items = rows.length
    ? await db
        .select({ bookingId: bookingItems.bookingId, name: spaces.name })
        .from(bookingItems)
        .innerJoin(spaces, eq(bookingItems.spaceId, spaces.id))
        .where(inArray(bookingItems.bookingId, rows.map((r) => r.booking.id)))
    : [];
  const events: CalendarEvent[] = rows.map(({ booking: b, customer: c }) => ({
    id: b.id,
    title: `Feier ${b.bookingNumber} – ${items.filter((i) => i.bookingId === b.id).map((i) => i.name).join(", ")}`,
    start: b.startAt,
    end: b.endAt,
    description: [`${c.firstName} ${c.lastName} · ${c.email}${c.phone ? ` · ${c.phone}` : ""}`, b.guestCount ? `${b.guestCount} Gäste` : ""].filter(Boolean).join("\n"),
  }));
  const stays = await db
    .select({ r: hotelReservations, type: roomTypes.name, customer: customers })
    .from(hotelReservations)
    .innerJoin(roomTypes, eq(hotelReservations.roomTypeId, roomTypes.id))
    .leftJoin(customers, eq(hotelReservations.customerId, customers.id))
    .where(eq(hotelReservations.status, "confirmed"));
  for (const { r, type, customer } of stays) {
    events.push({
      id: r.id,
      title: `Hotel: ${r.rooms}× ${type}${customer ? ` – ${customer.lastName}` : ""}`,
      start: new Date(`${r.arrivalDate}T00:00:00Z`),
      end: new Date(`${r.departureDate}T00:00:00Z`),
      allDay: true,
      description: customer ? `${customer.firstName} ${customer.lastName} · ${customer.email}` : undefined,
    });
  }
  return new Response(renderCalendar(events), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300" },
  });
}
