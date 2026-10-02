"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { headerCta, heroRoutes, mainNavigation } from "@/config/navigation";
import { cn } from "@/lib/cn";
import { useSelectionCount } from "@/store/booking-store";

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

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const transparent = overHero && !scrolled && !open;
  // Most specific matching nav item (e.g. /bereiche/hotel → "Hotel", not "Bereiche").
  const activeHref = mainNavigation
    .map((i) => i.href)
    .filter((href) => !href.includes("#") && (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter,color] duration-300",
        transparent
          ? "bg-gradient-to-b from-black/45 to-transparent text-paper"
          : "border-b border-sand/70 bg-paper/94 text-ink backdrop-blur-md",
      )}
    >
      <div className="container-page flex h-[4.75rem] items-center justify-between gap-6 md:h-[5.25rem]">
        <Link href="/" className="shrink-0" aria-label="Zur Krone – Startseite">
          <Logo />
        </Link>

        <nav aria-label="Hauptnavigation" className="hidden items-center gap-1 lg:flex">
          {mainNavigation.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative px-3.5 py-2 text-[0.72rem] font-medium uppercase tracking-[0.2em] transition-colors",
                  transparent ? "text-paper/85 hover:text-paper" : "text-ink-soft hover:text-ink",
                  active && (transparent ? "text-paper" : "text-ink"),
                )}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-3.5 -bottom-0.5 h-px bg-gold" />
                )}
              </Link>
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
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        id="mobile-nav"
        hidden={!open}
        className="fixed inset-x-0 bottom-0 top-[4.5rem] overflow-y-auto bg-paper px-5 pb-10 pt-4 lg:hidden"
      >
        <nav aria-label="Mobile Navigation" className="flex flex-col">
          {mainNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="border-b border-sand py-4 font-serif text-2xl text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <ButtonLink href={headerCta.href} variant="gold" size="lg" className="mt-8 w-full" onClick={() => setOpen(false)}>
          {headerCta.label}
        </ButtonLink>
      </div>
    </header>
  );
}
