import { requireAdminApi } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { json, parseJson } from "@/server/http";
import { deletePricingRule, updatePricingRule } from "@/server/services/admin-catalog-service";
import { handleAdminError, revalidatePublicPages } from "@/server/services/admin-http";
import { pricingRuleSchema } from "@/server/services/admin-validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/admin/pricing-rules/:id – replace all editable fields of a rule. */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(req, pricingRuleSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  try {
    const rule = await updatePricingRule(await getDb(), id, parsed.data, auth.admin.email);
    revalidatePublicPages();
    return json({ ok: true, rule });
  } catch (err) {
    return handleAdminError(err);
  }
}

/** DELETE /api/admin/pricing-rules/:id */
export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const result = await deletePricingRule(await getDb(), id, auth.admin.email);
    revalidatePublicPages();
    return json({ ok: true, ...result });
  } catch (err) {
    return handleAdminError(err);
  }
}
