import { requireAdminApi } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { json, parseJson } from "@/server/http";
import { deleteBundleRule, updateBundleRule } from "@/server/services/admin-catalog-service";
import { handleAdminError, revalidatePublicPages } from "@/server/services/admin-http";
import { bundleRuleSchema } from "@/server/services/admin-validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/admin/bundle-rules/:id */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(req, bundleRuleSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  try {
    const bundle = await updateBundleRule(await getDb(), id, parsed.data, auth.admin.email);
    revalidatePublicPages();
    return json({ ok: true, bundle });
  } catch (err) {
    return handleAdminError(err);
  }
}

/** DELETE /api/admin/bundle-rules/:id */
export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const result = await deleteBundleRule(await getDb(), id, auth.admin.email);
    revalidatePublicPages();
    return json({ ok: true, ...result });
  } catch (err) {
    return handleAdminError(err);
  }
}
