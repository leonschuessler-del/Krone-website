/**
 * Browser demo entry: boots the embedded database, then renders the real
 * pages of the website (server components are resolved here in the browser).
 */
import { Component, Fragment, cloneElement, createElement, isValidElement, type ErrorInfo, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import SiteLayout from "@/app/(site)/layout";
import SiteError from "@/app/(site)/error";
import NotFound from "@/app/not-found";
import * as Home from "@/app/(site)/page";
import * as Areas from "@/app/(site)/bereiche/page";
import * as Area from "@/app/(site)/bereiche/[slug]/page";
import * as Booking from "@/app/(site)/buchen/page";
import * as Confirmation from "@/app/(site)/buchung/[number]/page";
import * as Gallery from "@/app/(site)/galerie/page";
import * as Contact from "@/app/(site)/kontakt/page";
import * as Faq from "@/app/(site)/faq/page";
import * as Imprint from "@/app/(site)/impressum/page";
import * as Privacy from "@/app/(site)/datenschutz/page";
import * as Terms from "@/app/(site)/agb/page";
import * as RentalTerms from "@/app/(site)/mietbedingungen/page";
import * as HouseRules from "@/app/(site)/hausordnung/page";
import { useBookingStore } from "@/store/booking-store";
import { installApi } from "./api";
import { bootProgress, getDb } from "./browser-db";
import { getLoc, installHistoryBridge, navigate, refresh, scrollToHash, setRenderer, type Loc } from "./router-core";
import { NotFoundSignal, RedirectSignal } from "./shims/next-navigation";

type PageModule = { default: (props: never) => unknown; metadata?: { title?: unknown } };

const routes: Array<[string, PageModule]> = [
  ["/", Home as PageModule],
  ["/bereiche", Areas as PageModule],
  ["/bereiche/[slug]", Area as PageModule],
  ["/buchen", Booking as PageModule],
  ["/buchung/[number]", Confirmation as PageModule],
  ["/galerie", Gallery as PageModule],
  ["/kontakt", Contact as PageModule],
  ["/faq", Faq as PageModule],
  ["/impressum", Imprint as PageModule],
  ["/datenschutz", Privacy as PageModule],
  ["/agb", Terms as PageModule],
  ["/mietbedingungen", RentalTerms as PageModule],
  ["/hausordnung", HouseRules as PageModule],
];
const compiled = routes.map(([pattern, mod]) => {
  const names: string[] = [];
  const re = new RegExp("^" + pattern.replace(/\[(\w+)\]/g, (_, n: string) => (names.push(n), "([^/]+)")) + "$");
  return { re, names, mod };
});
function match(path: string) {
  for (const { re, names, mod } of compiled) {
    const m = path.match(re);
    if (m) return { mod, params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1]!)])) };
  }
  return null;
}

/* ---------- server-component resolution (RSC in miniature) ---------- */
type Fn = ((props: unknown) => unknown) & { $$client?: boolean; prototype?: { isReactComponent?: unknown } };

async function resolveTree(node: unknown): Promise<ReactNode> {
  if (node === null || node === undefined || typeof node === "boolean" || typeof node === "string" || typeof node === "number") return node as ReactNode;
  if (Array.isArray(node)) return Promise.all(node.map(resolveTree)) as Promise<ReactNode>;
  if (node instanceof Promise) return resolveTree(await node);
  if (isValidElement(node)) {
    const type = node.type as Fn | string | symbol | object;
    const props = node.props as Record<string, unknown>;
    if (typeof type === "function" && !type.$$client && !type.prototype?.isReactComponent) {
      const rendered = await resolveTree(await type(props));
      return node.key != null ? createElement(Fragment, { key: node.key }, rendered) : rendered;
    }
    if (props && props.children !== undefined) {
      return cloneElement(node, { children: await resolveTree(props.children) } as never);
    }
    return node;
  }
  return node as ReactNode;
}

