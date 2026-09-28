import type { Metadata } from "next";
import Link from "next/link";
import { ContactMessageToggle } from "@/features/admin/emails/ContactMessageToggle";
import { EMAIL_STATUS_LABEL, EMAIL_STATUS_TONE, EMAIL_TEMPLATE_LABEL } from "@/features/admin/labels";
import { Badge, Card, EmptyState, Notice, PageHeader, tableClass, tdClass, thClass } from "@/features/admin/ui";
import { cn } from "@/lib/cn";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { requireAdminPage } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { listContactMessages, listEmailLog } from "@/server/services/admin-catalog-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "E-Mails" };

export default async function AdminEmailsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdminPage("/admin/emails");
  const sp = await searchParams;
  const tab = sp.tab === "kontakt" ? "kontakt" : "protokoll";
  const db = await getDb();
  const [mails, messages] = await Promise.all([listEmailLog(db), listContactMessages(db)]);
  const openMessages = messages.filter((m) => !m.handledAt).length;

  return (
    <>
      <PageHeader
        eyebrow="Kommunikation"
        title="E-Mails"
        description="Protokoll aller automatisch erzeugten E-Mails sowie Nachrichten aus dem Kontaktformular."
      />
      {env.demoMode || env.emailProvider === "preview" ? (
        <Notice tone="info" className="mb-5">
          Vorschau-Modus: E-Mails werden nicht versendet, sondern nur hier gespeichert. Für den echten Versand EMAIL_PROVIDER=resend konfigurieren und DEMO_MODE deaktivieren.
        </Notice>
      ) : null}

      <nav className="mb-4 flex gap-1.5" aria-label="Ansicht">
        {(
          [
            ["protokoll", `E-Mail-Protokoll (${mails.length})`],
            ["kontakt", `Kontaktanfragen${openMessages ? ` (${openMessages} offen)` : ` (${messages.length})`}`],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={key === "kontakt" ? "/admin/emails?tab=kontakt" : "/admin/emails"}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
              tab === key ? "border-ink bg-ink text-paper" : "border-stone/70 bg-white text-ink-soft hover:border-ink/40",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "protokoll" ? (
        <Card bodyClassName="p-0">
          {mails.length === 0 ? (
            <EmptyState title="Noch keine E-Mails">Sobald Anfragen oder Buchungen eingehen, erscheinen die E-Mails hier.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className={cn(tableClass, "min-w-[900px]")}>
                <thead>
                  <tr>
                    <th className={thClass}>Datum</th>
                    <th className={thClass}>Vorlage</th>
                    <th className={thClass}>Empfänger</th>
                    <th className={thClass}>Betreff</th>
                    <th className={thClass}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mails.map((m) => (
                    <tr key={m.id} className="group hover:bg-cream/45">
                      <td className={cn(tdClass, "whitespace-nowrap text-ink-soft")}>{formatDateTime(m.createdAt)}</td>
                      <td className={tdClass}>
                        <Link href={`/admin/emails/${m.id}`} className="font-semibold text-ink group-hover:underline">
                          {EMAIL_TEMPLATE_LABEL[m.template] ?? m.template}
                        </Link>
                        {m.bookingNumber && <span className="block font-mono text-xs text-muted">{m.bookingNumber}</span>}
                      </td>
                      <td className={cn(tdClass, "max-w-[220px] truncate")}>{m.to}</td>
                      <td className={cn(tdClass, "max-w-[320px]")}>
                        <Link href={`/admin/emails/${m.id}`} className="line-clamp-2">
                          {m.subject}
                        </Link>
                      </td>
                      <td className={tdClass}>
                        <Badge tone={EMAIL_STATUS_TONE[m.status] ?? "neutral"} title={m.error ?? undefined}>
                          {EMAIL_STATUS_LABEL[m.status] ?? m.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card bodyClassName="p-0">
          {messages.length === 0 ? (
            <EmptyState title="Keine Kontaktanfragen">Nachrichten aus dem Kontaktformular der Website erscheinen hier.</EmptyState>
          ) : (
            <ul className="divide-y divide-sand/70" data-testid="contact-messages">
              {messages.map((m) => (
                <li key={m.id} className={cn("grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto]", m.handledAt && "opacity-65")}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{m.subject}</p>
                      {!m.handledAt && <Badge tone="gold">offen</Badge>}
                    </div>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {m.name} ·{" "}
                      <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`} className="text-gold-dark hover:underline">
                        {m.email}
                      </a>
                      {m.phone && ` · ${m.phone}`} · {formatDateTime(m.createdAt)}
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm text-ink">{m.message}</p>
                  </div>
                  <div className="md:text-right">
                    <ContactMessageToggle id={m.id} handled={m.handledAt !== null} />
                    {m.handledAt && <p className="mt-1 text-xs text-muted">erledigt am {formatDateTime(m.handledAt)}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
