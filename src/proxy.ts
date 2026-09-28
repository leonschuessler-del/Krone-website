import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/server/auth/session";

/**
 * Proxy (formerly "middleware") – first line of defence for the admin area.
 *
 *  - /admin/**      without a valid session → redirect to /admin/login?next=…
 *  - /api/admin/**  without a valid session → 401 JSON
 *  - public exceptions: /admin/login, /api/admin/login, /api/admin/logout
 *
 * Every admin page and route handler verifies the session AGAIN (including a
 * database lookup of the admin user) – the proxy alone is never trusted.
 */

const PUBLIC_PATHS = new Set(["/admin/login", "/api/admin/login", "/api/admin/logout"]);

function withAdminHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const normalized = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (PUBLIC_PATHS.has(normalized)) return withAdminHeaders(NextResponse.next());

  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return withAdminHeaders(NextResponse.next());

  if (normalized.startsWith("/api/admin")) {
    return withAdminHeaders(
      NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Bitte melden Sie sich an." } }, { status: 401 }),
    );
  }
  const login = new URL("/admin/login", req.url);
  if (normalized !== "/admin") login.searchParams.set("next", `${normalized}${search}`);
  return withAdminHeaders(NextResponse.redirect(login));
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
