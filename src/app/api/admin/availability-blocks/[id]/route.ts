import { requireAdminApi } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { json } from "@/server/http";
import { handleAdminError } from "@/server/services/admin-http";
import { deactivateBlock } from "@/server/services/admin-service";

export const dynamic = "force-dynamic";

/** DELETE /api/admin/availability-blocks/:id – lifts a manual block (active = false, kept for history). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    return json({ ok: true, ...(await deactivateBlock(await getDb(), id, auth.admin.email)) });
  } catch (err) {
    return handleAdminError(err);
  }
}
