import { requireAdminApi } from "@/server/auth/admin-session";
import { json } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/session – the currently signed-in admin (never the password hash). */
export async function GET(req: Request) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  return json({ admin: auth.admin });
}
