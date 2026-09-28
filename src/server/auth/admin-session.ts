import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { getDb } from "@/server/db/client";
import { adminUsers } from "@/server/db/schema";
import { errorJson } from "@/server/http";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/**
 * Server-side session checks for admin pages and route handlers
 * (defence in depth – in addition to `src/proxy.ts`).
 * The admin user is looked up in the database on every request, so deleting
 * an admin revokes access immediately even though the JWT is stateless.
 */

export interface AdminIdentity {
  id: string;
  email: string;
  name: string | null;
  role: "owner" | "staff";
}

export async function getAdminSession(): Promise<AdminIdentity | null> {
  const store = await cookies();
  const payload = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const db = await getDb();
  const [user] = await db
    .select({ id: adminUsers.id, email: adminUsers.email, name: adminUsers.name, role: adminUsers.role })
    .from(adminUsers)
    .where(eq(adminUsers.id, payload.sub));
  if (!user || user.email !== payload.email) return null;
  return user;
}

/** For server pages/layouts: redirects to the login page when there is no valid session. */
export async function requireAdminPage(currentPath?: string): Promise<AdminIdentity> {
  const admin = await getAdminSession();
  if (!admin) {
    const next = currentPath && currentPath.startsWith("/admin") && currentPath !== "/admin" ? `?next=${encodeURIComponent(currentPath)}` : "";
    redirect(`/admin/login${next}`);
  }
  return admin;
}

/**
 * For route handlers: returns the admin or a ready-made error response.
 * Mutating requests additionally require a same-origin `Origin` header
 * (CSRF defence on top of the SameSite=Lax cookie).
 */
export async function requireAdminApi(req: Request): Promise<{ ok: true; admin: AdminIdentity } | { ok: false; response: NextResponse }> {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase())) {
    const origin = req.headers.get("origin");
    if (origin) {
      const h = await headers();
      const host = h.get("x-forwarded-host") ?? h.get("host");
      let originHost: string | null = null;
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = null;
      }
      if (!host || originHost !== host) {
        return { ok: false, response: errorJson(403, "FORBIDDEN", "Anfrage von fremder Herkunft abgelehnt.") };
      }
    }
  }
  const admin = await getAdminSession();
  if (!admin) return { ok: false, response: errorJson(401, "UNAUTHORIZED", "Bitte melden Sie sich an.") };
  return { ok: true, admin };
}
