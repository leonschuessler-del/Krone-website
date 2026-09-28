import { jwtVerify, SignJWT } from "jose";

/**
 * Admin sessions – stateless, signed JWT (HS256) in an httpOnly cookie.
 *
 * This module is deliberately free of database / Next.js request imports so
 * it can be used by `src/proxy.ts`, route handlers, server pages, scripts
 * and tests alike.
 *
 * Secret: AUTH_SECRET (≥ 32 characters recommended).
 *  - production without AUTH_SECRET → no key → login is refused
 *  - development / test without AUTH_SECRET → random per-process secret
 *    (sessions do not survive a server restart) + console warning
 */

export const SESSION_COOKIE = "krone_admin";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

const ISSUER = "zur-krone";
const AUDIENCE = "krone-admin";

export interface AdminSessionPayload {
  /** admin_users.id */
  sub: string;
  email: string;
  role: "owner" | "staff";
}

const globalForAuth = globalThis as unknown as { __kroneDevAuthSecret?: Uint8Array; __kroneAuthWarned?: boolean };

/** Returns the signing key or `null` when sessions are impossible (production without AUTH_SECRET). */
export function getSessionKey(): Uint8Array | null {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length > 0) return new TextEncoder().encode(secret);
  if (process.env.NODE_ENV === "production") return null;
  if (!globalForAuth.__kroneDevAuthSecret) {
    const bytes = new Uint8Array(48);
    globalThis.crypto.getRandomValues(bytes);
    globalForAuth.__kroneDevAuthSecret = bytes;
  }
  if (!globalForAuth.__kroneAuthWarned && process.env.NODE_ENV !== "test") {
    globalForAuth.__kroneAuthWarned = true;
    console.warn("[auth] AUTH_SECRET ist nicht gesetzt – es wird ein zufälliges Entwicklungs-Secret verwendet. Sessions enden beim Neustart des Servers.");
  }
  return globalForAuth.__kroneDevAuthSecret;
}

export class SessionConfigError extends Error {
  constructor() {
    super("AUTH_SECRET fehlt – Admin-Anmeldung ist in Produktion ohne Secret deaktiviert.");
  }
}

export async function signSession(payload: AdminSessionPayload, options: { now?: number; ttlSeconds?: number } = {}): Promise<string> {
  const key = getSessionKey();
  if (!key) throw new SessionConfigError();
  const iat = Math.floor((options.now ?? Date.now()) / 1000);
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(iat + (options.ttlSeconds ?? SESSION_TTL_SECONDS))
    .sign(key);
}

/** Verifies signature, algorithm, issuer, audience and expiry. Returns `null` for anything invalid. */
export async function verifySessionToken(token: string | null | undefined, options: { now?: number } = {}): Promise<AdminSessionPayload | null> {
  if (!token || token.length > 4096) return null;
  const key = getSessionKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: options.now !== undefined ? new Date(options.now) : undefined,
    });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    const role = payload.role === "staff" ? "staff" : "owner";
    return { sub: payload.sub, email: payload.email, role };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** Only allow same-site admin paths as post-login redirect targets (no open redirect). */
export function safeAdminRedirect(target: string | null | undefined): string {
  if (!target || typeof target !== "string") return "/admin";
  if (!target.startsWith("/admin") || target.startsWith("//") || target.includes("\\")) return "/admin";
  if (target.startsWith("/admin/login")) return "/admin";
  return target;
}
