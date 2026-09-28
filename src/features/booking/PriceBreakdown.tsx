import type { Quote } from "@/domain/pricing";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

/**
 * Price overview. Security deposit (Kaution) is shown separately from the
 * rental total – it is refundable and not revenue. Unknown amounts are shown
 * as "Preis folgt" / "auf Anfrage", never as 0 €.
 */
export function PriceBreakdown({
  quote,
  tone = "light",
  showDueNow = true,
  demo = false,
  className,
}: {
  quote: Quote | null;
  tone?: "light" | "dark";
  showDueNow?: boolean;
  demo?: boolean;
  className?: string;
}) {
  const muted = tone === "dark" ? "text-paper/60" : "text-muted";
  const border = tone === "dark" ? "border-white/10" : "border-sand";
  if (!quote) {
    return (
      <dl className={cn("space-y-1.5 text-sm", className)}>
        {["Miete", "Reinigung", "Zusatzleistungen", "Kaution"].map((k) => (
          <div key={k} className="flex justify-between">
            <dt className={muted}>{k}</dt>
            <dd>—</dd>
          </div>
        ))}
        <div className={cn("flex justify-between border-t pt-2 font-semibold", border)}>
          <dt>Gesamt</dt>
          <dd>—</dd>
        </div>
      </dl>
    );
  }
  const unknown = quote.bookingMode === "inquiry" ? "auf Anfrage" : "Preis folgt";
  const rentals = quote.lines.filter((l) => l.kind === "rental");
  const extras = quote.lines.filter((l) => l.kind === "extra");
  const bundle = quote.lines.find((l) => l.kind === "bundle");

  return (
    <div className={cn("text-sm", className)} data-testid="price-breakdown">
      <dl className="space-y-1.5">
        {rentals.map((l) => (
          <div key={l.refId} className="flex items-start justify-between gap-3">
            <dt>
              Miete {l.label}
              {l.detail && <span className={cn("block text-xs", muted)}>{l.detail}</span>}
            </dt>
            <dd className="shrink-0 tabular-nums">{formatMoney(l.amount, unknown)}</dd>
          </div>
        ))}
        {bundle && (
          <div className="flex items-start justify-between gap-3 text-success">
            <dt>
              {bundle.label}
              {bundle.detail && <span className={cn("block text-xs", muted)}>{bundle.detail}</span>}
            </dt>
            <dd className="shrink-0 tabular-nums">{formatMoney(bundle.amount)}</dd>
          </div>
        )}
        {extras.map((l) => (
          <div key={l.refId} className="flex items-start justify-between gap-3">
            <dt>
              {l.label}
              {l.detail && <span className={cn("block text-xs", muted)}>{l.detail}</span>}
            </dt>
            <dd className="shrink-0 tabular-nums">{formatMoney(l.amount, "auf Anfrage")}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3">
          <dt>Endreinigung</dt>
          <dd className="tabular-nums">{formatMoney(quote.cleaningTotal, unknown)}</dd>
        </div>
      </dl>
      <dl className={cn("mt-3 space-y-1.5 border-t pt-3", border)}>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="font-semibold">Mietsumme</dt>
          <dd className="font-serif text-2xl font-semibold tabular-nums" data-testid="quote-total">
            {formatMoney(quote.total, unknown)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>
            Kaution <span className={cn("text-xs", muted)}>(erstattungsfähig, separat)</span>
          </dt>
          <dd className="tabular-nums">{formatMoney(quote.deposit, unknown)}</dd>
        </div>
        {showDueNow && quote.bookingMode !== "inquiry" && (
          <div className="flex justify-between gap-3 font-semibold">
            <dt>Heute fällig</dt>
            <dd className="tabular-nums">{formatMoney(quote.dueNow, unknown)}</dd>
          </div>
        )}
      </dl>
      {(demo || quote.isDemo) && quote.total !== null && (
        <p className={cn("mt-3 text-[0.72rem] font-semibold uppercase tracking-wider", tone === "dark" ? "text-gold-light" : "text-warning")}>
          Demo-Preise – nicht verbindlich
        </p>
      )}
      {quote.notes.map((n) => (
        <p key={n} className={cn("mt-2 text-xs", muted)}>
          {n}
        </p>
      ))}
    </div>
  );
}