/* ---------- rendering ---------- */
class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[demo render]", error, info.componentStack);
  }
  render() {
    if (this.state.error) return createElement(SiteError, { error: this.state.error, reset: () => this.setState({ error: null }) });
    return this.props.children;
  }
}

const container = document.getElementById("app")!;
const root = createRoot(container);
let renderSeq = 0;

function titleOf(mod: PageModule): string | null {
  const t = mod.metadata?.title;
  if (typeof t === "string") return t;
  if (t && typeof t === "object" && "absolute" in t) return String((t as { absolute: string }).absolute);
  return null;
}

async function renderRoute({ scrollTo }: { scrollTo: string | "top" | null }) {
  const seq = ++renderSeq;
  const loc: Loc = getLoc();
  const m = match(loc.path);
  document.documentElement.dataset.loading = "true";
  let content: ReactNode;
  try {
    if (!m) throw new NotFoundSignal("not found");
    const Page = m.mod.default as unknown as (p: object) => ReactNode;
    const searchParams = Object.fromEntries(new URLSearchParams(loc.search));
    content = await resolveTree(createElement(SiteLayout, null, createElement(Page, { params: Promise.resolve(m.params), searchParams: Promise.resolve(searchParams) })));
    const title = titleOf(m.mod);
    document.title = title ? `${title} · Zur Krone` : "Zur Krone – Landhotel & Gasthof in Leidersbach";
  } catch (err) {
    if (err instanceof RedirectSignal) {
      void navigate(err.href, { replace: true });
      return;
    }
    if (err instanceof NotFoundSignal) content = await resolveTree(createElement(NotFound));
    else {
      console.error("[demo page]", err);
      content = await resolveTree(createElement(SiteLayout, null, createElement(SiteError, { error: err as Error, reset: () => void refresh() })));
    }
  }
  if (seq !== renderSeq) return;
  flushSync(() => root.render(createElement(Boundary, { key: loc.path + loc.search }, content)));
  delete document.documentElement.dataset.loading;
  requestAnimationFrame(() => scrollToHash(scrollTo));
}

/* ---------- boot ----------
 * The page first shows a static snapshot of the homepage (#static) so it is
 * usable immediately. Meanwhile the database starts; the live app then renders
 * into #app and takes over at the same scroll position. If the engine cannot
 * start in this browser, the snapshot simply stays.
 */
type DemoWindow = Window & { __DEMO_STATE__?: string; __PREVIEW_OFF__?: boolean; __demoNavigate?: (href: string) => void };
const w = window as DemoWindow;

function takeOver() {
  const app = document.getElementById("app")!;
  const staticEl = document.getElementById("static");
  const y = window.scrollY;
  // keep what the visitor already picked on the snapshot map
  const picked = [...document.querySelectorAll<SVGElement>('#static #karte [data-space-id][data-selected="true"]')].map((g) => g.dataset.spaceId!);
  if (picked.length) useBookingStore.getState().setSelection(picked);
  w.__PREVIEW_OFF__ = true;
  document.querySelectorAll(".pv-dialog, .pv-menu").forEach((el) => el.remove());
  document.documentElement.style.overflow = "";
  app.hidden = false; // #app sits before #static: same content, same offset
  staticEl?.remove();
  window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
  window.dispatchEvent(new Event("resize"));
  window.dispatchEvent(new Event("scroll"));
}

async function boot() {
  w.__DEMO_STATE__ = "booting";
  bootProgress.listeners.add(() => {});
  try {
    installApi();
    await getDb();
  } catch (err) {
    console.error("[demo] engine not available", err);
    w.__DEMO_STATE__ = "failed";
    window.dispatchEvent(new Event("demo-failed"));
    return;
  }
  installHistoryBridge();
  w.__demoNavigate = (href) => void navigate(href);
  setRenderer(renderRoute);
  const initial = getLoc();
  await renderRoute({ scrollTo: null });
  takeOver();
  if (initial.path !== "/" || initial.search) scrollToHash("top");
  w.__DEMO_STATE__ = "ready";
  window.dispatchEvent(new Event("demo-ready"));
}

void boot();
