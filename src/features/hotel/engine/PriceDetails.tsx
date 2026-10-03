"use client";

import type { ReactNode } from "react";
import { cartTotals, type Cart } from "@/domain/booking-engine";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { plural } from "./ui";

const fmtDate = (d: string) => new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

/** Sidebar "Preisdetails": one block per room, taxes line, dates, guests, total. */
export function PriceDetails({ cart, children, className }: { cart: Cart; children?: ReactNode; className?: string }) {
  const t = cartTotals(cart);
  return (
    <aside className={cn("border border-sand bg-white p-5 shadow-[var(--shadow-soft)] md:p-6", className)} aria-label="Preisdetails" data-testid="price-details">
      <h3 className="font-serif text-2xl text-ink">Preisdetails</h3>
      <div className="mt-4 space-y-3">
        {t.lines.map((l, i) => (
          <div key={l.item.id} className="border border-sand p-4 text-sm">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">Zimmer {i + 1}</p>
            <div className="mt-1 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{l.name}</p>
                <p className="text-xs text-muted">{l.rateName}</p>
                <p className="text-xs text-ink-soft underline decoration-gold-pale decoration-2 underline-offset-4">{plural(l.nights, "Nacht bleiben", "Nächte bleiben")}</p>
              </div>
              <p className="shrink-0 font-serif text-lg tabular-nums">{l.roomTotal === null ? "auf Anfrage" : formatMoney(l.roomTotal)}</p>
            </div>
            {l.extraLines.map((e) => (
              <div key={e.id} className="mt-1.5 flex justify-between text-xs text-ink-soft">
                <span>{e.quantity} × {e.name} · {plural(e.nights, "Nacht", "Nächte")}</span>
                <span className="tabular-nums">{formatMoney(e.total)}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-sand pt-2 text-xs text-muted">
              <span>Steuern und Gebühren</span>
              <span>inklusive</span>
            </div>
            <p className="mt-2 text-xs text-muted">
              {fmtDate(cart.arrival)} – {fmtDate(cart.departure)}
              <br />
              {plural(l.item.adults, "Erwachsener", "Erwachsene")}
              {l.item.children ? `, ${plural(l.item.children, "Kind", "Kinder")}` : ""}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-baseline justify-between border-t border-sand pt-4">
        <span className="font-semibold text-ink">Gesamt</span>
        <span className="font-serif text-2xl tabular-nums" data-testid="cart-total">{t.total === null ? "auf Anfrage" : formatMoney(t.total)}</span>
      </div>
      <p className="text-xs text-muted">Inklusive Frühstück und Mehrwertsteuer</p>
      {children && <div className="mt-5 flex flex-col gap-3">{children}</div>}
    </aside>
  );
}
