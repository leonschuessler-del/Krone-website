"use client";

import { AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2, Save, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { BOOKING_STATUS_LABEL, BOOKING_TRANSITIONS, PAYMENT_STATUS_LABEL, statusBlocksAvailability } from "@/domain/booking";
import { DECLINE_REASONS, type DeclineReasonId } from "@/domain/decline";
import type { BookingStatus, PaymentStatus } from "@/domain/types";
import { cn } from "@/lib/cn";
import { adminApi, describeApiError } from "../api-client";
import { EMAIL_TEMPLATE_LABEL } from "../labels";
import { Card, Notice, StatusBadge, hintClass, inputClass, labelClass } from "../ui";

const ACTION_LABEL: Record<BookingStatus, string> = {
  draft: "Entwurf",
  inquiry: "Als Anfrage führen",
  pending: "Auf „ausstehend“ setzen",
  reserved: "Reservieren",
  confirmed: "Bestätigen",
  cancelled: "Stornieren",
  completed: "Als abgeschlossen markieren",
};

const MAIL_FOR: Partial<Record<BookingStatus, string>> = {
  confirmed: "booking_confirmed",
  cancelled: "booking_cancelled",
  reserved: "booking_changed",
  pending: "booking_changed",
  inquiry: "booking_changed",
};

const PAYMENT_OPTIONS: PaymentStatus[] = ["unpaid", "pending", "deposit_required", "deposit_paid", "paid", "partially_refunded", "refunded", "failed"];

interface Props {
  bookingId: string;
  bookingNumber: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  adminNotes: string | null;
  reviewed: boolean;
  isInquiry: boolean;
  customerEmail: string;
  hasActiveBlocks: boolean;
}

type Feedback = { tone: "success" | "danger"; text: string } | null;

export function BookingActions(props: Props) {
  const router = useRouter();
  const [pendingStatus, setPendingStatus] = useState<BookingStatus | null>(null);
  const [notify, setNotify] = useState(true);
  const [reason, setReason] = useState<DeclineReasonId>("date_taken");
  const [note, setNote] = useState("");
  const isRequest = props.status === "inquiry" || props.status === "pending";
  const declining = pendingStatus === "cancelled" && isRequest;
  const [payment, setPayment] = useState<PaymentStatus>(props.paymentStatus);
  const [notes, setNotes] = useState(props.adminNotes ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const transitions = BOOKING_TRANSITIONS[props.status].filter((s) => s !== "draft");

  async function patch(body: Record<string, unknown>, key: string, successText: string) {
    setBusy(key);
    setFeedback(null);
    const res = await adminApi<{ result: { emailSent: string | null; blocksCreated: number; calendar?: { ok: boolean; mode: string; error?: string } } }>(`/api/admin/bookings/${props.bookingId}`, { method: "PATCH", body });
    setBusy(null);
    if (!res.ok) {
      setFeedback({ tone: "danger", text: describeApiError(res) });
      return false;
    }
    const extra: string[] = [];
    if (res.data.result.blocksCreated) extra.push(`${res.data.result.blocksCreated} Bereich${res.data.result.blocksCreated === 1 ? "" : "e"} im Kalender belegt`);
    if (res.data.result.emailSent) extra.push(`E-Mail „${EMAIL_TEMPLATE_LABEL[res.data.result.emailSent] ?? res.data.result.emailSent}“ erstellt`);
    const cal = res.data.result.calendar;
    if (cal?.ok) extra.push("Apple-Kalender aktualisiert");
    else if (cal && cal.mode === "caldav") extra.push(`Kalender nicht erreichbar (${cal.error ?? "Fehler"})`);
    setFeedback({ tone: "success", text: [successText, ...extra].join(" · ") });
    router.refresh();
    return true;
  }

  async function confirmStatus() {
    if (!pendingStatus) return;
    const target = pendingStatus;
    const body: Record<string, unknown> = { status: target, notifyCustomer: notify };
    if (declining) {
      body.declineReason = reason;
      if (note.trim()) body.declineNote = note.trim();
    }
    const ok = await patch(body, "status", declining ? "Anfrage abgelehnt." : target === "confirmed" && isRequest ? "Anfrage angenommen." : `Status auf „${BOOKING_STATUS_LABEL[target]}“ gesetzt.`);
    if (ok) setPendingStatus(null);
  }

  const occupies = pendingStatus ? statusBlocksAvailability(pendingStatus) !== null : false;
  const mailTemplate = declining ? "request_declined" : pendingStatus === "confirmed" && isRequest ? "request_accepted" : pendingStatus ? MAIL_FOR[pendingStatus] : undefined;
  const open = (s: BookingStatus) => {
    setFeedback(null);
    setNotify(true);
    setNote("");
    setPendingStatus(s);
  };

  return (
    <Card title="Bearbeiten" description={`Aktueller Status: ${BOOKING_STATUS_LABEL[props.status]}`}>
      <div className="space-y-5" data-testid="booking-actions">
        {feedback && (
          <Notice tone={feedback.tone} className="flex items-start gap-2">
            {feedback.tone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span data-testid="action-feedback">{feedback.text}</span>
          </Notice>
        )}

        {isRequest && (
          <section className="rounded-2xl border border-gold/40 bg-gold-pale/40 p-4" data-testid="request-decision">
            <p className="font-semibold">Anfrage entscheiden</p>
            <p className="mt-1 text-sm text-ink-soft">Mit einem Klick annehmen oder ablehnen – der Gast bekommt sofort die passende E-Mail.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" className="!bg-success !text-white hover:!bg-success/90" onClick={() => open("confirmed")} disabled={busy !== null} data-testid="accept-request">
                <CheckCircle2 className="h-4 w-4" /> Annehmen
              </Button>
              <Button size="sm" variant="danger" onClick={() => open("cancelled")} disabled={busy !== null} data-testid="decline-request">
                <XCircle className="h-4 w-4" /> Ablehnen
              </Button>
            </div>
          </section>
        )}

        <section>
          <p className={labelClass}>Status ändern</p>
          {transitions.length === 0 ? (
            <p className="text-sm text-muted">
              Der Status <StatusBadge status={props.status} /> ist endgültig und kann nicht mehr geändert werden.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {transitions.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={s === "cancelled" ? "danger" : s === "confirmed" ? "gold" : "secondary"}
                  onClick={() => open(s)}
                  disabled={busy !== null}
                  data-transition={s}
                >
                  {ACTION_LABEL[s]}
                </Button>
              ))}
            </div>
          )}
          <p className={hintClass}>Nur zulässige Statuswechsel werden angeboten.</p>
        </section>

        <section className="border-t border-sand/70 pt-4">
          <label htmlFor="payment-status" className={labelClass}>
            Zahlungsstatus (manuell)
          </label>
          <div className="flex gap-2">
            <select id="payment-status" className={inputClass} value={payment} onChange={(e) => setPayment(e.target.value as PaymentStatus)}>
              {PAYMENT_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {PAYMENT_STATUS_LABEL[p]}
                </option>
              ))}
            </select>
            <Button size="sm" variant="secondary" className="h-[2.6rem] shrink-0" disabled={payment === props.paymentStatus || busy !== null} onClick={() => patch({ paymentStatus: payment }, "payment", "Zahlungsstatus gespeichert.")}>
              {busy === "payment" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Speichern
            </Button>
          </div>
          <p className={hintClass}>z. B. nach Eingang einer Überweisung. Es wird keine Zahlung ausgelöst.</p>
        </section>

        <section className="border-t border-sand/70 pt-4">
          <label htmlFor="admin-notes" className={labelClass}>
            Interne Notiz
          </label>
          <textarea
            id="admin-notes"
            rows={4}
            maxLength={4000}
            className={cn(inputClass, "resize-y")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Nur für die Verwaltung sichtbar"
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="secondary" disabled={notes === (props.adminNotes ?? "") || busy !== null} onClick={() => patch({ adminNotes: notes }, "notes", "Notiz gespeichert.")}>
              {busy === "notes" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Notiz speichern
            </Button>
          </div>
        </section>

        <section className="flex items-center justify-between gap-3 border-t border-sand/70 pt-4">
          <p className="text-sm text-muted">{props.reviewed ? "Als gesehen markiert." : "Noch nicht als gesehen markiert."}</p>
          <Button
            size="sm"
            variant={props.reviewed ? "ghost" : "primary"}
            disabled={busy !== null}
            onClick={() => patch({ markReviewed: !props.reviewed }, "review", props.reviewed ? "Wieder als neu markiert." : "Als gesehen markiert.")}
          >
            {props.reviewed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {props.reviewed ? "Als neu markieren" : "Als gesehen markieren"}
          </Button>
        </section>
      </div>

      <Dialog
        open={pendingStatus !== null}
        onClose={() => busy === null && setPendingStatus(null)}
        title={declining ? "Anfrage ablehnen?" : pendingStatus === "confirmed" && isRequest ? "Anfrage annehmen?" : pendingStatus ? `${ACTION_LABEL[pendingStatus]}?` : ""}
        description={`${props.bookingNumber}: ${BOOKING_STATUS_LABEL[props.status]} → ${pendingStatus ? BOOKING_STATUS_LABEL[pendingStatus] : ""}`}
        size="md"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPendingStatus(null)} disabled={busy !== null}>
              Abbrechen
            </Button>
            <Button variant={pendingStatus === "cancelled" ? "danger" : "primary"} size="sm" onClick={confirmStatus} disabled={busy !== null} data-testid="confirm-status">
              {busy === "status" && <Loader2 className="h-4 w-4 animate-spin" />}
              {declining ? "Absage senden" : pendingStatus === "confirmed" && isRequest ? "Anfrage annehmen" : pendingStatus ? ACTION_LABEL[pendingStatus] : "OK"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          {feedback?.tone === "danger" && (
            <Notice tone="danger" className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{feedback.text}</span>
            </Notice>
          )}
          {declining && (
            <div className="space-y-3">
              <label className="block">
                <span className={labelClass}>Grund der Absage</span>
                <select className={inputClass} value={reason} onChange={(e) => setReason(e.target.value as DeclineReasonId)} data-testid="decline-reason">
                  {DECLINE_REASONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <span className={hintClass}>In der E-Mail: „Leider müssen wir Ihnen absagen: {DECLINE_REASONS.find((r) => r.id === reason)?.text}“</span>
              </label>
              <label className="block">
                <span className={labelClass}>Persönliche Zeile (optional)</span>
                <textarea rows={2} maxLength={2000} className={cn(inputClass, "resize-y")} value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Am 14. Juni wäre das Haus frei." />
              </label>
            </div>
          )}
          {pendingStatus === "cancelled" && !declining && (
            <p>Die Belegung im Kalender wird aufgehoben, die Bereiche sind danach wieder frei. Dieser Schritt kann nicht rückgängig gemacht werden.</p>
          )}
          {pendingStatus === "confirmed" && isRequest && <p>Die Räume werden belegt und der Termin in den Apple-Kalender eingetragen (sofern verbunden). Der Gast erhält die Zusage mit dem Hinweis, dass wir uns telefonisch wegen Schlüsselübergabe und Kaution melden.</p>}
          {occupies && !props.hasActiveBlocks && (
            <p>Die gebuchten Bereiche werden im Kalender belegt. Ist der Zeitraum inzwischen anderweitig vergeben, wird der Wechsel abgelehnt.</p>
          )}
          {occupies && props.hasActiveBlocks && <p>Die bestehende Belegung im Kalender wird übernommen.</p>}
          {pendingStatus === "completed" && <p>Die Veranstaltung wird als abgeschlossen markiert. Die Belegung bleibt zur Dokumentation erhalten.</p>}
          {mailTemplate ? (
            <label className="flex items-start gap-2.5 rounded-xl border border-sand bg-white p-3">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#b8904a]" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              <span>
                Kunde per E-Mail informieren
                <span className="block text-xs text-muted">
                  „{EMAIL_TEMPLATE_LABEL[mailTemplate]}“ an {props.customerEmail}
                </span>
              </span>
            </label>
          ) : (
            <p className="text-muted">Bei diesem Statuswechsel wird keine E-Mail an den Kunden erstellt.</p>
          )}
        </div>
      </Dialog>
    </Card>
  );
}
