import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";
import { BedDouble, Beer, Briefcase, CalendarCheck, CalendarRange, ChefHat, Check, KeyRound, Music, Users, UtensilsCrossed, Zap, type LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FLOOR_NIGHT_TIERS, FLOOR_PRICE_PER_NIGHT } from "@/content/hotel";
import { longtermCopy, rentalModels } from "@/content/longterm";
import { OFFERS } from "@/domain/offers";
import { OfferCards } from "@/features/offers/OfferCards";
import { formatMoney } from "@/lib/format";
import { getPropertyGallery } from "@/lib/media";
import { getDb } from "@/server/db/client";
import { listYieldOffers } from "@/server/services/offers-service";

export const dynamic = "force-dynamic";

/** One glyph per rental model (content/longterm.ts → rentalModels), keyed by id. */
const MODEL_ICON: Record<string, LucideIcon> = {
  "kitchen-monthly": ChefHat,
  "hall-club": Beer,
  "studio-monthly": Music,
  popup: UtensilsCrossed,
  "whole-house": KeyRound,
};

export const metadata: Metadata = {
  title: "Aktuelles & Angebote",
  description: "Freie Termine mit Vorteil, feste Angebote für Wochentage und ganze Wochen, die ganze Hotel-Etage zum Festpreis und Mietmodelle für regelmäßige Nutzer der Krone.",
  alternates: { canonical: "/aktuelles" },
};

