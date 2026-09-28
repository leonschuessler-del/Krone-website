import { requireAdminApi } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { json, parseJson } from "@/server/http";
import { handleAdminError } from "@/server/services/admin-http";
import { createManualBlocks, listManualBlocks } from "@/server/services/admin-service";
import { adminBlockSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

/** GET /api/admin/availability-blocks – upcoming manual blocks (not tied to bookings). */
export async function GET(req: Request) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  try {
    return json({ blocks: await listManualBlocks(await getDb()) });
  } catch (err) {
    return handleAdminError(err);
  }
}

/**
 * POST /api/admin/availability-blocks – blocks one or more spaces
 * (one availability block per space). 409 names the conflicting space.
 */
export async function POST(req: Request) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(req, adminBlockSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const result = await createManualBlocks(await getDb(), parsed.data, auth.admin.email);
    return json({ ok: true, created: result.created.length, blockIds: result.created.map((c) => c.id) }, { status: 201 });
  } catch (err) {
    return handleAdminError(err);
  }
}
