import { siteConfig } from "@/config/site";
import { env } from "@/lib/env";
import type { Database } from "@/server/db/client";
import { emailLog } from "@/server/db/schema";

/**
 * E-mail architecture.
 *  - EMAIL_PROVIDER=preview (default): nothing is sent; every mail is stored
 *    in `email_log` and can be viewed in the admin (/admin/emails).
 *  - EMAIL_PROVIDER=resend: sent via the Resend HTTP API (needs EMAIL_API_KEY
 *    and EMAIL_FROM). DEMO_MODE always forces preview.
 */

export type EmailTemplate =
  | "booking_request_received"
  | "inquiry_received"
  | "booking_confirmed"
  | "payment_received"
  | "booking_changed"
  | "booking_cancelled"
  | "handover_reminder"
  | "operator_new_request"
  | "contact_message";

export interface EmailContext {
  customerName: string;
  bookingNumber?: string;
  bookingUrl?: string;
  spaces?: string[];
  dateLabel?: string;
  timeLabel?: string;
  totalLabel?: string;
  handoverLabel?: string;
  message?: string;
}

const TEMPLATES: Record<EmailTemplate, (c: EmailContext) => { subject: string; body: string[] }> = {
  booking_request_received: (c) => ({
    subject: `Ihre Buchung ${c.bookingNumber} – Zur Krone`,
    body: [`Guten Tag ${c.customerName},`, `vielen Dank für Ihre Buchung. Wir haben Ihre Angaben erhalten.`],
  }),
  inquiry_received: (c) => ({
    subject: `Ihre Anfrage ${c.bookingNumber} – Zur Krone`,
    body: [`Guten Tag ${c.customerName},`, `vielen Dank für Ihre unverbindliche Anfrage. Wir melden uns schnellstmöglich bei Ihnen.`],
  }),
  booking_confirmed: (c) => ({
    subject: `Bestätigung ${c.bookingNumber} – Zur Krone`,
    body: [`Guten Tag ${c.customerName},`, `Ihre Buchung ist bestätigt. Wir freuen uns auf Sie!`],
  }),
  payment_received: (c) => ({
    subject: `Zahlungseingang ${c.bookingNumber} – Zur Krone`,
    body: [`Guten Tag ${c.customerName},`, `wir haben Ihre Zahlung erhalten.`],
  }),
  booking_changed: (c) => ({
    subject: `Änderung Ihrer Buchung ${c.bookingNumber}`,
    body: [`Guten Tag ${c.customerName},`, `Ihre Buchung wurde geändert. Die aktuellen Details finden Sie unten.`],
  }),
  booking_cancelled: (c) => ({
    subject: `Stornierung ${c.bookingNumber}`,
    body: [`Guten Tag ${c.customerName},`, `Ihre Buchung wurde storniert.`],
  }),
  handover_reminder: (c) => ({
    subject: `Erinnerung: Übergabe ${c.bookingNumber}`,
    body: [`Guten Tag ${c.customerName},`, `wir erinnern Sie an die Übergabe der Räumlichkeiten.`],
  }),
  operator_new_request: (c) => ({
    subject: `Neue ${c.bookingNumber?.startsWith("KA") ? "Anfrage" : "Buchung"} ${c.bookingNumber}`,
    body: [`Neue Online-${c.bookingNumber?.startsWith("KA") ? "Anfrage" : "Buchung"} von ${c.customerName}.`],
  }),
  contact_message: (c) => ({
    subject: `Kontaktanfrage von ${c.customerName}`,
    body: [c.message ?? ""],
  }),
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

export function renderEmail(template: EmailTemplate, ctx: EmailContext): { subject: string; html: string; text: string } {
  const { subject, body } = TEMPLATES[template](ctx);
  const details: Array<[string, string | undefined]> = [
    ["Referenz", ctx.bookingNumber],
    ["Bereiche", ctx.spaces?.join(", ")],
    ["Datum", ctx.dateLabel],
    ["Zeitraum", ctx.timeLabel],
    ["Übergabe", ctx.handoverLabel],
    ["Preis", ctx.totalLabel],
  ];
  const rows = details.filter(([, v]) => v);
  const text = [
    ...body,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ctx.bookingUrl ? `\nBuchung ansehen: ${ctx.bookingUrl}` : "",
    "",
    `${siteConfig.name} · ${siteConfig.address.postalCode} ${siteConfig.address.city}`,
    env.demoMode ? "\n[DEMO – diese E-Mail wurde nicht versendet]" : "",
  ].join("\n");
  const html = `<!doctype html><html lang="de"><body style="margin:0;background:#f4eee2;font-family:Arial,sans-serif;color:#231e1b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:#1c1917;padding:24px 32px;color:#d8bb7e;font-family:Georgia,serif;font-size:22px;letter-spacing:4px">ZUR KRONE</td></tr>
<tr><td style="padding:32px">${body.map((p) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(p)}</p>`).join("")}
${rows.length ? `<table role="presentation" cellpadding="6" style="margin:18px 0;border-top:1px solid #e8dfcd;width:100%">${rows.map(([k, v]) => `<tr><td style="color:#6b6158;width:120px">${escapeHtml(k)}</td><td><strong>${escapeHtml(v!)}</strong></td></tr>`).join("")}</table>` : ""}
${ctx.bookingUrl ? `<p><a href="${escapeHtml(ctx.bookingUrl)}" style="display:inline-block;background:#b8904a;color:#1c1917;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Buchung anzeigen</a></p>` : ""}
${env.demoMode ? `<p style="color:#a5711d;font-size:12px">DEMO – diese E-Mail wurde nicht versendet.</p>` : ""}
</td></tr><tr><td style="padding:18px 32px;background:#fbf8f2;color:#6b6158;font-size:12px">${escapeHtml(siteConfig.name)} · ${escapeHtml(siteConfig.address.postalCode)} ${escapeHtml(siteConfig.address.city)}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}

export async function sendEmail(
  db: Database,
  template: EmailTemplate,
  to: string,
  ctx: EmailContext,
  bookingId?: string,
): Promise<void> {
  const { subject, html, text } = renderEmail(template, ctx);
  const provider = env.demoMode ? "preview" : env.emailProvider;
  let status: "preview" | "sent" | "failed" = "preview";
  let providerId: string | null = null;
  let error: string | null = null;

  if (provider === "resend") {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.EMAIL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, html, text }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      status = "sent";
      providerId = data.id ?? null;
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : String(e);
    }
  }

  await db.insert(emailLog).values({ template, to, subject, html, text, status, providerId, error, bookingId: bookingId ?? null });
}

export function operatorEmail(): string | null {
  return process.env.EMAIL_OPERATOR_TO || siteConfig.contact.email || null;
}
