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
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
      <div className="card-surface flex flex-col items-start gap-3 p-8" role="status">
        <CheckCircle2 className="h-8 w-8 text-success" />
        <h2 className="font-serif text-3xl">Vielen Dank für Ihre Nachricht!</h2>
        <p className="text-ink-soft">Wir melden uns so bald wie möglich bei Ihnen.</p>
      </div>
    );
  }

  const fe = status.state === "error" ? (status.fields ?? {}) : {};
  return (
    <form onSubmit={onSubmit} className="card-surface grid gap-5 p-6 sm:grid-cols-2 sm:p-8" noValidate>
      <label className="block">
        <span className="field-label">Name *</span>
        <input name="name" required autoComplete="name" className="field-input" aria-invalid={Boolean(fe.name)} />
        {fe.name && <span className="field-error">{fe.name}</span>}
      </label>
      <label className="block">
        <span className="field-label">E-Mail *</span>
        <input name="email" type="email" required autoComplete="email" className="field-input" aria-invalid={Boolean(fe.email)} />
        {fe.email && <span className="field-error">{fe.email}</span>}
      </label>
      <label className="block">
        <span className="field-label">Telefon (optional)</span>
        <input name="phone" type="tel" autoComplete="tel" className="field-input" />
      </label>
      <label className="block">
        <span className="field-label">Betreff *</span>
        <input name="subject" required defaultValue={defaultSubject} className="field-input" aria-invalid={Boolean(fe.subject)} />
        {fe.subject && <span className="field-error">{fe.subject}</span>}
      </label>
      <label className="block sm:col-span-2">
        <span className="field-label">Nachricht *</span>
        <textarea name="message" required rows={6} maxLength={4000} className="field-input" aria-invalid={Boolean(fe.message)} />
        {fe.message && <span className="field-error">{fe.message}</span>}
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="flex items-start gap-3 sm:col-span-2">
        <input type="checkbox" name="privacy" required className="mt-1 h-5 w-5 accent-gold-dark" />
        <span className="text-sm text-ink-soft">
          Ich habe die{" "}
          <Link href="/datenschutz" className="font-semibold text-gold-dark underline underline-offset-4">
            Datenschutzhinweise
          </Link>{" "}
          gelesen. Meine Angaben werden zur Beantwortung meiner Anfrage verwendet. *
        </span>
      </label>
      {status.state === "error" && (
        <p className="text-sm text-danger sm:col-span-2" role="alert">
          {fe.privacy ?? status.message}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" variant="gold" size="lg" disabled={status.state === "sending"}>
          {status.state === "sending" && <Loader2 className="h-4 w-4 animate-spin" />} Nachricht senden
        </Button>
      </div>
    </form>
  );
}
