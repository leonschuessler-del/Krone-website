import { getDb } from "@/server/db/client";
import { contactMessages } from "@/server/db/schema";
import { errorJson, handleServiceError, json, limitOrNull, parseJson } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { operatorEmail, sendEmail } from "@/server/services/email-service";
import { contactMessageSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

/** POST /api/contact – contact form (honeypot + minimum fill time + rate limit as spam protection). */
export async function POST(req: Request) {
  const limited = limitOrNull(req, "contact", LIMITS.contact);
  if (limited) return limited;
  const parsed = await parseJson(req, contactMessageSchema);
  if (!parsed.ok) return parsed.response;
  const d = parsed.data;
  if (d.website || (d.startedAt && Date.now() - d.startedAt < 2500)) return errorJson(422, "SPAM", "Nachricht abgelehnt");
  try {
    const db = await getDb();
    await db.insert(contactMessages).values({ name: d.name, email: d.email, phone: d.phone || null, subject: d.subject, message: d.message });
    await sendEmail(db, "contact_message", operatorEmail() ?? "betreiber@krone.invalid (nicht konfiguriert)", {
      customerName: d.name,
      message: `${d.subject}\n\n${d.message}\n\n${d.email}${d.phone ? ` · ${d.phone}` : ""}`,
    });
    return json({ ok: true }, { status: 201 });
  } catch (err) {
    return handleServiceError(err);
  }
}
