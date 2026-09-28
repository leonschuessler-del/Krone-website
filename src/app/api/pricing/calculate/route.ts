import { getDb } from "@/server/db/client";
import { handleServiceError, json, limitOrNull, parseJson } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { calculatePrice } from "@/server/services/pricing-service";
import { pricingSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

/** POST /api/pricing/calculate – server-side quote (source of truth). */
export async function POST(req: Request) {
  const limited = limitOrNull(req, "pricing", LIMITS.pricing);
  if (limited) return limited;
  const parsed = await parseJson(req, pricingSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return json({ quote: await calculatePrice(await getDb(), parsed.data) });
  } catch (err) {
    return handleServiceError(err);
  }
}
