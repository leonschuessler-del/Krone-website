import { z } from "zod";
import { requireAdminApi } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { errorJson, json, parseJson } from "@/server/http";
import { HotelError, updateHotelReservation } from "@/server/services/hotel-service";

export const dynamic = "force-dynamic";

const schema = z.object({ status: z.enum(["confirmed", "cancelled"]), declineReason: z.string().trim().max(300).optional(), note: z.string().trim().max(2000).optional() }).strict();

/** PATCH /api/admin/hotel/:id – confirm or cancel a room reservation. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  try {
    return json({ ok: true, result: await updateHotelReservation(await getDb(), id, parsed.data, auth.admin.email) });
  } catch (err) {
    if (err instanceof HotelError) return errorJson(err.status, err.code, err.message);
    throw err;
  }
}
