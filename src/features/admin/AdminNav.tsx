"use client";

import {
  CalendarRange,
  ClipboardList,
  Clock,
  Euro,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Mail,
  Map as MapIcon,
  Menu,
  Settings,
  Ban,
  X,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CrownMark } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";

export const ADMIN_NAV = [
  { href: "/admin", label: "Übersicht", icon: LayoutDashboard, exact: true },
  { href: "/admin/buchungen", label: "Buchungen", icon: ClipboardList },
  { href: "/admin/kalender", label: "Kalender", icon: CalendarRange },
  { href: "/admin/sperrzeiten", label: "Sperrzeiten", icon: Ban },
  { href: "/admin/bereiche", label: "Bereiche", icon: LayoutGrid },
  { href: "/admin/preise", label: "Preise & Extras", icon: Euro },
  { href: "/admin/uebergabe", label: "Übergabezeiten", icon: Clock },
  { href: "/admin/karte", label: "Karte", icon: MapIcon },
  { href: "/admin/emails", label: "E-Mails", icon: Mail },
  { href: "/admin/einstellungen", label: "Einstellungen", icon: Settings },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({ pathname, badges, onNavigate }: { pathname: string; badges: Record<string, number>; onNavigate?: () => void }) {
  return (
    <ul className="space-y-0.5">
      {ADMIN_NAV.map((item) => {
        const active = isActive(pathname, item.href, "exact" in item ? item.exact : false);
        const Icon = item.icon;
        const badge = badges[item.href];
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[0.93rem] transition-colors",
                active ? "bg-white/[0.08] font-semibold text-gold-light" : "text-paper/72 hover:bg-white/[0.05] hover:text-paper",
              )}
            >
              <span
                className={cn("absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-gold-light transition-opacity", active ? "opacity-100" : "opacity-0")}
                aria-hidden
              />
              <Icon className={cn("h-[1.05rem] w-[1.05rem] shrink-0", active ? "text-gold-light" : "text-paper/50 group-hover:text-paper/80")} aria-hidden />
              <span className="flex-1">{item.label}</span>
              {badge ? (
                <span className="rounded-full bg-gold px-1.5 py-px text-[0.7rem] font-bold leading-4 text-anthracite tabular-nums">{badge}</span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-3 px-2">
      <CrownMark className="h-7 text-gold-light" />
      <span className="flex flex-col leading-none">
        <span className="font-serif text-[1.15rem] font-semibold uppercase tracking-[0.18em] text-paper">Zur Krone</span>
        <span className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-gold-light/80">Verwaltung</span>
      </span>
    </Link>
  );
}

function Account({ email, demo }: { email: string; demo: boolean }) {
  return (
    <div className="space-y-3 border-t border-white/10 pt-4">
      {demo && (
        <p className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-gold-light">DEMO-Modus aktiv</p>
      )}
      <div className="px-1">
        <p className="text-[0.68rem] uppercase tracking-[0.16em] text-paper/45">Angemeldet als</p>
        <p className="truncate text-sm font-semibold text-paper" title={email} data-testid="admin-email">
          {email}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <form action="/api/admin/logout" method="post" className="flex-1">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-paper transition-colors hover:border-gold-light/50 hover:text-gold-light"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Abmelden
          </button>
        </form>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          title="Website in neuem Tab öffnen"
          className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-paper/70 transition-colors hover:border-gold-light/50 hover:text-gold-light"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          <span className="sr-only">Website öffnen</span>
        </a>
      </div>
    </div>
  );
}

export function AdminSidebar({ email, demo, badges }: { email: string; demo: boolean; badges: Record<string, number> }) {
  const pathname = usePathname() ?? "/admin";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="panel-dark fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-black/20 px-3 pb-4 pt-6 lg:flex" aria-label="Admin-Navigation">
        <Brand />
        <nav className="mt-8 flex-1 overflow-y-auto" aria-label="Hauptmenü">
          <NavList pathname={pathname} badges={badges} />
        </nav>
        <Account email={email} demo={demo} />
      </aside>

      {/* Mobile / tablet top bar */}
      <div className="panel-dark sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-lg border border-white/15 text-paper"
          aria-label="Menü öffnen"
          aria-expanded={open}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin-Navigation">
          <button type="button" className="absolute inset-0 bg-anthracite/60" aria-label="Menü schließen" onClick={() => setOpen(false)} />
          <div className="panel-dark absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col px-3 pb-4 pt-5 shadow-lift">
            <div className="flex items-center justify-between">
              <Brand />
              <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg text-paper/80" aria-label="Menü schließen">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-6 flex-1 overflow-y-auto">
              <NavList pathname={pathname} badges={badges} onNavigate={() => setOpen(false)} />
            </nav>
            <Account email={email} demo={demo} />
          </div>
        </div>
      )}
    </>
  );
}
