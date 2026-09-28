/**
 * Small fetch wrapper for admin client components. Sends JSON, parses the
 * `{ error: { code, message, details } }` shape of our API and sends the
 * user back to the login page when the session has expired.
 */

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; message: string; details?: Record<string, string> | unknown };

export async function adminApi<T = unknown>(url: string, options: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {}): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers: { Accept: "application/json", ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, code: "NETWORK", message: "Keine Verbindung zum Server. Bitte erneut versuchen." };
  }
  const data = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string; details?: unknown } } | null;
  if (res.status === 401 && typeof window !== "undefined") {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.assign(`/admin/login?next=${next}`);
  }
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      code: data?.error?.code ?? "ERROR",
      message: data?.error?.message ?? `Fehler ${res.status}`,
      details: data?.error?.details,
    };
  }
  return { ok: true, data: data as T };
}

/** Formats validation details (field → message) as one readable line. */
export function describeApiError(result: { message: string; details?: unknown }): string {
  const d = result.details;
  if (d && typeof d === "object" && !Array.isArray(d)) {
    const entries = Object.entries(d as Record<string, unknown>).filter(([, v]) => typeof v === "string");
    if (entries.length) return `${result.message} (${entries.map(([k, v]) => `${k}: ${v}`).join("; ")})`;
  }
  return result.message;
}
