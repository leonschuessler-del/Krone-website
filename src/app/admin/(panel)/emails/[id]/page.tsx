import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EMAIL_STATUS_LABEL, EMAIL_STATUS_TONE, EMAIL_TEMPLATE_LABEL } from "@/features/admin/labels";
import { Badge, Card, DataItem, DataList, Notice, PageHeader } from "@/features/admin/ui";
import { formatDateTime } from "@/lib/format";
import { requireAdminPage } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { getEmail } from "@/server/services/admin-catalog-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "E-Mail-Vorschau" };

export default async function AdminEmailDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage(`/admin/emails/${id}`);
  const row = await getEmail(await getDb(), id);
  if (!row) notFound();
  const { mail, bookingNumber } = row;

  return (
    <>
      <Link href="/admin/emails" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> E-Mail-Protokoll
      </Link>
      <PageHeader
        eyebrow={EMAIL_TEMPLATE_LABEL[mail.template] ?? mail.template}
        title={mail.subject}
        actions={<Badge tone={EMAIL_STATUS_TONE[mail.status] ?? "neutral"}>{EMAIL_STATUS_LABEL[mail.status] ?? mail.status}</Badge>}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[320px_1fr]">
        <Card title="Details">
          <DataList className="sm:grid-cols-1">
            <DataItem label="Empfänger">{mail.to}</DataItem>
            <DataItem label="Erstellt">{formatDateTime(mail.createdAt)} Uhr</DataItem>
            <DataItem label="Vorlage">
              <span className="font-mono text-xs">{mail.template}</span>
            </DataItem>
            {bookingNumber && mail.bookingId && (
              <DataItem label="Buchung">
                <Link href={`/admin/buchungen/${mail.bookingId}`} className="font-mono text-sm font-semibold text-gold-dark hover:underline">
                  {bookingNumber}
                </Link>
              </DataItem>
            )}
            {mail.providerId && <DataItem label="Versand-ID">{mail.providerId}</DataItem>}
          </DataList>
          {mail.error && (
            <Notice tone="danger" className="mt-4">
              Fehler beim Versand: {mail.error}
            </Notice>
          )}
        </Card>
        <div className="space-y-6">
          <Card title="Vorschau (HTML)" description="Isoliert dargestellt – Skripte und Links sind in der Vorschau deaktiviert." bodyClassName="bg-cream/50 p-3">
            <iframe title={`Vorschau: ${mail.subject}`} srcDoc={mail.html} sandbox="" className="h-[680px] w-full rounded-xl border border-sand bg-white" data-testid="email-preview" />
          </Card>
          <Card title="Textversion">
            <pre className="whitespace-pre-wrap break-words font-sans text-sm text-ink-soft">{mail.text}</pre>
          </Card>
        </div>
      </div>
    </>
  );
}
