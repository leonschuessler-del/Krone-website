import { requireAdminApi } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { json, parseJson } from "@/server/http";
import { deleteHandoverSlot, updateHandoverSlot } from "@/server/services/admin-catalog-service";
import { handleAdminError } from "@/server/services/admin-http";
import { handoverSlotPatchSchema } from "@/server/services/admin-validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/admin/handover-slots/:id */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(req, handoverSlotPatchSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  try {
    return json({ ok: true, slot: await updateHandoverSlot(await getDb(), id, parsed.data, auth.admin.email) });
  } catch (err) {
    return handleAdminError(err);
  }
}

/** DELETE /api/admin/handover-slots/:id */
export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    return json({ ok: true, ...(await deleteHandoverSlot(await getDb(), id, auth.admin.email)) });
  } catch (err) {
    return handleAdminError(err);
  }
}
