import Link from "next/link";
import { ArrowRight, BedDouble, Briefcase, CalendarRange, Clock, PartyPopper, Percent, Sparkles } from "lucide-react";
import { restaurantPackagePrice } from "@/content/pricing-anchors";
import type { YieldOffer } from "@/domain/yield";
import { formatDateMedium, formatMoney } from "@/lib/format";

const ICON = { weekend: PartyPopper, midweek: Briefcase, week: CalendarRange, longterm: BedDouble } as const;
const WHAT = {
  weekend: "Wochenende frei",
  midweek: "Wochentage frei",
  week: "Ganze Woche frei",
  longterm: "Dauerhaft mieten",
} as const;

/**
 * The calendar's own offers (domain/yield.ts) as scannable cards: icon, what
 * is free, when, what it costs now (example: Restaurant package) and how long
 * the offer lasts. Little text, clear numbers.
 */
export function OfferCards({ offers, limit }: { offers: YieldOffer[]; limit?: number }) {
  const list = limit ? offers.slice(0, limit) : offers;
  if (!list.length) {
    return <p className="border border-sand bg-white p-6 text-sm text-ink-soft">Derzeit gibt es keine kurzfristigen Angebote – der Kalender ist gut gefüllt. Unsere festen Vorteile für Wochentage und ganze Wochen gelten immer.</p>;
  }
  return (
    <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="yield-offers">
      {list.map((o) => {
        const Icon = ICON[o.kind];
        const list = restaurantPackagePrice;
        const now = o.kind === "week" ? list + 30000 : Math.round(list * (1 - o.percent / 100));
        const before = o.kind === "week" ? list + 4 * 10000 : list;
        return (
          <li key={o.id} className="hover-lift flex flex-col border border-sand bg-white" data-offer-kind={o.kind}>
            <div className="flex items-center justify-between border-b border-sand px-6 py-4">
              <span className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-cream text-gold-dark"><Icon className="h-5 w-5" strokeWidth={1.6} aria-hidden /></span>
                <span>
                  <span className="block text-[0.62rem] font-medium uppercase tracking-[0.22em] text-muted">{WHAT[o.kind]}</span>
                  <span className="block font-serif text-xl leading-tight">{o.title}</span>
                </span>
              </span>
              {o.percent > 0 ? (
                <span className="flex items-center gap-1 bg-ink px-2.5 py-1.5 text-sm font-semibold text-paper"><Percent className="h-3.5 w-3.5" aria-hidden /> −{o.percent}</span>
              ) : o.kind === "week" ? (
                <span className="flex items-center gap-1 bg-ink px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-paper"><Sparkles className="h-3.5 w-3.5" aria-hidden /> 7 für 6</span>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-px bg-sand">
              <div className="bg-white px-6 py-4">
                <p className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-muted">Wann</p>
                <p className="mt-1 font-serif text-lg leading-tight">{o.kind === "longterm" ? "Ab sofort, monatlich" : formatDateMedium(o.date)}</p>
                {o.until !== o.date && o.kind !== "longterm" && <p className="text-sm text-ink-soft">bis {formatDateMedium(o.until)}</p>}
              </div>
              <div className="bg-white px-6 py-4">
                <p className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-muted">{o.kind === "longterm" ? "Ab" : "Restaurant-Pauschale"}</p>
                {o.kind === "longterm" ? (
                  <p className="mt-1 font-serif text-lg leading-tight">490 € / Monat</p>
                ) : (
                  <>
                    <p className="mt-1 font-serif text-lg leading-tight tabular-nums">{formatMoney(now)}</p>
                    {before !== now && <p className="text-sm text-muted line-through tabular-nums">{formatMoney(before)}</p>}
                  </>
                )}
              </div>
            </div>
            <p className="px-6 pt-4 text-sm leading-relaxed text-ink-soft">{o.text}</p>
            <div className="mt-auto flex items-center justify-between px-6 py-5 text-xs uppercase tracking-[0.18em] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-gold-dark" aria-hidden /> {o.kind === "longterm" ? "ohne Frist" : o.expiresInDays <= 1 ? "nur noch heute" : `noch ${o.expiresInDays} Tage`}
              </span>
              <Link href={o.kind === "longterm" ? "/aktuelles#mietmodelle" : "/eventlocation#karte"} className="inline-flex items-center gap-1 text-ink transition-colors hover:text-gold-dark [&>svg]:transition-transform hover:[&>svg]:translate-x-0.5">
                {o.kind === "longterm" ? "Mietmodelle" : "Anfragen"} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
