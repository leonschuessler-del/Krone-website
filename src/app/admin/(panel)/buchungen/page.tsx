import type { Metadata } from "next";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { eventTypeLabel } from "@/content/event-types";
import { utcToLocal } from "@/domain/time";
import { Badge, Card, DemoBadge, EmptyState, PageHeader, PaymentBadge, SpaceChips, StatusBadge, inputClass, tableClass, tdClass, thClass } from "@/features/admin/ui";
import { cn } from "@/lib/cn";
import { formatDateMedium, formatDateTime, formatMoney, formatTime } from "@/lib/format";
import { requireAdminPage } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { BOOKING_FILTERS, listAdminBookings, type BookingFilter } from "@/server/services/admin-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Buchungen" };

const FILTER_LABEL: Record<BookingFilter, string> = {
  neu: "Neu",
  anfrage: "Anfrage",
  reserviert: "Reserviert",
  bestaetigt: "Bestätigt",
  bezahlt: "Bezahlt",
  storniert: "Storniert",
  abgeschlossen: "Abgeschlossen",
  alle: "Alle",
};

function periodLabel(start: number, end: number, rentalMode: "hourly" | "daily") {
  const s = utcToLocal(start);
  const e = utcToLocal(end);
  if (rentalMode === "daily" || (s.date !== e.date && end - start > 24 * 3_600_000)) {
    return { date: `${formatDateMedium(s.date)} – ${formatDateMedium(e.date)}`, time: `${formatTime(start)} – ${formatTime(end)} Uhr` };
  }
  return { date: formatDateMedium(s.date), time: `${formatTime(start)}–${formatTime(end)} Uhr${s.date !== e.date ? " (+1 Tag)" : ""}` };
}

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string }> }) {
  await requireAdminPage("/admin/buchungen");
  const sp = await searchParams;
  const filter: BookingFilter = (BOOKING_FILTERS as readonly string[]).includes(sp.filter ?? "") ? (sp.filter as BookingFilter) : "neu";
  const q = (sp.q ?? "").trim().slice(0, 100);
  const { items, counts } = await listAdminBookings(await getDb(), { filter, q });
  const href = (f: BookingFilter) => `/admin/buchungen?filter=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <PageHeader
        eyebrow="Buchungen & Anfragen"
        title="Buchungen"
        description="Alle Online-Buchungen und unverbindlichen Anfragen. Zeiten in Ortszeit (Europe/Berlin)."
      />

      <div className="mb-4 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <nav aria-label="Filter" className="-mx-1 overflow-x-auto pb-1 md:overflow-visible">
          <ul className="flex min-w-max gap-1.5 px-1 md:min-w-0 md:flex-wrap">
            {BOOKING_FILTERS.map((f) => {
              const active = f === filter;
              return (
                <li key={f}>
                  <Link
                    href={href(f)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                      active ? "border-ink bg-ink text-paper" : "border-stone/70 bg-white text-ink-soft hover:border-ink/40",
                    )}
                  >
                    {FILTER_LABEL[f]}
                    <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-white/15 text-gold-light" : "bg-cream text-muted")}>{counts[f]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <form method="get" action="/admin/buchungen" className="flex w-full items-center gap-2 md:max-w-md 2xl:w-96" role="search">
          <input type="hidden" name="filter" value={filter} />
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-taupe" aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Nummer, Name oder E-Mail"
              aria-label="Buchungen durchsuchen"
              className={cn(inputClass, "pl-9")}
            />
          </div>
          {q && (
            <Link href={`/admin/buchungen?filter=${filter}`} className="grid h-10 w-10 place-items-center rounded-lg border border-stone bg-white text-muted hover:text-ink" title="Suche zurücksetzen">
              <X className="h-4 w-4" />
            </Link>
          )}
        </form>
      </div>

      <Card bodyClassName="p-0">
        {items.length === 0 ? (
          <EmptyState title={q ? "Keine Treffer" : "Keine Einträge"}>
            {q ? `Für „${q}“ wurde in „${FILTER_LABEL[filter]}“ nichts gefunden.` : `In „${FILTER_LABEL[filter]}“ gibt es derzeit keine Buchungen.`}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className={cn(tableClass, "min-w-[980px]")}>
              <thead>
                <tr>
                  <th className={thClass}>Nummer</th>
                  <th className={thClass}>Kunde</th>
                  <th className={thClass}>Bereiche</th>
                  <th className={thClass}>Termin</th>
                  <th className={cn(thClass, "text-right")}>Summe</th>
                  <th className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => {
                  const period = periodLabel(b.start, b.end, b.rentalMode);
                  return (
                    <tr key={b.id} className={cn("group transition-colors hover:bg-cream/45", b.isNew && "bg-gold-pale/25")}>
                      <td className={tdClass}>
                        <Link href={`/admin/buchungen/${b.id}`} className="font-mono text-[0.83rem] font-semibold text-ink underline-offset-4 group-hover:underline">
                          {b.bookingNumber}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {b.isNew && <Badge tone="gold">Neu</Badge>}
                          <Badge tone={b.kind === "inquiry" ? "info" : "neutral"}>{b.kind === "inquiry" ? "Anfrage" : "Buchung"}</Badge>
                          {b.isDemo && <DemoBadge />}
                        </div>
                      </td>
                      <td className={tdClass}>
                        <Link href={`/admin/buchungen/${b.id}`} className="block">
                          <span className="font-semibold text-ink">{b.customerName}</span>
                          {b.company && <span className="block text-xs text-ink-soft">{b.company}</span>}
                          <span className="block text-xs text-muted">{b.email}</span>
                        </Link>
                      </td>
                      <td className={cn(tdClass, "max-w-[240px]")}>
                        <SpaceChips spaces={b.spaces} />
                      </td>
                      <td className={cn(tdClass, "whitespace-nowrap")}>
                        <span className="font-semibold text-ink">{period.date}</span>
                        <span className="block text-xs text-muted">{period.time}</span>
                        <span className="block text-xs text-muted">
                          {eventTypeLabel(b.eventType)}
                          {b.guestCount ? ` · ${b.guestCount} Pers.` : ""}
                        </span>
                      </td>
                      <td className={cn(tdClass, "whitespace-nowrap text-right font-semibold tabular-nums")}>{formatMoney(b.total, "auf Anfrage")}</td>
                      <td className={tdClass}>
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={b.status} />
                          <PaymentBadge status={b.paymentStatus} />
                          <span className="text-[0.7rem] text-muted" title="Eingang">
                            {formatDateTime(b.createdAt)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {items.length >= 200 && <p className="mt-3 text-sm text-muted">Es werden die neuesten 200 Einträge angezeigt – bitte Suche oder Filter nutzen.</p>}
    </>
  );
}
