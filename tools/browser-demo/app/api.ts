/**
 * fetch("/api/…") → the project's real route handlers, executed in the browser.
 */
import * as availability from "@/app/api/availability/route";
import * as availabilityCheck from "@/app/api/availability/check/route";
import * as bookingIcs from "@/app/api/bookings/[number]/ics/route";
import * as bookingByNumber from "@/app/api/bookings/[number]/route";
import * as bookings from "@/app/api/bookings/route";
import * as contact from "@/app/api/contact/route";
import * as extras from "@/app/api/extras/route";
import * as handover from "@/app/api/handover/route";
import * as inquiries from "@/app/api/inquiries/route";
import * as demoConfirm from "@/app/api/payments/demo/confirm/route";
import * as paymentSession from "@/app/api/payments/session/route";
import * as pricing from "@/app/api/pricing/calculate/route";
import * as spaceById from "@/app/api/spaces/[id]/route";
import * as spaces from "@/app/api/spaces/route";

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Response | Promise<Response>;
type RouteModule = Partial<Record<"GET" | "POST" | "PATCH" | "PUT" | "DELETE", Handler>>;

const routes: Array<[string, RouteModule]> = [
  ["/api/spaces", spaces as RouteModule],
  ["/api/spaces/[id]", spaceById as RouteModule],
  ["/api/availability", availability as RouteModule],
  ["/api/availability/check", availabilityCheck as RouteModule],
  ["/api/pricing/calculate", pricing as RouteModule],
  ["/api/handover", handover as RouteModule],
  ["/api/extras", extras as RouteModule],
  ["/api/bookings", bookings as RouteModule],
  ["/api/bookings/[number]", bookingByNumber as RouteModule],
  ["/api/bookings/[number]/ics", bookingIcs as RouteModule],
  ["/api/inquiries", inquiries as RouteModule],
  ["/api/payments/session", paymentSession as RouteModule],
  ["/api/payments/demo/confirm", demoConfirm as RouteModule],
  ["/api/contact", contact as RouteModule],
];

const compiled = routes.map(([pattern, mod]) => {
  const names: string[] = [];
  const re = new RegExp("^" + pattern.replace(/\[(\w+)\]/g, (_, n: string) => (names.push(n), "([^/]+)")) + "/?$");
  return { re, names, mod };
});

const json = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ error: { code, message } }), { status, headers: { "content-type": "application/json" } });

export function installApi() {
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, "https://krone.preview/");
    const isApi = (raw.startsWith("/api/") || url.host === "krone.preview") && url.pathname.startsWith("/api/");
    if (!isApi) return original(input, init);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    for (const { re, names, mod } of compiled) {
      const m = url.pathname.match(re);
      if (!m) continue;
      const handler = mod[method as keyof RouteModule];
      if (!handler) return json(405, "METHOD_NOT_ALLOWED", "Methode nicht erlaubt");
      const params = Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1]!)]));
      const body = method === "GET" || method === "HEAD" ? undefined : (init?.body ?? (input instanceof Request ? await input.text() : undefined));
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      headers.set("origin", "https://krone.preview");
      headers.set("x-forwarded-for", "127.0.0.1");
      const req = new Request(url.href, { method, headers, body, signal: init?.signal });
      try {
        return await handler(req, { params: Promise.resolve(params) });
      } catch (err) {
        console.error("[demo api]", url.pathname, err);
        return json(500, "INTERNAL", "Interner Fehler in der Demo");
      }
    }
    return json(404, "NOT_FOUND", "Nicht gefunden");
  };
}
