import { useMemo, useSyncExternalStore } from "react";
import { getLoc, navigate, refresh, subscribe } from "../router-core";

export class NotFoundSignal extends Error {
  digest = "NEXT_NOT_FOUND";
}
export class RedirectSignal extends Error {
  constructor(public href: string) {
    super("NEXT_REDIRECT");
  }
}

export function notFound(): never {
  throw new NotFoundSignal("not found");
}
export function redirect(href: string): never {
  throw new RedirectSignal(href);
}
export const permanentRedirect = redirect;

export function useRouter() {
  return useMemo(
    () => ({
      push: (href: string, opts?: { scroll?: boolean }) => void navigate(href, { scroll: opts?.scroll }),
      replace: (href: string, opts?: { scroll?: boolean }) => void navigate(href, { replace: true, scroll: opts?.scroll }),
      back: () => history.back(),
      forward: () => history.forward(),
      refresh: () => void refresh(),
      prefetch: () => {},
    }),
    [],
  );
}

export function usePathname() {
  return useSyncExternalStore(subscribe, () => getLoc().path, () => getLoc().path);
}

export function useSearchParams() {
  const search = useSyncExternalStore(subscribe, () => getLoc().search, () => getLoc().search);
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function useParams() {
  return {};
}

export function useSelectedLayoutSegment() {
  return null;
}
