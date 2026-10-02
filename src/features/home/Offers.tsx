import Link from "next/link";
import { ArrowRight, BedDouble, CalendarRange, Sparkles, Zap } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FLOOR_PRICE_PER_NIGHT, FLOOR_ROOMS_SUM, LONG_STAY_NIGHTS, LONG_STAY_PERCENT } from "@/content/hotel";
import { LASTMINUTE_DAYS, OFFERS, upcomingWeekends } from "@/domain/offers";
import { todayLocal } from "@/domain/time";
import { formatDateMedium, formatMoney } from "@/lib/format";

/**
 * "Angebote": the automatic offers of the pricing engine, explained once on the
 * home page. Nothing here is a manual discount – every card mirrors a rule in
 * domain/offers.ts or content/hotel.ts, so the price shown in the request is
 * always the price promised here.
 */
export function Offers() {
  const today = todayLocal();
  const weekends = upcomingWeekends(today);
  const cards = [
    {
      icon: Zap,
      eyebrow: OFFERS.lastminute.label,
      title: `${OFFERS.lastminute.percent} % auf die Raummiete`,
      text: `Ein Wochenende in den nächsten ${LASTMINUTE_DAYS} Tagen, das noch frei ist? Dann rechnet der Preis den Vorteil automatisch ab – ohne Code, ohne Nachfragen.`,
      detail: weekends.length ? `Nächste Termine: ${weekends.map((d) => formatDateMedium(d)).join(" · ")}` : null,
      href: "/anfrage",
      cta: "Wochenende prüfen",
    },
    {
      icon: CalendarRange,
      eyebrow: OFFERS.midweek.label,
      title: `${OFFERS.midweek.percent} % Montag bis Donnerstag`,
      text: "Firmenfeier, Trauerkaffee oder Geburtstag unter der Woche: Die Raummiete sinkt um zehn Prozent, Service und Zusatzleistungen bleiben gleich.",
      detail: "Gilt für Mietzeiten bis drei Tage.",
      href: "/anfrage",
      cta: "Termin finden",
    },
    {
      icon: Sparkles,
      eyebrow: "Wochenpreis",
      title: "7 Tage zum Preis von 6",
      text: "Die Pauschale gilt für bis zu drei Tage. Jeder weitere Tag kostet 100 € – ab dem siebten Tag nichts mehr. Eine ganze Woche kostet also so viel wie sechs Tage.",
      detail: "Aufbau am Donnerstag, Feier am Samstag, Abbau am Montag – alles in einer Pauschale.",
      href: "/anfrage",
      cta: "Woche planen",
    },
    {
      icon: BedDouble,
      eyebrow: "Ganze Etage",
      title: `${formatMoney(FLOOR_PRICE_PER_NIGHT)} pro Nacht`,
      text: `Alle acht Doppelzimmer, beide Einzelzimmer und das Apartment – das Hotel exklusiv für Ihre Gesellschaft, Frühstück inklusive. Einzeln gebucht kosten die Zimmer ${formatMoney(FLOOR_ROOMS_SUM)} ohne Apartment.`,
      detail: `Ab ${LONG_STAY_NIGHTS} Nächten sparen Sie zusätzlich ${LONG_STAY_PERCENT} % auf alle Zimmer.`,
      href: "/#hotel",
      cta: "Etage anfragen",
    },
  ];

  return (
    <section id="angebote" className="relative bg-white py-24 md:py-32" aria-labelledby="angebote-title">
      <div className="container-page">
        <SectionHeading id="angebote-title" eyebrow="Angebote" title="Gute Termine, bessere Preise." className="mb-10">
          <p>Unsere Angebote rechnet der Preis von selbst ab, sobald Ihr Termin passt. Kein Gutschein, keine Verhandlung – Sie sehen den Vorteil direkt in der Anfrage.</p>
        </SectionHeading>
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-4" data-testid="offers">
          {cards.map((c) => (
            <li key={c.eyebrow} className="flex flex-col rounded-3xl border border-sand bg-paper p-7 shadow-soft">
              <c.icon className="h-6 w-6 text-gold" aria-hidden="true" />
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-gold">{c.eyebrow}</p>
              <h3 className="mt-2 font-serif text-2xl font-semibold text-ink">{c.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{c.text}</p>
              {c.detail && <p className="mt-3 text-xs text-stone">{c.detail}</p>}
              <Link href={c.href} className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-ink hover:text-gold">
                {c.cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-stone">Alle Preise zzgl. MwSt., Angebote gelten auf die Raummiete und werden nicht kombiniert – es gilt immer der bessere Vorteil.</p>
      </div>
    </section>
  );
}
