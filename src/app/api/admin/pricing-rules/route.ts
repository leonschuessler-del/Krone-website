import { requireAdminApi } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { json, parseJson } from "@/server/http";
import { createPricingRule, listPricingData } from "@/server/services/admin-catalog-service";
import { handleAdminError, revalidatePublicPages } from "@/server/services/admin-http";
import { pricingRuleSchema } from "@/server/services/admin-validation";

export const dynamic = "force-dynamic";

/** GET /api/admin/pricing-rules – pricing rules, bundle prices and extras. */
export async function GET(req: Request) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  try {
    return json(await listPricingData(await getDb()));
  } catch (err) {
    return handleAdminError(err);
  }
}

/** POST /api/admin/pricing-rules – create a pricing rule (amount in cents). */
export async function POST(req: Request) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(req, pricingRuleSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const rule = await createPricingRule(await getDb(), parsed.data, auth.admin.email);
    revalidatePublicPages();
    return json({ ok: true, rule }, { status: 201 });
  } catch (err) {
    return handleAdminError(err);
  }
}
