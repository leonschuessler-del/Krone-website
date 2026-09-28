import { requireAdminApi } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { json, parseJson } from "@/server/http";
import { updateSettingsByAdmin } from "@/server/services/admin-catalog-service";
import { handleAdminError, revalidatePublicPages } from "@/server/services/admin-http";
import { settingsPatchSchema } from "@/server/services/admin-validation";
import { getVenueSettings } from "@/server/services/settings-service";

export const dynamic = "force-dynamic";

/** GET /api/admin/settings – bookable hours, payment policy, holds. */
export async function GET(req: Request) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  try {
    return json({ settings: await getVenueSettings(await getDb()) });
  } catch (err) {
    return handleAdminError(err);
  }
}

/** PATCH /api/admin/settings – { bookableHours?, paymentPolicy?, holds? } */
export async function PATCH(req: Request) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(req, settingsPatchSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const settings = await updateSettingsByAdmin(await getDb(), parsed.data, auth.admin.email);
    revalidatePublicPages();
    return json({ ok: true, settings });
  } catch (err) {
    return handleAdminError(err);
  }
}
