import { forwardRef, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { hrefForDom, isInternalHref, navigate } from "../router-core";

type Href = string | { pathname?: string; query?: Record<string, string | string[] | undefined>; hash?: string };

function toString(href: Href): string {
  if (typeof href === "string") return href;
  const q = href.query
    ? "?" +
      new URLSearchParams(
        Object.entries(href.query).flatMap(([k, v]) => (v === undefined ? [] : Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]])) as [string, string][],
      ).toString()
    : "";
  return (href.pathname ?? "") + q + (href.hash ? `#${href.hash}` : "");
}

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: Href;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean | null;
  children?: ReactNode;
}

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, replace, scroll, prefetch: _prefetch, onClick, children, ...rest }, ref) {
  const target = toString(href);
  const internal = isInternalHref(target);
  return (
    <a
      ref={ref}
      href={internal ? hrefForDom(target) : target}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || !internal || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        void navigate(target, { replace, scroll });
      }}
      {...rest}
    >
      {children}
    </a>
  );
});

export default Link;
