import { requireAdminApi } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { errorJson, json, parseJson } from "@/server/http";
import { getAdminSpace, updateSpaceByAdmin } from "@/server/services/admin-catalog-service";
import { handleAdminError, revalidatePublicPages } from "@/server/services/admin-http";
import { adminSpacePatchSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/spaces/:id – space incl. features (admin view). */
export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const space = await getAdminSpace(await getDb(), id);
    if (!space) return errorJson(404, "NOT_FOUND", "Bereich nicht gefunden.");
    return json(space);
  } catch (err) {
    return handleAdminError(err);
  }
}

/** PATCH /api/admin/spaces/:id – edit master data, features and map geometry overrides. */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(req, adminSpacePatchSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  try {
    const result = await updateSpaceByAdmin(await getDb(), id, parsed.data, auth.admin.email);
    revalidatePublicPages();
    return json({ ok: true, ...result });
  } catch (err) {
    return handleAdminError(err);
  }
}
