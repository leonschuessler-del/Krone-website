import { requireAdminApi } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { json, parseJson } from "@/server/http";
import { deleteExtra, updateExtra } from "@/server/services/admin-catalog-service";
import { handleAdminError, revalidatePublicPages } from "@/server/services/admin-http";
import { extraSchema } from "@/server/services/admin-validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/admin/extras/:id */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(req, extraSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  try {
    const extra = await updateExtra(await getDb(), id, parsed.data, auth.admin.email);
    revalidatePublicPages();
    return json({ ok: true, extra });
  } catch (err) {
    return handleAdminError(err);
  }
}

/** DELETE /api/admin/extras/:id – deletes, or deactivates when already used by bookings. */
export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const result = await deleteExtra(await getDb(), id, auth.admin.email);
    revalidatePublicPages();
    return json({ ok: true, ...result });
  } catch (err) {
    return handleAdminError(err);
  }
}
