import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { eventTypeLabel } from "@/content/event-types";
import type { Quote } from "@/domain/pricing";
import { utcToLocal } from "@/domain/time";
import type { BookingStatus, PaymentStatus } from "@/domain/types";
import { PriceBreakdown } from "@/features/booking/PriceBreakdown";
import { BookingActions } from "@/features/admin/bookings/BookingActions";
import {
  AUDIT_ACTION_LABEL,
  BLOCK_TYPE_LABEL,
  EMAIL_STATUS_LABEL,
  EMAIL_STATUS_TONE,
  EMAIL_TEMPLATE_LABEL,
  EXTRA_PRICE_MODEL_LABEL,
  PAYMENT_KIND_LABEL,
  PAYMENT_PROVIDER_LABEL,
  PAYMENT_RECORD_STATUS_LABEL,
  RENTAL_MODE_LABEL,
} from "@/features/admin/labels";
import { Badge, Card, DataItem, DataList, DemoBadge, EmptyState, PageHeader, PaymentBadge, SpaceDot, StatusBadge, tableClass, tdClass, thClass } from "@/features/admin/ui";
import { BOOKING_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/domain/booking";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDuration, formatInstantDateLong, formatMoney, formatTime } from "@/lib/format";
import { requireAdminPage } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { getAdminBookingDetail } from "@/server/services/admin-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Buchung" };

function auditText(action: string, data: unknown): string {
  const d = (data ?? {}) as { from?: string; to?: string; blocksCreated?: number };
  if (action === "booking.status" && d.from && d.to) {
    const from = BOOKING_STATUS_LABEL[d.from as BookingStatus] ?? d.from;
    const to = BOOKING_STATUS_LABEL[d.to as BookingStatus] ?? d.to;
    return `Status: ${from} → ${to}${d.blocksCreated ? ` (${d.blocksCreated} Belegung${d.blocksCreated === 1 ? "" : "en"} angelegt)` : ""}`;
  }
  if (action === "booking.payment_status" && d.to) return `Zahlungsstatus → ${PAYMENT_STATUS_LABEL[d.to as PaymentStatus] ?? d.to}`;
  return AUDIT_ACTION_LABEL[action] ?? action;
}

