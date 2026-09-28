import { getDb } from "@/server/db/client";
import { json, handleServiceError } from "@/server/http";
import { listSpaceViews } from "@/server/services/space-service";

export const dynamic = "force-dynamic";

/** GET /api/spaces – all active spaces incl. map geometry and media */
export async function GET() {
  try {
    const spaces = await listSpaceViews(await getDb());
    return json({ spaces });
  } catch (err) {
    return handleServiceError(err);
  }
}
