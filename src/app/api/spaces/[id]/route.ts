import { getDb } from "@/server/db/client";
import { errorJson, handleServiceError, json } from "@/server/http";
import { listPublicSpaceViews } from "@/server/services/space-service";

export const dynamic = "force-dynamic";

/** GET /api/spaces/:id – by id or slug (public view: no amounts while prices are hidden) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const spaces = await listPublicSpaceViews(await getDb());
    const space = spaces.find((s) => s.id === id || s.slug === id);
    if (!space) return errorJson(404, "NOT_FOUND", "Bereich nicht gefunden");
    return json({ space });
  } catch (err) {
    return handleServiceError(err);
  }
}
