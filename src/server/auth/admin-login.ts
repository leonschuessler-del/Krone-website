import { eq } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { adminUsers, auditLog } from "@/server/db/schema";
import { verifyPassword } from "./password";

/**
 * Credential check for the admin login. Always runs one scrypt verification
 * (also for unknown e-mail addresses) so response times do not reveal
 * whether an account exists.
 */

// scrypt hash of a random, discarded password – only used to equalise timing
const DUMMY_HASH =
  "scrypt$16384$8$1$Zm9yLXRpbWluZy1vbmx5$yQ8m0x2m3w9m1dCq6n1b0l5pM4s6wQ8y2r7u9t1v3x5z7A9C1E3G5I7K9M1O3Q5S7U9W1Y3a5c7e9g1i3k5m7o9";

export interface AuthenticatedAdmin {
  id: string;
  email: string;
  name: string | null;
  role: "owner" | "staff";
}

export async function authenticateAdmin(db: Database, email: string, password: string): Promise<AuthenticatedAdmin | null> {
  const normalized = email.trim().toLowerCase();
  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, normalized));
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH).catch(() => false);
  if (!user || !ok) {
    await db.insert(auditLog).values({ actor: normalized.slice(0, 160) || "unbekannt", action: "admin.login_failed", entity: "admin_user", entityId: user?.id ?? null });
    return null;
  }
  await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, user.id));
  await db.insert(auditLog).values({ actor: user.email, action: "admin.login", entity: "admin_user", entityId: user.id });
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
