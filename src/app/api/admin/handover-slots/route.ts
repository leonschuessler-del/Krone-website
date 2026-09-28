import { requireAdminApi } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { json, parseJson } from "@/server/http";
import { createHandoverSlot, listHandoverSlots } from "@/server/services/admin-catalog-service";
import { handleAdminError } from "@/server/services/admin-http";
import { handoverSlotSchema } from "@/server/services/admin-validation";

export const dynamic = "force-dynamic";

/** GET /api/admin/handover-slots */
export async function GET(req: Request) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  try {
    return json({ slots: await listHandoverSlots(await getDb()) });
  } catch (err) {
    return handleAdminError(err);
  }
}

/** POST /api/admin/handover-slots – new handover/return time (HH:mm, optional weekdays). */
export async function POST(req: Request) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(req, handoverSlotSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const slot = await createHandoverSlot(await getDb(), parsed.data, auth.admin.email);
    return json({ ok: true, slot }, { status: 201 });
  } catch (err) {
    return handleAdminError(err);
  }
}
