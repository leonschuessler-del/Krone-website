import { requireAdminApi } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { errorJson, json, parseJson } from "@/server/http";
import { handleAdminError } from "@/server/services/admin-http";
import { getAdminBookingDetail, updateBookingByAdmin } from "@/server/services/admin-service";
import { adminBookingUpdateSchema } from "@/server/services/admin-validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/bookings/:id – full booking detail (without access token hash). */
export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const detail = await getAdminBookingDetail(await getDb(), id);
    if (!detail) return errorJson(404, "NOT_FOUND", "Buchung nicht gefunden.");
    return json({ booking: detail });
  } catch (err) {
    return handleAdminError(err);
  }
}

/**
 * PATCH /api/admin/bookings/:id
 * { status?, paymentStatus?, adminNotes?, markReviewed?, notifyCustomer? }
 * Status changes follow the booking state machine; occupying statuses create
 * availability blocks (409 SLOT_TAKEN when the time is no longer free).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(req, adminBookingUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  try {
    const result = await updateBookingByAdmin(await getDb(), id, parsed.data, auth.admin.email);
    return json({ ok: true, result });
  } catch (err) {
    return handleAdminError(err);
  }
}
