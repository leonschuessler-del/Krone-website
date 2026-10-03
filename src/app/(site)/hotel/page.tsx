import type { Metadata } from "next";
import Image from "next/image";
import { Armchair, Baby, Bath, BedSingle, Briefcase, CalendarX, Car, Check, Clock, Coffee, CookingPot, CreditCard, KeyRound, LampDesk, Motorbike, PawPrint, Phone, PlugZap, Receipt, ShieldCheck, Sun, Tv, Wifi, type LucideIcon } from "lucide-react";
import { Gallery } from "@/components/media/Gallery";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { breakfast, directBenefits, guestRoomTypes, hotelCopy, hotelFacts, hotelStory, stayExtras, type StayExtraId } from "@/content/hotel";
import { BENEFIT_ICON } from "@/features/hotel/benefit-icons";
import { BookingBar } from "@/features/hotel/BookingBar";
import { formatMoney } from "@/lib/format";
import { getSpaceMedia, mediaExists } from "@/lib/media";

export const dynamic = "force-dynamic";

/* Icons for the fact rows – keyed by the content strings in content/hotel.ts; unknown strings keep a neutral glyph. */
const AMENITY_ICON: Record<string, LucideIcon> = {
  "Extrabett / Kinderbett möglich": Baby,
  "Kostenloses WLAN": Wifi,
  "Parkplatz direkt am Hotel": Car,
  "Frühstück inklusive": Coffee,
  "All Bikers Welcome": Motorbike,
};
const FEATURE_ICON: Record<string, LucideIcon> = {
  "WLAN kostenlos": Wifi,
  "Smart-TV mit Sat-Empfang": Tv,
  "Sat-TV in jedem Zimmer": Tv,
  Telefon: Phone,
  Schreibtisch: LampDesk,
  Sitzecke: Armchair,
  "Sitz- und Essecke": Armchair,
  "Ausgestattete Küche": CookingPot,
  Südbalkon: Sun,
};
const EXTRA_ICON: Record<StayExtraId, LucideIcon> = { "extra-bed": BedSingle, "baby-cot": Baby, dog: PawPrint, "dogs-2": PawPrint, "ev-charging": PlugZap };
/* One glyph per line of the check-in / check-out / cancellation facts, in content order. */
const CHECK_IN_ICONS = [Clock, KeyRound];
const CHECK_OUT_ICONS = [Briefcase, Sun];
const CANCELLATION_ICONS = [ShieldCheck, CalendarX, Receipt];

export const metadata: Metadata = {
  title: "Hotel & Zimmer – Landhotel garni in Leidersbach",
  description: "Acht Doppelzimmer, zwei Einzelzimmer und ein Apartment mit drei Schlafzimmern. Frühstück und Parken inklusive, kostenlose Stornierung bis zwei Tage vor Anreise. Direkt beim Haus buchen.",
  alternates: { canonical: "/hotel" },
};

