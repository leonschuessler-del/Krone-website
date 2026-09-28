import { getDb } from "@/server/db/client";
import { errorJson, json } from "@/server/http";
import { releaseExpiredHolds } from "@/server/services/hold-service";

export const dynamic = "force-dynamic";

/** GET /api/cron/release-holds – releases expired checkout holds (call e.g. every 10 minutes). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return errorJson(401, "UNAUTHORIZED", "Nicht autorisiert");
  const released = await releaseExpiredHolds(await getDb());
  return json({ released });
}
