import { siteConfig } from "@/config/site";
import { getDb } from "@/server/db/client";
import { errorJson } from "@/server/http";
import { getPublicBooking } from "@/server/services/booking-service";
import { bookingAccessSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

/** GET /api/bookings/:number/ics?token=… – calendar file (iCalendar) for the booking. */
export async function GET(req: Request, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const parsed = bookingAccessSchema.safeParse({ bookingNumber: number, token: new URL(req.url).searchParams.get("token") ?? "" });
  if (!parsed.success) return errorJson(404, "NOT_FOUND", "Buchung nicht gefunden");
  const details = await getPublicBooking(await getDb(), parsed.data.bookingNumber, parsed.data.token);
  if (!details) return errorJson(404, "NOT_FOUND", "Buchung nicht gefunden");
  const b = details.booking;
  const spaces = details.items.map((i) => i.spaceName).join(", ");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Zur Krone Leidersbach//Buchung//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.bookingNumber}@zur-krone`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(b.startAt)}`,
    `DTEND:${icsDate(b.endAt)}`,
    `SUMMARY:${esc(`${siteConfig.name}: ${spaces}`)}`,
    `DESCRIPTION:${esc(`${b.kind === "inquiry" ? "Anfrage" : "Buchung"} ${b.bookingNumber}`)}`,
    `LOCATION:${esc(`${siteConfig.name}, ${siteConfig.address.postalCode} ${siteConfig.address.city}`)}`,
    b.kind === "inquiry" || b.status !== "confirmed" ? "STATUS:TENTATIVE" : "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${b.bookingNumber}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
