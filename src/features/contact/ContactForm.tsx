"use client";

import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

type Status = { state: "idle" } | { state: "sending" } | { state: "sent" } | { state: "error"; message: string; fields?: Record<string, string> };

/** Contact form with honeypot + minimum fill time (spam protection) and server-side validation. */
export function ContactForm({ defaultSubject = "" }: { defaultSubject?: string }) {
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const startedAt = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  // Keep keyboard/screen-reader users in context after submitting:
  // errors → first invalid field (or the general message), success → the thank-you heading.
  useEffect(() => {
    if (status.state === "error") {
      const form = formRef.current;
      const target = form?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? form?.querySelector<HTMLElement>("#cf-form-err");
      target?.focus();
    } else if (status.state === "sent") {
      doneRef.current?.focus();
    }
  }, [status]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // aria-disabled (not disabled) keeps focus on the button while sending, so guard double submits here.
    if (status.state === "sending") return;
    const form = new FormData(e.currentTarget);
    setStatus({ state: "sending" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone") || "",
          subject: form.get("subject"),
          message: form.get("message"),
          privacy: form.get("privacy") === "on",
          website: form.get("website") || "",
          startedAt: startedAt.current,
        }),
      });
      if (res.ok) {
        setStatus({ state: "sent" });
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: { message: string; details?: Record<string, string> } };
      setStatus({ state: "error", message: data.error?.message ?? "Senden fehlgeschlagen.", fields: data.error?.details });
    } catch {
      setStatus({ state: "error", message: "Verbindungsfehler – bitte später erneut versuchen." });
    }
  }

  if (status.state === "sent") {
    return (
      <div className="card-surface flex flex-col items-start gap-3 p-8">
        <CheckCircle2 className="h-8 w-8 text-success" aria-hidden />
        <h2 ref={doneRef} tabIndex={-1} className="font-serif text-3xl outline-none">Vielen Dank für Ihre Nachricht!</h2>
        <p className="text-ink-soft">Wir melden uns persönlich bei Ihnen – meist innerhalb eines Tages.</p>
      </div>
    );
  }

  const fe = status.state === "error" ? (status.fields ?? {}) : {};
  const sending = status.state === "sending";
  const errId = (field: string) => (fe[field] ? `cf-${field}-err` : undefined);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="card-surface grid gap-5 p-6 sm:grid-cols-2 sm:p-8" noValidate>
      <div>
        <label className="block">
          <span className="field-label">Name *</span>
          <input name="name" required autoComplete="name" className="field-input" aria-invalid={Boolean(fe.name)} aria-describedby={errId("name")} />
        </label>
        {fe.name && <span id="cf-name-err" className="field-error block">{fe.name}</span>}
      </div>
      <div>
        <label className="block">
          <span className="field-label">E-Mail *</span>
          <input name="email" type="email" required autoComplete="email" className="field-input" aria-invalid={Boolean(fe.email)} aria-describedby={errId("email")} />
        </label>
        {fe.email && <span id="cf-email-err" className="field-error block">{fe.email}</span>}
      </div>
      <label className="block">
        <span className="field-label">Telefon (optional)</span>
        <input name="phone" type="tel" autoComplete="tel" className="field-input" />
      </label>
      <div>
        <label className="block">
          <span className="field-label">Betreff *</span>
          <input name="subject" required defaultValue={defaultSubject} placeholder="z. B. Hochzeit im Sommer" className="field-input" aria-invalid={Boolean(fe.subject)} aria-describedby={errId("subject")} />
        </label>
        {fe.subject && <span id="cf-subject-err" className="field-error block">{fe.subject}</span>}
      </div>
      <div className="sm:col-span-2">
        <label className="block">
          <span className="field-label">Nachricht *</span>
          <textarea name="message" required rows={6} maxLength={4000} placeholder="Anlass, Wunschtermin, Gästezahl und gewünschte Räume – so können wir Ihnen gezielt antworten." className="field-input" aria-invalid={Boolean(fe.message)} aria-describedby={errId("message")} />
        </label>
        {fe.message && <span id="cf-message-err" className="field-error block">{fe.message}</span>}
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="flex items-start gap-3 sm:col-span-2">
        <input type="checkbox" name="privacy" required className="mt-1 h-5 w-5 accent-gold-dark" aria-invalid={Boolean(fe.privacy)} aria-describedby={errId("privacy")} />
        <span className="text-sm text-ink-soft">
          Ich habe die{" "}
          <Link href="/datenschutz" className="font-semibold text-gold-dark underline underline-offset-4">
            Datenschutzhinweise
          </Link>{" "}
          gelesen. Meine Angaben werden zur Beantwortung meiner Anfrage verwendet. *
        </span>
      </label>
      {fe.privacy && (
        <span id="cf-privacy-err" className="field-error -mt-3 sm:col-span-2">
          {fe.privacy}
        </span>
      )}
      <div className="sm:col-span-2">
        {/* Always mounted (empty at rest) so the live region exists before its text changes. */}
        <p id="cf-form-err" tabIndex={-1} className="mb-4 text-sm text-danger outline-none empty:mb-0" aria-live="assertive">
          {status.state === "error" ? status.message : ""}
        </p>
        <Button
          type="submit"
          variant="gold"
          size="lg"
          aria-disabled={sending || undefined}
          aria-busy={sending || undefined}
          className="aria-disabled:cursor-progress aria-disabled:opacity-60"
        >
          {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Nachricht senden
        </Button>
      </div>
    </form>
  );
}