export default async function NewsPage() {
  const offers = await listYieldOffers(await getDb()).catch(() => []);
  const hero = getPropertyGallery()[2] ?? getPropertyGallery()[0] ?? null;
  // Same icon vocabulary as the offer cards above; the number is the one gold word per title.
  const fixed: Array<{ icon: LucideIcon; eyebrow: string; title: ReactNode; text: string }> = [
    {
      icon: Briefcase,
      eyebrow: OFFERS.midweek.label,
      title: (
        <>
          <span className="accent">{OFFERS.midweek.percent} %</span> Montag bis Donnerstag
        </>
      ),
      text: "Firmenfeier, Tagung oder Trauerkaffee unter der Woche: Die Raummiete sinkt um zehn Prozent, Zusatzleistungen bleiben gleich. Für Mietzeiten bis drei Tage.",
    },
    {
      icon: Zap,
      eyebrow: OFFERS.lastminute.label,
      title: (
        <>
          <span className="accent">{OFFERS.lastminute.percent} %</span> auf freie Wochenenden
        </>
      ),
      text: "Ein Wochenende in den nächsten drei Wochen, das noch frei ist, rechnet der Preis automatisch günstiger – ohne Code, ohne Nachfragen.",
    },
    {
      icon: CalendarRange,
      eyebrow: "Wochenpreis",
      title: (
        <>
          <span className="accent">7 Tage</span> zum Preis von 6
        </>
      ),
      text: "Die Pauschale gilt bis drei Tage, jeder weitere Tag kostet 100 €, ab dem siebten Tag nichts mehr. Aufbau am Donnerstag, Feier am Samstag, Abbau am Montag.",
    },
    {
      icon: BedDouble,
      eyebrow: "Ganze Etage zur Feier",
      title: (
        <>
          <span className="accent">{formatMoney(FLOOR_PRICE_PER_NIGHT)}</span> pro Nacht
        </>
      ),
      text: `Alle zehn Zimmer und das Apartment exklusiv für Ihre Gesellschaft, Frühstück für alle. Ab ${FLOOR_NIGHT_TIERS.map((t) => `${t.nights} Nächten −${t.percent} %`).join(", ab ")} pro Nacht. Nur zusammen mit einer Veranstaltung.`,
    },
  ];
  return (
    <article>
      <header className="relative isolate flex min-h-[64svh] items-end overflow-hidden bg-anthracite text-paper" data-hero>
        {hero && <Image src={hero.src} alt="" fill priority sizes="100vw" className="object-cover opacity-60" />}
        <div className="absolute inset-0 bg-gradient-to-t from-anthracite via-anthracite/55 to-anthracite/35" /><div className="absolute inset-0 bg-gradient-to-r from-anthracite/70 via-transparent to-transparent" />
        <div className="container-page relative pb-16 pt-40 text-shadow-hero">
          <p className="eyebrow !text-gold-light">Aktuelles & Angebote</p>
          <h1 className="mt-5 max-w-3xl text-[3rem] font-light leading-[0.98] md:text-[4.8rem]">
            Gute Termine, <em><span className="accent">bessere</span> Preise.</em>
          </h1>
          <p className="mt-6 max-w-xl text-lg font-light text-paper/85">Unsere Angebote macht der Kalender: Was frei bleibt, wird günstiger – nie das, was ohnehin gefragt ist. Zimmerpreise bleiben immer gleich.</p>
        </div>
      </header>

      <section className="bg-paper py-24" aria-labelledby="live-title">
        <div className="container-page">
          <SectionHeading id="live-title" eyebrow="Jetzt frei" title="Angebote dieser Wochen." className="mb-10">
            <p>Automatisch aus dem Belegungskalender: Sobald ein Termin angefragt ist, verschwindet sein Angebot.</p>
          </SectionHeading>
          <OfferCards offers={offers} />
        </div>
      </section>

      <section className="bg-cream py-24" aria-labelledby="fixed-title">
        <div className="container-page">
          <SectionHeading id="fixed-title" eyebrow="Immer gültig" title="Vier feste Vorteile." className="mb-10" />
          <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {fixed.map((f) => (
              <li key={f.eyebrow} className="flex flex-col border border-sand bg-white p-7">
                <f.icon className="h-6 w-6 text-gold-dark" strokeWidth={1.5} aria-hidden />
                <p className="eyebrow mt-5">{f.eyebrow}</p>
                <h3 className="mt-3 font-serif text-[1.7rem] leading-tight">{f.title}</h3>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-soft">{f.text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-muted">Alle Raumpreise zzgl. MwSt. Angebote gelten auf die Raummiete, werden nicht kombiniert – es gilt der bessere Vorteil. Hotelzimmer werden einzeln nie rabattiert.</p>
          <ButtonLink href="/eventlocation#karte" variant="primary" className="mt-8">
            Termin finden
          </ButtonLink>
        </div>
      </section>

      <section id="mietmodelle" className="scroll-mt-24 bg-paper py-24 md:py-32" aria-labelledby="longterm-title">
        <div className="container-page">
          <SectionHeading id="longterm-title" eyebrow={longtermCopy.eyebrow} title={longtermCopy.title} className="mb-12">
            <p>{longtermCopy.text}</p>
          </SectionHeading>
          <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="rental-models">
            {rentalModels.map((m) => {
              const Icon = MODEL_ICON[m.id] ?? KeyRound;
              return (
                <li key={m.id} className="flex flex-col border border-sand bg-white p-7 transition-[border-color,box-shadow] duration-300 hover:border-gold/50 hover:shadow-soft">
                  <Icon className="h-6 w-6 text-gold-dark" strokeWidth={1.5} aria-hidden />
                  <p className="eyebrow mt-5">{m.eyebrow}</p>
                  <h3 className="mt-3 font-serif text-[1.7rem] leading-tight">{m.name}</h3>
                  <p className="mt-4">
                    <span className="font-serif text-3xl tabular-nums">{m.monthly === null ? "auf Anfrage" : formatMoney(m.monthly)}</span>
                    <span className="block text-xs uppercase tracking-[0.18em] text-muted">{m.unit}</span>
                    {m.yearly && m.monthly && (
                      <span className="mt-2 inline-flex items-center gap-1.5 border border-sand px-2 py-0.5 text-xs text-ink-soft">
                        <CalendarCheck className="h-3 w-3 text-gold-dark" aria-hidden />
                        12 Monate: {formatMoney(m.yearly)} / Monat
                      </span>
                    )}
                  </p>
                  <ul className="mt-5 space-y-1.5 text-sm text-ink-soft">
                    {m.includes.map((i) => (
                      <li key={i} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-dark" aria-hidden /> {i}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 flex gap-1.5 text-sm text-muted">
                    <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-dark" aria-hidden />
                    <span>Für: {m.idealFor}</span>
                  </p>
                  {m.note && <p className="mt-2 text-sm text-ink-soft">{m.note}</p>}
                  <ButtonLink href={`/kontakt?betreff=${encodeURIComponent(`Mietanfrage: ${m.name}`)}`} variant="secondary" size="sm" className="mt-auto self-start pt-0 [margin-top:1.5rem]">
                    Anfragen
                  </ButtonLink>
                </li>
              );
            })}
          </ul>
          <p className="mt-6 text-xs text-muted">{longtermCopy.footnote}</p>
        </div>
      </section>
    </article>
  );
}
