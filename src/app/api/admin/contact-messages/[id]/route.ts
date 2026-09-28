import { requireAdminApi } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { json, parseJson } from "@/server/http";
import { setContactMessageHandled } from "@/server/services/admin-catalog-service";
import { handleAdminError } from "@/server/services/admin-http";
import { contactMessagePatchSchema } from "@/server/services/admin-validation";

export const dynamic = "force-dynamic";

/** PATCH /api/admin/contact-messages/:id – { handled: boolean } ("erledigt") */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(req, contactMessagePatchSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  try {
    const row = await setContactMessageHandled(await getDb(), id, parsed.data.handled, auth.admin.email);
    return json({ ok: true, id: row.id, handledAt: row.handledAt?.toISOString() ?? null });
  } catch (err) {
    return handleAdminError(err);
  }
}
