import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";

export const dynamic = "force-dynamic";

function clear(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), expires: new Date(0) });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/**
 * POST /api/admin/logout – clears the session cookie.
 * HTML form posts are redirected back to the login page (303),
 * fetch/JSON callers get `{ ok: true }`.
 */
export async function POST(req: Request) {
  const wantsJson = (req.headers.get("accept") ?? "").includes("application/json");
  if (wantsJson) return clear(NextResponse.json({ ok: true }));
  return clear(NextResponse.redirect(new URL("/admin/login?abgemeldet=1", req.url), 303));
}
