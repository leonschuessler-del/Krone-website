import { getDb } from "@/server/db/client";
import { json, handleServiceError } from "@/server/http";
import { listPublicSpaceViews } from "@/server/services/space-service";

export const dynamic = "force-dynamic";

/** GET /api/spaces – all active spaces incl. map geometry and media (public view: no amounts while prices are hidden). */
export async function GET() {
  try {
    const spaces = await listPublicSpaceViews(await getDb());
    return json({ spaces });
  } catch (err) {
    return handleServiceError(err);
  }
}
