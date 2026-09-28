import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, FlaskConical, Hourglass, Inbox, MessageSquare, Sparkles } from "lucide-react";
import { eventTypeLabel } from "@/content/event-types";
import { BLOCK_TYPE_LABEL } from "@/features/admin/labels";
import { Badge, Card, DemoBadge, EmptyState, KpiCard, Notice, PageHeader, SpaceChips, SpaceDot, StatusBadge } from "@/features/admin/ui";
import { env } from "@/lib/env";
import { formatDateTime, formatDayMonth, formatMoney, formatTime } from "@/lib/format";
import { utcToLocal } from "@/domain/time";
import { requireAdminPage } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { getDashboardData, requestTime } from "@/server/services/admin-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Übersicht" };

function greeting(now: number) {
  const h = Math.floor(utcToLocal(now).minutes / 60);
  return h < 11 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend";
}

export default async function AdminDashboardPage() {
  const admin = await requireAdminPage("/admin");
  const now = requestTime();
  const data = await getDashboardData(await getDb(), now);
  const { kpi } = data;

  return (
    <>
      {env.demoMode && (
        <Notice tone="warning" className="mb-6 flex items-start gap-3" >
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">DEMO-Modus aktiv.</strong> Verfügbarkeiten, Preise und Zahlungen sind Beispieldaten. E-Mails werden nicht versendet,
            sondern nur unter „E-Mails“ als Vorschau gespeichert.
          </span>
        </Notice>
      )}

      <PageHeader
        eyebrow="Übersicht"
        title={`${greeting(now)}${admin.name && admin.name !== "Administrator" ? `, ${admin.name}` : ""}`}
        description="Neue Anfragen, anstehende Termine und alles, was heute Aufmerksamkeit braucht."
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-5">
        <KpiCard label="Neu / ungesehen" value={kpi.unreviewed} tone="gold" href="/admin/buchungen?filter=neu" icon={<Sparkles className="h-4 w-4" />} hint="noch nicht bearbeitet" />
        <KpiCard label="Anfragen" value={kpi.inquiries} tone="info" href="/admin/buchungen?filter=anfrage" icon={<Inbox className="h-4 w-4" />} hint="unverbindlich, offen" />
        <KpiCard label="Reserviert" value={kpi.pending} tone="warning" href="/admin/buchungen?filter=reserviert" icon={<Hourglass className="h-4 w-4" />} hint="inkl. ausstehender Zahlungen" />
        <KpiCard label="Bestätigt" value={kpi.confirmed} tone="success" href="/admin/buchungen?filter=bestaetigt" icon={<CheckCircle2 className="h-4 w-4" />} hint="verbindlich gebucht" />
        <KpiCard label="Nächste 14 Tage" value={kpi.upcoming14} tone="dark" href="/admin/kalender" icon={<CalendarClock className="h-4 w-4" />} hint="Termine ab heute" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card
          title="Nächste Termine"
          description="Offene und bestätigte Buchungen ab heute"
          actions={
            <Link href="/admin/kalender" className="inline-flex items-center gap-1 text-sm font-semibold text-gold-dark hover:underline">
              Kalender <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
          bodyClassName="p-0"
        >
          {data.upcoming.length === 0 ? (
            <EmptyState title="Keine anstehenden Termine">Neue Buchungen und Anfragen erscheinen hier automatisch.</EmptyState>
          ) : (
            <ul className="divide-y divide-sand/70">
              {data.upcoming.map((b) => {
                const local = utcToLocal(b.start);
                return (
                  <li key={b.id}>
                    <Link href={`/admin/buchungen/${b.id}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-cream/50">
                      <div className="w-16 shrink-0 rounded-xl bg-cream px-2 py-1.5 text-center">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-gold-dark">{formatDayMonth(local.date).split(",")[0]}</p>
                        <p className="font-serif text-xl font-semibold leading-none text-ink lining-nums">{local.date.slice(8, 10)}.</p>
                        <p className="text-[0.68rem] text-muted">{local.date.slice(5, 7)}/{local.date.slice(2, 4)}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink">{b.customerName}</span>
                          {b.company && <span className="text-sm text-muted">· {b.company}</span>}
                          {b.isNew && <Badge tone="gold">Neu</Badge>}
                          {b.isDemo && <DemoBadge />}
                        </div>
                        <p className="mt-0.5 text-sm text-muted">
                          {formatTime(b.start)}–{formatTime(b.end)} Uhr · {eventTypeLabel(b.eventType)}
                          {b.guestCount ? ` · ${b.guestCount} Pers.` : ""} · <span className="font-mono text-xs">{b.bookingNumber}</span>
                        </p>
                        <div className="mt-1.5">
                          <SpaceChips spaces={b.spaces} />
                        </div>
                      </div>
                      <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
                        <StatusBadge status={b.status} />
                        <span className="text-sm font-semibold tabular-nums text-ink-soft">{formatMoney(b.total, "auf Anfrage")}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card
            title="Zu bearbeiten"
            description="Neueste ungesehene Eingänge"
            actions={
              <Link href="/admin/buchungen?filter=neu" className="inline-flex items-center gap-1 text-sm font-semibold text-gold-dark hover:underline">
                Alle <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
            bodyClassName="p-0"
          >
            {data.latest.length === 0 ? (
              <EmptyState title="Alles erledigt">Es gibt keine ungesehenen Buchungen oder Anfragen.</EmptyState>
            ) : (
              <ul className="divide-y divide-sand/70">
                {data.latest.map((b) => (
                  <li key={b.id}>
                    <Link href={`/admin/buchungen/${b.id}`} className="block px-5 py-3 transition-colors hover:bg-cream/50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{b.customerName}</span>
                        <StatusBadge status={b.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        eingegangen {formatDateTime(b.createdAt)} · <span className="font-mono">{b.bookingNumber}</span>
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Kommende Sperrzeiten"
            actions={
              <Link href="/admin/sperrzeiten" className="inline-flex items-center gap-1 text-sm font-semibold text-gold-dark hover:underline">
                Verwalten <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
            bodyClassName="p-0"
          >
            {data.upcomingBlocks.length === 0 ? (
              <EmptyState title="Keine Sperrzeiten" />
            ) : (
              <ul className="divide-y divide-sand/70">
                {data.upcomingBlocks.map((b) => (
                  <li key={b.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                    <SpaceDot color={b.spaceColor} className="mt-1.5 ring-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {b.spaceName} <span className="font-normal text-muted">· {BLOCK_TYPE_LABEL[b.type]}</span>
                      </p>
                      <p className="text-xs text-muted">
                        {formatDateTime(b.start)} – {formatDateTime(b.end)} Uhr
                      </p>
                      {b.reason && <p className="truncate text-xs text-ink-soft">{b.reason}</p>}
                    </div>
                    {b.isDemo && <DemoBadge />}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {kpi.openContactMessages > 0 && (
            <Link href="/admin/emails?tab=kontakt" className="card-surface flex items-center gap-3 px-5 py-4 transition-shadow hover:shadow-lift">
              <MessageSquare className="h-5 w-5 text-gold" />
              <span className="flex-1 text-sm">
                <strong>{kpi.openContactMessages}</strong> offene Kontaktanfrage{kpi.openContactMessages === 1 ? "" : "n"}
              </span>
              <ArrowRight className="h-4 w-4 text-muted" />
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
