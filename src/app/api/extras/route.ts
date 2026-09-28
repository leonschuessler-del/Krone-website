import { env } from "@/lib/env";
import { getDb } from "@/server/db/client";
import { handleServiceError, json } from "@/server/http";
import { listOfferedExtras } from "@/server/services/pricing-service";

export const dynamic = "force-dynamic";

/** GET /api/extras – additional services offered in the booking flow */
export async function GET() {
  try {
    const extras = await listOfferedExtras(await getDb());
    return json({
      demo: env.demoMode,
      extras: extras.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        category: e.category,
        priceModel: e.priceModel,
        unitPrice: e.unitPrice,
        maxQuantity: e.maxQuantity,
        confirmed: e.confirmed,
        isDemo: e.isDemo,
      })),
    });
  } catch (err) {
    return handleServiceError(err);
  }
}
