"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { headerCta, heroRoutes, isExternalHref, mainNavigation, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/cn";
import { useSelectionCount } from "@/store/booking-store";

/** Section ids the menu links to on the start page ("/#bereiche" → "bereiche"). */
const HASH_TARGETS = mainNavigation.map((i) => (i.href.startsWith("/#") ? i.href.slice(2) : null)).filter((id): id is string => Boolean(id));

/** A menu entry: next/link for own routes, a plain <a> for other websites. */
function NavAnchor({ item, className, onClick, current }: { item: NavItem; className: string; onClick?: () => void; current?: "page" | "location" }) {
  if (item.external || isExternalHref(item.href)) {
    return (
      <a href={item.href} className={className} onClick={onClick}>
        {item.label}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className} onClick={onClick} aria-current={current}>
      {item.label}
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const overHero = heroRoutes.includes(pathname);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const selectionCount = useSelectionCount();

  useEffect(() => {
    // Transparent only while a hero is on screen: a static hero until ~80px before its end,
    // the sticky tour stage until it unpins (otherwise its CTA/skip link scroll through the header).
    const onScroll = () => {
      const heroEnd = Array.from(document.querySelectorAll<HTMLElement>("[data-hero]")).reduce((max, el) => {
        if (!el.offsetHeight) return max; // hidden variant (e.g. static hero without reduced motion)
        const end = el.offsetTop + el.offsetHeight - (el.dataset.hero === "sticky" ? window.innerHeight : 80);
        return Math.max(max, end);
      }, 0);
      setScrolled(window.scrollY > (heroEnd > 0 ? heroEnd : 24));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Close the mobile menu on navigation (state adjusted during render, no effect needed).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Open mobile menu: page behind does not scroll, Escape closes (focus back on the toggle),
  // Tab cycles between the toggle and the menu entries only, and growing to desktop width closes it.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";

    const close = () => {
      setOpen(false);
      menuButtonRef.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = [
        menuButtonRef.current,
        ...Array.from(panelRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []),
      ].filter((el): el is HTMLElement => el !== null);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      const active = document.activeElement as HTMLElement | null;
      const inside = active !== null && focusables.includes(active);
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onDesktop = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onDesktop);
    return () => {
      root.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onDesktop);
    };
  }, [open]);

  // Start page: the menu entry of the section in view ("Räume", "Raumplaner") is marked.
  // One IntersectionObserver, state is only set from its callback – cheap while scrolling.
  const [sectionInView, setSectionInView] = useState<string | null>(null);
  useEffect(() => {
    if (pathname !== "/" || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<string>();
    const els = HASH_TARGETS.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        setSectionInView(HASH_TARGETS.find((id) => visible.has(id)) ?? null);
      },
      // a band across the middle of the viewport: a section counts once it fills the reading area
      { rootMargin: "-40% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  const transparent = overHero && !scrolled && !open;
  // Most specific matching route item (e.g. /galerie); hash items only on the start page, while their section is in view.
  const activeHref = mainNavigation
    .map((i) => i.href)
    .filter((href) => !href.includes("#") && !isExternalHref(href) && (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0];
  const currentOf = (item: NavItem): "page" | "location" | undefined => {
    if (item.href === activeHref) return "page";
    if (pathname === "/" && sectionInView && item.href === `/#${sectionInView}`) return "location";
    return undefined;
  };

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,color] duration-300",
          // No backdrop-filter while the menu is open: the header stays opaque and creates no containing block.
          open
            ? "border-b border-sand/70 bg-paper text-ink"
            : transparent
              ? "bg-gradient-to-b from-black/45 to-transparent text-paper"
              : "border-b border-sand/70 bg-paper/94 text-ink backdrop-blur-md",
        )}
      >
        <div className="container-page flex h-[4.75rem] items-center justify-between gap-6 md:h-[5.25rem]">
          <Link href="/" className="shrink-0 transition-opacity hover:opacity-90" aria-label="Zur Krone – Startseite">
            <Logo />
          </Link>

          <nav aria-label="Hauptnavigation" className="hidden items-center gap-1 lg:flex">
            {mainNavigation.map((item) => {
              const current = currentOf(item);
              return (
                <NavAnchor
                  key={item.href}
                  item={item}
                  current={current}
                  className={cn(
                    "nav-link px-3.5 py-2 text-[0.72rem] font-medium uppercase tracking-[0.2em] transition-colors duration-300",
                    transparent ? "text-paper/85 hover:text-paper" : "text-ink-soft hover:text-ink",
                    current && (transparent ? "text-paper" : "text-ink"),
                  )}
                />
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ButtonLink
              href={headerCta.href}
              variant={transparent ? "dark" : "primary"}
              size="sm"
              className="max-sm:hidden"
            >
              {headerCta.label}
              {selectionCount > 0 && (
                <span
                  className={cn(
                    "ml-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[0.7rem] font-bold",
                    transparent ? "bg-anthracite text-gold-light" : "bg-gold text-anthracite",
                  )}
                  aria-label={`${selectionCount} Bereiche ausgewählt`}
                >
                  {selectionCount}
                </span>
              )}
            </ButtonLink>
            <button
              type="button"
              className={cn(
                "grid h-10 w-10 place-items-center rounded-full lg:hidden",
                transparent ? "hover:bg-white/10" : "hover:bg-ink/5",
              )}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Menü schließen" : "Menü öffnen"}
              ref={menuButtonRef}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Sibling of the header, not a child: a backdrop-filter/transform on the header would otherwise
          make it the containing block of this fixed panel and clip it to the header's height. */}
      <div
        id="mobile-nav"
        ref={panelRef}
        hidden={!open}
        className="fixed inset-x-0 bottom-0 top-[4.75rem] z-40 overflow-y-auto overscroll-contain bg-paper px-5 pb-10 pt-4 md:top-[5.25rem] lg:hidden"
      >
        <nav aria-label="Mobile Navigation" className="flex flex-col">
          {mainNavigation.map((item) => {
            const current = currentOf(item);
            return (
              <NavAnchor
                key={item.href}
                item={item}
                current={current}
                onClick={() => setOpen(false)}
                className={cn(
                  "border-b border-sand py-4 font-serif text-2xl text-ink transition-colors hover:text-gold-dark active:text-gold-dark",
                  current && "text-gold-dark",
                )}
              />
            );
          })}
        </nav>
        <ButtonLink href={headerCta.href} variant="gold" size="lg" className="mt-8 w-full" onClick={() => setOpen(false)}>
          {headerCta.label}
        </ButtonLink>
      </div>
    </>
  );
}
