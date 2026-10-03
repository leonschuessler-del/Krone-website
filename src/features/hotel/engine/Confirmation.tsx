"use client";

import { CalendarCheck, CreditCard, Mail, ShieldCheck } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { DoneInfo } from "./storage";
import { Pill, plural } from "./ui";

const fmtDate = (d: string) => new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

/** The last screen: reservation number, what was booked, payment outcome. */
export function Confirmation({ info, outcome, onNew, homeHref }: { info: DoneInfo | null; outcome: "ok" | "abgebrochen" | null; onNew: () => void; homeHref: string }) {
  const nights = info ? Math.round((Date.parse(info.departure) - Date.parse(info.arrival)) / 86400000) : 0;
  const paid = info?.paymentStatus === "paid" || (outcome === "ok" && info?.payment === "online");
  const guaranteed = info?.paymentStatus === "guaranteed" || (outcome === "ok" && info?.payment === "guarantee");
  return (
    <div className="mx-auto max-w-3xl border border-sand bg-white p-7 shadow-[var(--shadow-soft)] md:p-10" data-testid="engine-done">
      <p className="eyebrow">Reservierung eingegangen</p>
      <h2 className="mt-3 font-serif text-[2.2rem] leading-tight text-ink">Vielen Dank{info?.firstName ? `, ${info.firstName}` : ""}!</h2>
      {info?.reservationNumber && (
        <p className="mt-3 text-ink-soft">
          Ihre Reservierungsnummer: <strong className="font-mono text-ink" data-testid="done-number">{info.reservationNumber}</strong>
        </p>
      )}
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        <li className="flex gap-3 bg-cream p-4 text-sm">
          <CalendarCheck className="h-5 w-5 shrink-0 text-gold-dark" aria-hidden />
          <span>
            <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">Aufenthalt</span>
            {info ? (
              <>
                {fmtDate(info.arrival)} bis {fmtDate(info.departure)} · {plural(nights, "Nacht", "Nächte")}
              </>
            ) : (
              "–"
            )}
            {info?.lines.length ? <span className="mt-1 block">{info.lines.map((l) => `${l.rooms} × ${l.name}`).join(", ")}</span> : null}
          </span>
        </li>
        <li className="flex gap-3 bg-cream p-4 text-sm">
          {guaranteed ? <ShieldCheck className="h-5 w-5 shrink-0 text-gold-dark" aria-hidden /> : <CreditCard className="h-5 w-5 shrink-0 text-gold-dark" aria-hidden />}
          <span>
            <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">Preis & Zahlung</span>
            {info && <span className="block font-serif text-lg">{formatMoney(info.total, "auf Anfrage")}</span>}
            {outcome === "abgebrochen" ? (
              <span className="text-danger">Die Online-Zahlung wurde abgebrochen – Ihre Reservierung bleibt bestehen, bezahlt wird im Hotel.</span>
            ) : paid ? (
              "Online bezahlt – die Zahlungsbestätigung kommt per E-Mail."
            ) : guaranteed ? (
              "Karte hinterlegt, nichts abgebucht – bezahlt wird im Hotel."
            ) : (
              "Bezahlt wird im Hotel: bar, EC oder Kreditkarte."
            )}
          </span>
        </li>
      </ul>
      <p className="mt-6 flex items-start gap-3 text-sm text-ink-soft">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold-dark" aria-hidden />
        Wir prüfen die Zimmer und bestätigen Ihnen die Reservierung persönlich per E-Mail – in der Regel innerhalb eines Tages. Kostenlose Stornierung bis zwei Tage vor Anreise.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Pill variant="primary" onClick={onNew}>
          Weitere Zimmer buchen
        </Pill>
        <a href={homeHref} className="inline-flex h-11 items-center rounded-full border border-ink/30 px-6 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-ink hover:bg-ink hover:text-paper">
          Zur Startseite
        </a>
      </div>
    </div>
  );
}
