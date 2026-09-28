import { authenticateAdmin } from "@/server/auth/admin-login";
import { getSessionKey, SESSION_COOKIE, sessionCookieOptions, signSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { errorJson, handleServiceError, json, limitOrNull, parseJson } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { loginSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

const GENERIC_ERROR = "E-Mail-Adresse oder Passwort ist nicht korrekt.";

/** POST /api/admin/login – e-mail + password → signed session cookie (8 h). */
export async function POST(req: Request) {
  const limited = limitOrNull(req, "admin-login", LIMITS.login);
  if (limited) return limited;

  if (!getSessionKey()) {
    return errorJson(503, "AUTH_NOT_CONFIGURED", "Die Anmeldung ist nicht konfiguriert (AUTH_SECRET fehlt). Bitte wenden Sie sich an die technische Betreuung.");
  }

  const parsed = await parseJson(req, loginSchema);
  if (!parsed.ok) return errorJson(401, "INVALID_CREDENTIALS", GENERIC_ERROR);

  try {
    const db = await getDb();
    const admin = await authenticateAdmin(db, parsed.data.email, parsed.data.password);
    if (!admin) return errorJson(401, "INVALID_CREDENTIALS", GENERIC_ERROR);
    const token = await signSession({ sub: admin.id, email: admin.email, role: admin.role });
    const res = json({ ok: true, admin: { email: admin.email, name: admin.name } });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    return handleServiceError(err);
  }
}