export default async function HotelPage() {
  const media = getSpaceMedia("hotel", "Hotel");
  // The cancellation policy is one sentence per rule in the content – shown as one fact row each.
  const cancellationLines = hotelFacts.cancellation
    .split(/\.\s+/)
    .filter(Boolean)
    .map((s) => (s.endsWith(".") ? s : `${s}.`));
  return (
    <article>
      {/* Hero */}
      <header className="relative isolate flex min-h-[86svh] items-end overflow-hidden bg-anthracite text-paper" data-hero>
        {media.hero && <Image src={media.hero.src} alt={media.hero.alt} fill priority sizes="100vw" className="object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-anthracite via-anthracite/55 to-anthracite/35" /><div className="absolute inset-0 bg-gradient-to-r from-anthracite/70 via-transparent to-transparent" />
        <div className="container-page relative pb-16 pt-40 text-shadow-hero">
          <p className="eyebrow !text-gold-light">{hotelCopy.eyebrow}</p>
          <h1 className="mt-5 max-w-3xl text-[3rem] font-light leading-[0.98] md:text-[4.8rem]">
            Zimmer mit <em>Frühstück und <span className="accent">Ruhe</span>.</em>
          </h1>
          <p className="mt-6 max-w-xl text-lg font-light text-paper/85">{hotelCopy.text}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/hotel/buchen" variant="gold" size="lg">
              Zimmer buchen
            </ButtonLink>
            <ButtonLink href="#zimmer" variant="dark" size="lg">
              Die Zimmer
            </ButtonLink>
          </div>
          {/* arrival facts at first glance – the same facts as in "Gut zu wissen" below */}
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[0.72rem] uppercase tracking-[0.18em] text-paper/80">
            <li className="inline-flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-gold-light" strokeWidth={1.5} aria-hidden />
              Check-in {hotelFacts.checkIn[0]}
            </li>
            <li className="inline-flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5 text-gold-light" strokeWidth={1.5} aria-hidden />
              {hotelFacts.checkIn[1]}
            </li>
            <li className="inline-flex items-center gap-2">
              <Coffee className="h-3.5 w-3.5 text-gold-light" strokeWidth={1.5} aria-hidden />
              Frühstück inklusive
            </li>
            <li className="inline-flex items-center gap-2">
              <Car className="h-3.5 w-3.5 text-gold-light" strokeWidth={1.5} aria-hidden />
              Parken am Haus
            </li>
          </ul>
        </div>
      </header>

      {/* Story */}
      <section className="bg-paper py-24 md:py-32" aria-labelledby="story-title">
        <div className="container-page grid gap-14 lg:grid-cols-[1.1fr_1fr]">
          <SectionHeading id="story-title" eyebrow={hotelStory.eyebrow} title={hotelStory.title}>
            {hotelStory.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </SectionHeading>
          <div className="border border-sand bg-white p-8 md:p-10">
            <p className="eyebrow flex items-center gap-3">
              <span className="gold-rule" aria-hidden />
              Frühstück
            </p>
            <h3 className="mt-3 font-serif text-3xl">{breakfast.title}</h3>
            <p className="mt-3 leading-relaxed text-ink-soft">{breakfast.text}</p>
            <ul className="mt-6 space-y-2 text-sm text-ink-soft">
              {hotelFacts.amenities.map((a) => {
                const Icon = AMENITY_ICON[a] ?? Check;
                return (
                  <li key={a} className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-gold-dark" strokeWidth={1.5} aria-hidden /> {a}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* Rooms in detail */}
      <section id="zimmer" className="scroll-mt-24 bg-cream py-24 md:py-32" aria-labelledby="rooms-title">
        <div className="container-page">
          <SectionHeading
            id="rooms-title"
            eyebrow="Zimmer & Apartment"
            title={
              <>
                <span className="accent">Vier</span> Arten zu bleiben.
              </>
            }
            className="mb-14"
          >
            <p>Preise pro Zimmer und Nacht inklusive Frühstück und Mehrwertsteuer.</p>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="In allen Zimmern">
              <li className="inline-flex items-center gap-2">
                <Bath className="h-4 w-4 text-gold-dark" strokeWidth={1.5} aria-hidden />
                Eigenes Bad
              </li>
              <li className="inline-flex items-center gap-2">
                <Wifi className="h-4 w-4 text-gold-dark" strokeWidth={1.5} aria-hidden />
                WLAN
              </li>
              <li className="inline-flex items-center gap-2">
                <Tv className="h-4 w-4 text-gold-dark" strokeWidth={1.5} aria-hidden />
                Smart-TV
              </li>
              <li className="inline-flex items-center gap-2">
                <LampDesk className="h-4 w-4 text-gold-dark" strokeWidth={1.5} aria-hidden />
                Schreibtisch
              </li>
            </ul>
          </SectionHeading>
          <div className="space-y-6">
            {guestRoomTypes.map((t, i) => {
              const img = mediaExists(t.image) ? t.image : null;
              return (
                <div key={t.id} className={`grid gap-0 bg-white lg:grid-cols-[1.1fr_1fr] ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`} data-testid={`roomdetail-${t.id}`}>
                  <div className="hover-zoom relative aspect-[4/3] overflow-hidden bg-sand lg:aspect-auto lg:min-h-[26rem]">
                    {img ? <Image src={img} alt={t.name} fill sizes="(min-width:1024px) 55vw, 100vw" className="object-cover" /> : <div className="grid h-full place-items-center text-[0.65rem] uppercase tracking-[0.28em] text-muted">Bild folgt</div>}
                  </div>
                  <div className="flex flex-col p-8 md:p-12">
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="font-serif text-[2rem] leading-tight">{t.name}</h3>
                      <p className="text-right">
                        {t.basePricePerNight === null ? (
                          <span className="font-serif text-xl text-muted">auf Anfrage</span>
                        ) : (
                          <>
                            <span className="block text-[0.6rem] uppercase tracking-[0.2em] text-muted">pro Nacht</span>
                            <span className="font-serif text-3xl tabular-nums">{formatMoney(t.basePricePerNight)}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <p className="mt-4 leading-relaxed text-ink-soft">{t.details}</p>
                    <p className="mt-3 text-sm text-muted">{t.bathroom}</p>
                    <ul className="mt-5 flex flex-wrap gap-2">
                      {t.features.map((f) => {
                        const Icon = FEATURE_ICON[f];
                        return (
                          <li key={f} className="inline-flex items-center gap-1.5 border border-sand px-2.5 py-1 text-[0.72rem] uppercase tracking-[0.14em] text-ink-soft">
                            {Icon && <Icon className="h-3 w-3 text-gold-dark" strokeWidth={1.5} aria-hidden />}
                            {f}
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-8">
                      <span className="text-sm text-muted">
                        bis {t.maxGuests} {t.maxGuests === 1 ? "Gast" : "Gäste"}
                        {t.sizeHint ? ` · ${t.sizeHint}` : ""}
                      </span>
                      <ButtonLink href={`/hotel/buchen?zimmer=${t.id}`} variant="primary" size="sm">
                        {t.basePricePerNight === null ? "Anfragen" : "Buchen"}
                      </ButtonLink>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Booking */}
      <section id="buchen" className="scroll-mt-24 bg-paper py-24 md:py-32" aria-labelledby="booking-title">
        <div className="container-page">
          <SectionHeading id="booking-title" eyebrow="Online buchen" title="Ihr Aufenthalt in drei Schritten." className="mb-10">
            <p>Daten wählen, Zimmer vergleichen, bestätigen. Auf der Buchungsseite: Kalender, Preise pro Nacht, mehrere Zimmer in einem Vorgang, Zahlung im Hotel oder online.</p>
          </SectionHeading>
          <BookingBar />
          <p className="mt-4 text-sm text-muted">Oder direkt zur <a href="/hotel/buchen" className="font-semibold text-gold-dark underline underline-offset-4">Zimmerbuchung</a>.</p>
        </div>
      </section>

      {/* Benefits + extras */}
      <section className="panel-dark py-24" aria-labelledby="benefit-title">
        <div className="container-page grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading id="benefit-title" tone="dark" eyebrow="Direkt gebucht" title="Ihre Vorteile." />
            <ul className="mt-8 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2">
              {directBenefits.map((b) => {
                const Icon = BENEFIT_ICON[b.title];
                return (
                  <li key={b.title} className="bg-anthracite/80 p-6">
                    {Icon && <Icon className="mb-4 h-6 w-6 text-gold-light" strokeWidth={1.4} aria-hidden />}
                    <h3 className="font-serif text-xl text-paper">{b.title}</h3>
                    <p className="mt-1.5 text-sm text-paper/65">{b.text}</p>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <p className="eyebrow flex items-center gap-3 !text-gold-light">
              <span className="gold-rule" aria-hidden />
              Aufenthalt verfeinern
            </p>
            <h3 className="mt-3 font-serif text-3xl text-paper">Kleine Extras, pro Nacht.</h3>
            <ul className="mt-6 divide-y divide-white/10 border-y border-white/10">
              {stayExtras.map((e) => {
                const Icon = EXTRA_ICON[e.id];
                return (
                  <li key={e.id} className="flex items-baseline justify-between gap-4 py-3 text-paper/85">
                    <span className="flex gap-3">
                      <Icon className="mt-1 h-4 w-4 shrink-0 text-gold-light" strokeWidth={1.5} aria-hidden />
                      <span>
                        {e.name} <span className="block text-xs text-paper/50">{e.description}</span>
                      </span>
                    </span>
                    <span className="shrink-0 font-serif text-lg tabular-nums">{e.pricePerNight === 0 ? "inklusive" : formatMoney(e.pricePerNight)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* Facts */}
      <section className="bg-paper py-24" aria-labelledby="facts-title">
        <div className="container-page">
          <SectionHeading id="facts-title" eyebrow="Gut zu wissen" title="An- und Abreise, Stornierung, Zahlung." className="mb-12" />
          <dl className="grid gap-px overflow-hidden border border-sand bg-sand md:grid-cols-2 xl:grid-cols-4">
            <div className="bg-white p-7">
              <dt className="eyebrow">Check-in</dt>
              <dd>
                <ul className="fact-list mt-3 text-ink-soft">
                  {hotelFacts.checkIn.map((l, i) => {
                    const Icon = CHECK_IN_ICONS[i] ?? Clock;
                    return (
                      <li key={l}>
                        <Icon strokeWidth={1.5} aria-hidden />
                        {l}
                      </li>
                    );
                  })}
                </ul>
              </dd>
            </div>
            <div className="bg-white p-7">
              <dt className="eyebrow">Check-out</dt>
              <dd>
                <ul className="fact-list mt-3 text-ink-soft">
                  {hotelFacts.checkOut.map((l, i) => {
                    const Icon = CHECK_OUT_ICONS[i] ?? Clock;
                    return (
                      <li key={l}>
                        <Icon strokeWidth={1.5} aria-hidden />
                        {l}
                      </li>
                    );
                  })}
                </ul>
              </dd>
            </div>
            <div className="bg-white p-7">
              <dt className="eyebrow">Stornierung</dt>
              <dd>
                <ul className="fact-list mt-3 text-sm text-ink-soft">
                  {cancellationLines.map((l, i) => {
                    const Icon = CANCELLATION_ICONS[i] ?? ShieldCheck;
                    return (
                      <li key={l}>
                        <Icon strokeWidth={1.5} aria-hidden />
                        {l}
                      </li>
                    );
                  })}
                </ul>
              </dd>
            </div>
            <div className="bg-white p-7">
              <dt className="eyebrow">Zahlung & Haustiere</dt>
              <dd>
                <ul className="fact-list mt-3 text-ink-soft">
                  <li>
                    <CreditCard strokeWidth={1.5} aria-hidden />
                    {hotelFacts.cards}
                  </li>
                  <li className="text-sm text-muted">
                    <PawPrint strokeWidth={1.5} aria-hidden />
                    {hotelFacts.pets}
                  </li>
                </ul>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Gallery */}
      {media.gallery.length > 0 && (
        <section className="bg-cream py-24" aria-labelledby="gallery-title">
          <div className="container-page">
            <SectionHeading id="gallery-title" eyebrow="Eindrücke" title="Das Hotel in Bildern." className="mb-10" />
            <Gallery images={media.gallery} label="Galerie Hotel" />
          </div>
        </section>
      )}
    </article>
  );
}
