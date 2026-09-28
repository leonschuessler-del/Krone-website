import { requireAdminApi } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { json } from "@/server/http";
import { handleAdminError } from "@/server/services/admin-http";
import { BOOKING_FILTERS, listAdminBookings, type BookingFilter } from "@/server/services/admin-service";

export const dynamic = "force-dynamic";

/** GET /api/admin/bookings?filter=neu&q=… – booking list for the admin. */
export async function GET(req: Request) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const f = url.searchParams.get("filter") ?? "alle";
  const filter: BookingFilter = (BOOKING_FILTERS as readonly string[]).includes(f) ? (f as BookingFilter) : "alle";
  const q = (url.searchParams.get("q") ?? "").slice(0, 100);
  try {
    return json(await listAdminBookings(await getDb(), { filter, q }));
  } catch (err) {
    return handleAdminError(err);
  }
}
