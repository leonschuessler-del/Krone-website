import { siteScope } from "@/config/scope";
import { getDb } from "@/server/db/client";
import { errorJson, handleServiceError, json, limitOrNull, parseJson } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { calculatePrice } from "@/server/services/pricing-service";
import { pricingSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/pricing/calculate – server-side quote (source of truth).
 * While the public site shows no prices (siteScope.showPrices === false) the
 * endpoint does not exist publicly: every request gets a 404. Internal quotes
 * are made in the admin.
 */
export async function POST(req: Request) {
  if (!siteScope.showPrices) return errorJson(404, "NOT_FOUND", "Preise gibt es auf Anfrage – bitte senden Sie uns eine unverbindliche Anfrage.");
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