export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage(`/admin/buchungen/${id}`);
  const detail = await getAdminBookingDetail(await getDb(), id);
  if (!detail) notFound();
  const { booking: b, customer: c } = detail;
  const start = b.startAt.getTime();
  const end = b.endAt.getTime();
  const sameDay = utcToLocal(start).date === utcToLocal(end).date;
  const quote = (b.quoteSnapshot as Quote | null) ?? null;
  const isInquiry = b.kind === "inquiry";

  return (
    <>
      <Link href="/admin/buchungen" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Alle Buchungen
      </Link>
      <PageHeader
        eyebrow={isInquiry ? "Anfrage" : "Buchung"}
        title={b.bookingNumber}
        description={
          <span>
            {c.firstName} {c.lastName}
            {c.company ? ` · ${c.company}` : ""} · eingegangen am {formatDateTime(b.createdAt)} Uhr
            {b.inquiryNumber ? ` · aus Anfrage ${b.inquiryNumber}` : ""}
          </span>
        }
        actions={
          <>
            <StatusBadge status={b.status as BookingStatus} />
            <PaymentBadge status={b.paymentStatus as PaymentStatus} />
            {b.reviewedAt ? <Badge tone="neutral">gesehen</Badge> : <Badge tone="gold">Neu</Badge>}
            {b.isDemo && <DemoBadge />}
          </>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)]">
        <div className="space-y-6">
          <Card title="Veranstaltung">
            <DataList>
              <DataItem label="Datum">{sameDay ? formatInstantDateLong(start) : `${formatDateTime(start)} – ${formatDateTime(end)} Uhr`}</DataItem>
              <DataItem label="Zeitraum">
                {formatTime(start)}–{formatTime(end)} Uhr{!sameDay && b.rentalMode === "hourly" ? " (bis Folgetag)" : ""}
                <span className="block text-xs text-muted">
                  {formatDuration(Math.round((end - start) / 60000))} · {RENTAL_MODE_LABEL[b.rentalMode]}
                </span>
              </DataItem>
              <DataItem label="Veranstaltungsart">{eventTypeLabel(b.eventType)}</DataItem>
              <DataItem label="Personenzahl">{b.guestCount ?? "–"}</DataItem>
              <DataItem label="Übergabe">{b.handoverAt ? `${formatDateTime(b.handoverAt)} Uhr` : "individuell abzustimmen"}</DataItem>
              <DataItem label="Rückgabe">{b.returnAt ? `${formatDateTime(b.returnAt)} Uhr` : "individuell abzustimmen"}</DataItem>
              <DataItem label="Bemerkungen des Kunden" wide>
                {b.notes ? <span className="whitespace-pre-line">{b.notes}</span> : <span className="text-muted">keine</span>}
              </DataItem>
            </DataList>
          </Card>

          <Card title="Bereiche" description={`${detail.items.length} ${detail.items.length === 1 ? "Bereich" : "Bereiche"} gebucht`} bodyClassName="p-0">
            <ul className="divide-y divide-sand/70">
              {detail.items.map(({ item, spaceName, spaceColor, spaceCode }) => (
                <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                  <SpaceDot color={spaceColor} className="h-3 w-3 ring-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {spaceName} <span className="text-xs font-normal text-muted">({spaceCode})</span>
                    </p>
                    <p className="text-xs text-muted">
                      {formatDateTime(item.startAt)} – {formatDateTime(item.endAt)} Uhr
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatMoney(item.subtotal, "auf Anfrage")}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Preis" description={quote?.appliedBundle ? `Kombi-Preis: ${quote.appliedBundle.name}` : "Preis-Snapshot zum Zeitpunkt der Buchung"}>
            {quote ? (
              <PriceBreakdown quote={quote} demo={b.isDemo || quote.isDemo} showDueNow={!isInquiry} />
            ) : (
              <DataList>
                <DataItem label="Summe">{formatMoney(b.total, "auf Anfrage")}</DataItem>
                <DataItem label="Kaution">{formatMoney(b.deposit, "–")}</DataItem>
              </DataList>
            )}
            {quote && quote.missing.length > 0 && <p className="mt-3 text-xs text-muted">Noch ohne Preis: {quote.missing.join(", ")}</p>}
          </Card>

          <Card title="Zusatzleistungen" bodyClassName={detail.extras.length ? "p-0" : undefined}>
            {detail.extras.length === 0 ? (
              <p className="text-sm text-muted">Keine Zusatzleistungen gewählt.</p>
            ) : (
              <ul className="divide-y divide-sand/70">
                {detail.extras.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span>
                      <span className="font-semibold">{e.name}</span>
                      <span className="text-muted">
                        {" "}
                        · {e.quantity}× · {EXTRA_PRICE_MODEL_LABEL[e.priceModel] ?? e.priceModel}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">{formatMoney(e.subtotal, "auf Anfrage")}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Zahlungen" bodyClassName="p-0">
            {detail.payments.length === 0 ? (
              <EmptyState title="Keine Zahlungsvorgänge">{isInquiry ? "Anfragen werden ohne Online-Zahlung angelegt." : "Es wurde noch keine Zahlung angelegt."}</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th className={thClass}>Datum</th>
                      <th className={thClass}>Art</th>
                      <th className={thClass}>Anbieter</th>
                      <th className={thClass}>Status</th>
                      <th className={cn(thClass, "text-right")}>Betrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.payments.map((p) => (
                      <tr key={p.id}>
                        <td className={tdClass}>{formatDateTime(p.createdAt)}</td>
                        <td className={tdClass}>{PAYMENT_KIND_LABEL[p.kind] ?? p.kind}</td>
                        <td className={tdClass}>
                          {PAYMENT_PROVIDER_LABEL[p.provider] ?? p.provider}
                          {p.providerRef && <span className="block max-w-[180px] truncate font-mono text-[0.7rem] text-muted">{p.providerRef}</span>}
                        </td>
                        <td className={tdClass}>
                          <Badge tone={p.status === "succeeded" ? "success" : p.status === "failed" ? "danger" : p.status === "pending" ? "warning" : "neutral"}>
                            {PAYMENT_RECORD_STATUS_LABEL[p.status] ?? p.status}
                          </Badge>
                        </td>
                        <td className={cn(tdClass, "text-right font-semibold tabular-nums")}>{formatMoney(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Belegung im Kalender" description="Verfügbarkeits-Sperren dieser Buchung (inkl. Auf-/Abbaupuffer)" bodyClassName="p-0">
            {detail.blocks.length === 0 ? (
              <EmptyState title="Keine Belegung">
                {isInquiry ? "Diese Anfrage blockiert keine Bereiche. Beim Reservieren oder Bestätigen werden die Bereiche belegt." : "Für diese Buchung existiert keine Belegung."}
              </EmptyState>
            ) : (
              <ul className="divide-y divide-sand/70">
                {detail.blocks.map((bl) => (
                  <li key={bl.id} className={cn("flex flex-wrap items-center gap-3 px-5 py-3 text-sm", !bl.active && "opacity-55")}>
                    <SpaceDot color={bl.spaceColor} className="ring-0" />
                    <span className="font-semibold">{bl.spaceName}</span>
                    <span className="text-muted">
                      {formatDateTime(bl.startAt)} – {formatDateTime(bl.endAt)} Uhr
                    </span>
                    <span className="ml-auto flex gap-1.5">
                      <Badge tone={bl.type === "booked" ? "success" : bl.type === "reserved" ? "gold" : "neutral"}>{BLOCK_TYPE_LABEL[bl.type]}</Badge>
                      {!bl.active && <Badge tone="neutral">aufgehoben</Badge>}
                      {bl.active && bl.expiresAt && <Badge tone="warning">läuft ab {formatDateTime(bl.expiresAt)}</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="E-Mails zu dieser Buchung" bodyClassName="p-0">
            {detail.emails.length === 0 ? (
              <EmptyState title="Keine E-Mails" />
            ) : (
              <ul className="divide-y divide-sand/70">
                {detail.emails.map((m) => (
                  <li key={m.id}>
                    <Link href={`/admin/emails/${m.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm transition-colors hover:bg-cream/50">
                      <span className="font-semibold">{EMAIL_TEMPLATE_LABEL[m.template] ?? m.template}</span>
                      <span className="text-muted">an {m.to}</span>
                      <span className="ml-auto flex items-center gap-2">
                        <Badge tone={EMAIL_STATUS_TONE[m.status] ?? "neutral"}>{EMAIL_STATUS_LABEL[m.status] ?? m.status}</Badge>
                        <span className="text-xs text-muted">{formatDateTime(m.createdAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6 xl:sticky xl:top-6">
          <BookingActions
            bookingId={b.id}
            bookingNumber={b.bookingNumber}
            status={b.status as BookingStatus}
            paymentStatus={b.paymentStatus as PaymentStatus}
            adminNotes={b.adminNotes}
            reviewed={b.reviewedAt !== null}
            isInquiry={isInquiry}
            customerEmail={c.email}
            hasActiveBlocks={detail.blocks.some((bl) => bl.active)}
          />

          <Card title="Kunde">
            <DataList className="sm:grid-cols-1">
              <DataItem label="Name">
                {c.firstName} {c.lastName}
                {c.company && <span className="block text-sm text-muted">{c.company}</span>}
              </DataItem>
              <DataItem label="Kontakt">
                <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-gold-dark hover:underline">
                  <Mail className="h-3.5 w-3.5" /> {c.email}
                </a>
                <a href={`tel:${c.phone.replace(/[^+0-9]/g, "")}`} className="mt-0.5 flex items-center gap-1.5 text-gold-dark hover:underline">
                  <Phone className="h-3.5 w-3.5" /> {c.phone}
                </a>
              </DataItem>
              <DataItem label="Adresse">
                {c.street} {c.houseNumber}
                <br />
                {c.postalCode} {c.city}
                <br />
                {c.country}
              </DataItem>
              {c.billingAddress && (
                <DataItem label="Rechnungsadresse">
                  {c.billingAddress.name}
                  <br />
                  {c.billingAddress.street} {c.billingAddress.houseNumber}
                  <br />
                  {c.billingAddress.postalCode} {c.billingAddress.city}, {c.billingAddress.country}
                </DataItem>
              )}
            </DataList>
          </Card>

          <Card title="Verlauf" bodyClassName="p-0">
            {detail.audit.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">Noch keine Bearbeitung durch die Verwaltung.</p>
            ) : (
              <ol className="divide-y divide-sand/70">
                {detail.audit.map((a) => (
                  <li key={a.id} className="px-5 py-2.5 text-sm">
                    <p className="font-semibold text-ink">{auditText(a.action, a.data)}</p>
                    <p className="text-xs text-muted">
                      {formatDateTime(a.createdAt)} · {a.actor}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
