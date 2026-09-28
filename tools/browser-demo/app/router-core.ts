/**
 * Minimal client router for the browser demo.
 * The document URL never changes its path (relative asset URLs stay valid);
 * the current route lives in memory and is mirrored into the hash as "#!/path?query".
 */
export interface Loc {
  path: string;
  search: string;
  hash: string;
}

type Renderer = (opts: { scrollTo: string | "top" | null }) => Promise<void>;

const nativePush = history.pushState.bind(history);
const nativeReplace = history.replaceState.bind(history);
// some embedded viewers refuse history updates – routing must keep working anyway
const origPush: typeof nativePush = (...a) => {
  try {
    nativePush(...a);
  } catch {
    /* ignore */
  }
};
const origReplace: typeof nativeReplace = (...a) => {
  try {
    nativeReplace(...a);
  } catch {
    /* ignore */
  }
};
const listeners = new Set<() => void>();
let renderer: Renderer | null = null;

export function parseHref(href: string, base: Loc = loc): Loc {
  if (href.startsWith("#!/")) href = href.slice(2);
  if (href.startsWith("#")) return { ...base, hash: href.slice(1) };
  const u = new URL(href, "https://preview.local" + base.path + base.search);
  return { path: u.pathname.replace(/\/+$/, "") || "/", search: u.search, hash: u.hash.slice(1) };
}

function initial(): Loc {
  const h = location.hash;
  if (h.startsWith("#!/")) return parseHref(h.slice(2), { path: "/", search: "", hash: "" });
  return { path: "/", search: "", hash: h.length > 1 ? h.slice(1) : "" };
}

let loc: Loc = initial();

export const getLoc = () => loc;
export const routeUrl = (l: Loc) => "#!" + l.path + l.search;

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
const notify = () => listeners.forEach((fn) => fn());

export function setRenderer(fn: Renderer) {
  renderer = fn;
}

export function scrollToHash(hash: string | "top" | null) {
  if (hash === null) return;
  if (hash === "top" || !hash) {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    return;
  }
  const el = document.getElementById(decodeURIComponent(hash));
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export async function navigate(href: string, opts: { replace?: boolean; scroll?: boolean } = {}) {
  const next = parseHref(href);
  const samePage = next.path === loc.path && next.search === loc.search;
  loc = next;
  (opts.replace ? origReplace : origPush)({ route: next }, "", routeUrl(next));
  if (samePage) {
    notify();
    if (next.hash) scrollToHash(next.hash);
    return;
  }
  notify();
  await renderer?.({ scrollTo: opts.scroll === false ? null : next.hash || "top" });
}

export function refresh() {
  return renderer?.({ scrollTo: null });
}

export function isInternalHref(href: string | null | undefined): href is string {
  if (!href) return false;
  if (href.startsWith("#!/")) return true;
  return href.startsWith("/") && !href.startsWith("//") && !/^\/(media|map|_next)\//.test(href);
}

/** Link target shown in the DOM (works for "open in new tab" too). */
export function hrefForDom(href: string) {
  if (!isInternalHref(href)) return href;
  if (href.startsWith("#!/")) return href;
  const l = parseHref(href);
  return routeUrl(l) + (l.hash ? "" : "");
}

export function installHistoryBridge() {
  // Components that sync the URL themselves (e.g. ?spaces=) must not change the
  // document path – translate their URLs into the in-memory route.
  history.replaceState = function (state: unknown, title: string, url?: string | URL | null) {
    if (typeof url === "string" && !url.startsWith("#")) {
      const next = parseHref(url);
      const pageChanged = next.path !== loc.path;
      loc = next;
      origReplace({ ...(state as object | null), route: next }, title, routeUrl(next));
      notify();
      if (pageChanged) void renderer?.({ scrollTo: null });
      return;
    }
    origReplace(state, title, url);
  };
  history.pushState = function (state: unknown, title: string, url?: string | URL | null) {
    if (typeof url === "string" && !url.startsWith("#")) {
      void navigate(url);
      return;
    }
    origPush(state, title, url);
  };
  window.addEventListener("popstate", (e) => {
    const r = (e.state as { route?: Loc } | null)?.route ?? initial();
    const pageChanged = r.path !== loc.path || r.search !== loc.search;
    loc = r;
    notify();
    if (pageChanged) void renderer?.({ scrollTo: r.hash || "top" });
  });
  window.addEventListener("hashchange", () => {
    const h = location.hash;
    if (h.startsWith("#!/")) return;
    // plain in-page anchor: remember which route it belongs to
    origReplace({ route: { ...loc, hash: h.slice(1) } }, "", h);
  });
  // plain <a href="/..."> (not next/link) → client navigation
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.("a");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    const href = a.getAttribute("href");
    if (!isInternalHref(href)) return;
    e.preventDefault();
    void navigate(href);
  });
  origReplace({ route: loc }, "", location.hash || routeUrl(loc));
}
