import { requireAdminApi } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { json, parseJson } from "@/server/http";
import { createBundleRule } from "@/server/services/admin-catalog-service";
import { handleAdminError, revalidatePublicPages } from "@/server/services/admin-http";
import { bundleRuleSchema } from "@/server/services/admin-validation";

export const dynamic = "force-dynamic";

/** POST /api/admin/bundle-rules – create a combination price. */
export async function POST(req: Request) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(req, bundleRuleSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const bundle = await createBundleRule(await getDb(), parsed.data, auth.admin.email);
    revalidatePublicPages();
    return json({ ok: true, bundle }, { status: 201 });
  } catch (err) {
    return handleAdminError(err);
  }
}
