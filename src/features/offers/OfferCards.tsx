import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import type { YieldOffer } from "@/domain/yield";
import { formatDateMedium } from "@/lib/format";

/** The calendar's own offers (domain/yield.ts) as quiet cards with a deadline. */
export function OfferCards({ offers, limit }: { offers: YieldOffer[]; limit?: number }) {
  const list = limit ? offers.slice(0, limit) : offers;
  if (!list.length) {
    return <p className="border border-sand bg-white p-6 text-sm text-ink-soft">Derzeit gibt es keine kurzfristigen Angebote – der Kalender ist gut gefüllt. Unsere festen Vorteile für Wochentage und ganze Wochen gelten immer.</p>;
  }
  return (
    <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="yield-offers">
      {list.map((o) => (
        <li key={o.id} className="flex flex-col border border-sand bg-white p-7">
          <div className="flex items-center justify-between">
            <p className="eyebrow">{o.title}</p>
            {o.percent > 0 && <span className="bg-ink px-2 py-1 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-paper">−{o.percent} %</span>}
          </div>
          <h3 className="mt-3 font-serif text-[1.65rem] leading-tight">
            {o.kind === "longterm" ? "Monatlich statt täglich" : `${formatDateMedium(o.date)}${o.until !== o.date ? ` – ${formatDateMedium(o.until)}` : ""}`}
          </h3>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-soft">{o.text}</p>
          <div className="mt-auto flex items-center justify-between pt-6 text-xs uppercase tracking-[0.18em] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden /> {o.kind === "longterm" ? "ohne Frist" : o.expiresInDays <= 1 ? "nur noch heute" : `noch ${o.expiresInDays} Tage`}
            </span>
            <Link href={o.kind === "longterm" ? "/aktuelles#mietmodelle" : `/buchen?date=${o.date}`} className="inline-flex items-center gap-1 text-ink hover:text-gold-dark">
              {o.kind === "longterm" ? "Mietmodelle" : "Anfragen"} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
