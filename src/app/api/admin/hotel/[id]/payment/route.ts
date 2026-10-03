import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdminApi } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { hotelReservations } from "@/server/db/schema";
import { errorJson, json, parseJson } from "@/server/http";
import { chargeGuarantee, HotelPaymentError, refundHotelPayment } from "@/server/services/hotel-payment-service";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    action: z.enum(["refund", "charge"]),
    /** cents; refund: optional (default full), charge: required */
    amount: z.number().int().min(0).max(5_000_000).optional(),
    reason: z.string().trim().max(120).optional(),
  })
  .strict();

/** POST /api/admin/hotel/:id/payment – refund an online payment or charge the stored card. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  const db = await getDb();
  const [row] = await db.select({ reservationNumber: hotelReservations.reservationNumber }).from(hotelReservations).where(eq(hotelReservations.id, id));
  if (!row?.reservationNumber) return errorJson(404, "NOT_FOUND", "Reservierung nicht gefunden.");
  try {
    if (parsed.data.action === "refund") return json({ ok: true, result: await refundHotelPayment(db, row.reservationNumber, parsed.data.amount) });
    return json({ ok: true, result: await chargeGuarantee(db, row.reservationNumber, parsed.data.amount ?? 0, parsed.data.reason ?? "Stornogebühr") });
  } catch (err) {
    if (err instanceof HotelPaymentError) return errorJson(err.status, "PAYMENT", err.message);
    if (err instanceof Error) return errorJson(502, "PAYMENT_PROVIDER", err.message);
    throw err;
  }
}
