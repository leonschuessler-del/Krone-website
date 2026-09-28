import { requireAdminApi } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { json, parseJson } from "@/server/http";
import { createExtra } from "@/server/services/admin-catalog-service";
import { handleAdminError, revalidatePublicPages } from "@/server/services/admin-http";
import { extraSchema } from "@/server/services/admin-validation";

export const dynamic = "force-dynamic";

/** POST /api/admin/extras – create an additional service (Zusatzleistung). */
export async function POST(req: Request) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(req, extraSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const extra = await createExtra(await getDb(), parsed.data, auth.admin.email);
    revalidatePublicPages();
    return json({ ok: true, extra }, { status: 201 });
  } catch (err) {
    return handleAdminError(err);
  }
}
