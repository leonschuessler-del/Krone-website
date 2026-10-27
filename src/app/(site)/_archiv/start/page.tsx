import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BedDouble, Coffee, Car, Wifi, PawPrint, Motorbike } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { siteConfig } from "@/config/site";
import { breakfast, directBenefits, guestRoomTypes, historyPhotos, historyToday, hotelStory } from "@/content/hotel";
import { BENEFIT_ICON } from "@/features/hotel/benefit-icons";
import { arrival, HOTEL_COORDS, sights } from "@/content/sights";
import { StructuredData } from "@/features/home/StructuredData";
import { HeroVideo } from "@/features/home/HeroVideo";
import { BookingBar } from "@/features/hotel/BookingBar";
import { RoomTypeCard } from "@/features/hotel/RoomTypeCard";
import { OfferCards } from "@/features/offers/OfferCards";
import { SightCard } from "@/features/sights/SightCard";
import { LeafletMap } from "@/features/sights/LeafletMap";
import { cn } from "@/lib/cn";
import { getHeroVideo, getPropertyGallery, mediaExists } from "@/lib/media";
import { getDb } from "@/server/db/client";
import { listYieldOffers } from "@/server/services/offers-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Landhotel Gasthof Zur Krone – Leidersbach im Spessart",
  description: "Landhotel garni seit 1919 in Leidersbach bei Aschaffenburg: zehn Zimmer und ein Apartment mit Frühstück, kostenlose Parkplätze, Spessart vor der Tür. Die ehemalige Gaststätte ist Ihre Eventlocation für Hochzeiten, Feiern und Firmenveranstaltungen.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const film = getHeroVideo();
  const property = getPropertyGallery();
  const offers = await listYieldOffers(await getDb()).catch(() => []);
  const teaserSights = ["mespelbrunn", "aschaffenburg", "frankfurt"].map((id) => sights.find((s) => s.id === id)!).filter(Boolean);
  const eventImage = mediaExists("/media/restaurant/hero.webp") ? { src: "/media/restaurant/hero.webp" } : (property[0] ?? null);

  return (
    <>
      <StructuredData />

      {/* Hero: the house from above, one quiet line, the booking bar */}
      <section className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden bg-anthracite text-paper" aria-labelledby="hero-title" data-hero>
        <HeroVideo sources={film} />
        {/* readability: every word on a photo sits on a dark scrim */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-anthracite via-anthracite/55 to-anthracite/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-anthracite/70 via-transparent to-transparent" />
        <div className="container-page relative pb-10 pt-40 md:pb-16">
          <div className="max-w-3xl animate-fade-up text-shadow-hero">
            <p className="eyebrow !text-gold-light">Landhotel · Leidersbach im Spessart · seit 1919</p>
            <h1 id="hero-title" className="mt-6 text-[3.2rem] font-light leading-[0.98] md:text-[5rem] lg:text-[6.2rem]">
              Ankommen, <em>wo man <span className="accent">bleibt</span>.</em>
            </h1>
            <p className="mt-6 max-w-xl text-lg font-light leading-relaxed text-paper/85 md:text-xl">
              Zehn Zimmer und ein Apartment über den Dächern eines Dorfes, der Spessartwald hinter dem Haus, Aschaffenburg und Frankfurt in Reichweite.
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[0.72rem] uppercase tracking-[0.18em] text-paper/85" aria-label="Inklusive">
              {[
                { icon: Coffee, t: "Frühstück inklusive" },
                { icon: Car, t: "Parken inklusive" },
                { icon: Wifi, t: "WLAN kostenlos" },
              ].map((f) => (
                <li key={f.t} className="inline-flex items-center gap-2">
                  <f.icon className="h-3.5 w-3.5 text-gold-light" strokeWidth={1.5} aria-hidden /> {f.t}
                </li>
              ))}
            </ul>
          </div>
          <BookingBar tone="dark" className="mt-10 md:mt-14" />
        </div>
      </section>

      {/* Intro / story – one field: the house today, the family album laid on top, the chronicle */}
      <section className="bg-cream py-20 md:py-28" aria-labelledby="story-title">
        <div className="container-page">
          <div className="relative overflow-hidden border border-sand bg-white shadow-[var(--shadow-soft)]" data-testid="history-block">
            <div className="grid gap-8 px-6 pt-10 md:px-12 md:pt-14 lg:grid-cols-[1fr_1.1fr] lg:items-end">
              <SectionHeading id="story-title" eyebrow={hotelStory.eyebrow} title={<>Ein Haus mit <span className="accent">großer</span> Tradition.</>} />
              <div className="space-y-4 text-[1.0625rem] leading-[1.75] text-ink-soft lg:pb-2">
                {hotelStory.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </div>

            {/* today, large – with the three old photographs laid over its lower edge */}
            <figure className="relative mt-10 md:mt-12">
              <div className="group hover-zoom relative aspect-[16/9] overflow-hidden md:aspect-[2.5/1]">
                <Image src={historyToday.src} alt={historyToday.caption} fill sizes="(min-width:1280px) 1200px, 100vw" className="object-cover" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-anthracite/60 via-transparent to-anthracite/55" />
                <figcaption className="absolute right-5 top-5 text-right text-paper text-shadow-hero md:right-10 md:top-8">
                  <span className="block font-serif text-2xl leading-none text-gold-light md:text-3xl">{historyToday.year}</span>
                  <span className="mt-1 block text-[0.72rem] uppercase tracking-[0.18em] text-paper/90">{historyToday.caption}</span>
                </figcaption>
              </div>
              <ol className="relative z-10 -mt-10 grid grid-cols-3 gap-3 px-6 sm:gap-5 md:-mt-20 md:px-12" aria-label="Aus dem Familienalbum">
                {historyPhotos.filter((h) => mediaExists(h.src)).map((h, i) => (
                  <li key={h.src} className={cn("hover-nudge bg-paper p-1.5 shadow-[var(--shadow-lift)] transition-transform duration-500 ease-[var(--ease-out-soft)] hover:rotate-0 sm:p-2.5", ["-rotate-[1.6deg]", "rotate-[1deg]", "-rotate-[0.7deg]"][i])}>
                    <div className="relative aspect-[4/3] overflow-hidden bg-cream">
                      <Image src={h.src} alt={h.caption} fill sizes="(min-width:1024px) 20vw, 33vw" className={cn("object-cover", i < 2 && "sepia-[.3]")} />
                    </div>
                    <p className="px-1 pb-1 pt-2 sm:pt-3">
                      <span className="block font-serif text-base leading-none text-gold-dark sm:text-lg">{h.year}</span>
                      <span className="mt-1 hidden text-[0.7rem] leading-snug text-ink-soft sm:block">{h.caption}</span>
                    </p>
                  </li>
                ))}
              </ol>
            </figure>

            {/* chronicle */}
            <ol className="mx-6 mb-10 mt-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 md:mx-12 md:mb-12 md:mt-12" aria-label="Chronik">
              {hotelStory.milestones.map((m) => (
                <li key={m.year} className="relative border-t border-gold/40 pt-6 before:absolute before:-top-[5px] before:left-0 before:h-2.5 before:w-2.5 before:rounded-full before:bg-gold">
                  <span className="font-serif text-3xl text-gold-dark">{m.year}</span>
                  <p className="mt-1 text-sm leading-snug text-ink-soft">{m.text}</p>
                </li>
              ))}
            </ol>
            <div className="px-6 pb-10 md:px-12 md:pb-12">
              <ButtonLink href="/hotel" variant="secondary">
                Das Hotel <ArrowRight className="h-4 w-4" />
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* Rooms */}
      <section id="zimmer" className="bg-cream py-24 md:py-32" aria-labelledby="rooms-title">
        <div className="container-page">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading id="rooms-title" eyebrow="Zimmer & Apartment" title={<>Schlafen wie zu Hause, nur <span className="accent">ruhiger</span>.</>}>
              <p>Holz, helle Stoffe, eigenes Bad – und morgens der Duft von frischen Brötchen. Alle Zimmer liegen im ersten Obergeschoss, das Apartment hat drei Schlafzimmer und eine eigene Küche.</p>
            </SectionHeading>
            <ButtonLink href="/hotel/buchen" variant="primary">
              Verfügbarkeit prüfen
            </ButtonLink>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {guestRoomTypes.map((t) => (
              <RoomTypeCard key={t.id} type={t} />
            ))}
          </div>
          <ul className="mt-12 grid gap-px overflow-hidden border border-sand bg-sand sm:grid-cols-3 lg:grid-cols-6">
            {[
              { icon: Coffee, t: "Frühstück inklusive" },
              { icon: Car, t: "Parken am Haus" },
              { icon: Wifi, t: "WLAN kostenlos" },
              { icon: BedDouble, t: "Eigenes Bad" },
              { icon: PawPrint, t: "Hunde willkommen" },
              { icon: Motorbike, t: "All Bikers Welcome" },
            ].map((f) => (
              <li key={f.t} className="flex items-center gap-3 bg-paper px-5 py-4 text-sm">
                <f.icon className="h-4 w-4 text-gold-dark" strokeWidth={1.5} aria-hidden /> {f.t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Breakfast + direct benefits */}
      <section className="panel-dark py-24 md:py-28" aria-labelledby="benefits-title">
        <div className="container-page grid gap-14 lg:grid-cols-[1fr_1fr] lg:items-center">
          <SectionHeading id="benefits-title" tone="dark" eyebrow="Direkt beim Haus" title={<>Warum Sie <span className="accent">hier</span> buchen sollten.</>}>
            <p>{breakfast.text}</p>
            <p>Direkt beim Haus gebucht: Konditionen, die kein Portal geben kann.</p>
          </SectionHeading>
          <ul className="grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2">
            {directBenefits.map((b) => {
              const Icon = BENEFIT_ICON[b.title];
              return (
                <li key={b.title} className="bg-anthracite/80 p-7 transition-colors duration-300 hover:bg-anthracite/60">
                  {Icon && <Icon className="h-6 w-6 text-gold-light" strokeWidth={1.4} aria-hidden />}
                  <h3 className="mt-4 font-serif text-2xl text-paper">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-paper/65">{b.text}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Event location */}
      <section className="relative isolate overflow-hidden bg-anthracite text-paper" aria-labelledby="event-title">
        <div className="absolute inset-0">
          {eventImage && <Image src={eventImage.src} alt="" fill sizes="100vw" className="object-cover opacity-75" />}
          <div className="absolute inset-0 bg-gradient-to-r from-anthracite via-anthracite/75 to-anthracite/20" />
        </div>
        <div className="container-page relative py-28 md:py-40">
          <div className="max-w-2xl">
            <p className="eyebrow !text-gold-light">Eventlocation</p>
            <h2 id="event-title" className="mt-5 text-[2.6rem] leading-[1.02] md:text-[3.8rem]">
              Raum für <em>besondere Momente.</em>
            </h2>
            <p className="mt-6 text-lg font-light leading-relaxed text-paper/80">
              Restaurant, Nebenzimmer, Bühne, Wintergarten und Biergarten: Platz für bis zu 160 Gäste in der ehemaligen Gaststätte. Profiküche für Ihren Caterer – und das ganze Hotel für die Nacht danach.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/eventlocation" variant="gold" size="lg">
                Location entdecken
              </ButtonLink>
              <ButtonLink href="/eventlocation#karte" variant="dark" size="lg">
                Räume wählen
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* Offers from the calendar */}
      <section className="bg-paper py-24 md:py-32" aria-labelledby="offers-title">
        <div className="container-page">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading id="offers-title" eyebrow="Aktuelles & Angebote" title="Was der Kalender gerade hergibt.">
              <p>Freie Wochenenden in den nächsten drei Wochen, Wochentage, ganze Wochen: Der Preis rechnet den Vorteil automatisch ab – nur solange der Termin frei ist.</p>
            </SectionHeading>
            <ButtonLink href="/aktuelles" variant="secondary">
              Alle Angebote <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
          <div className="mt-12">
            <OfferCards offers={offers} limit={3} />
          </div>
        </div>
      </section>

      {/* Sights */}
      <section className="bg-cream py-24 md:py-32" aria-labelledby="sights-title">
        <div className="container-page">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading id="sights-title" eyebrow="Umgebung" title="Spessart vor der Tür, Frankfurt in einer Stunde.">
              <p>Ein Wasserschloss, eine Residenzstadt am Main und eine Skyline – alles von einem ruhigen Dorf aus.</p>
            </SectionHeading>
            <ButtonLink href="/sehenswuerdigkeiten" variant="secondary">
              Alle Sehenswürdigkeiten <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {teaserSights.map((s, i) => (
              <SightCard key={s.id} sight={s} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Location / arrival with the map */}
      <section className="bg-paper py-24" aria-labelledby="arrival-title">
        <div className="container-page">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
            <SectionHeading id="arrival-title" eyebrow="Lage & Anfahrt" title="Mitten im Dorf, nah an allem.">
              <p>
                {siteConfig.address.street}, {siteConfig.address.postalCode} {siteConfig.address.city}. Zwei Autobahnabfahrten, ein ICE-Bahnhof und der Frankfurter Flughafen in 40 Minuten.
              </p>
              <Link href="/kontakt" className="mt-6 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-ink hover:text-gold-dark">
                Kontakt & Anfahrt <ArrowRight className="h-4 w-4" />
              </Link>
            </SectionHeading>
            <LeafletMap
              markers={[{ id: "hotel", name: "Landhotel Gasthof Zur Krone", lat: HOTEL_COORDS.lat, lng: HOTEL_COORDS.lng, text: "Hauptstraße 106, 63849 Leidersbach", primary: true }, ...teaserSights.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, minutes: s.minutes }))]}
              center={{ lat: 49.97, lng: 9.05 }}
              zoom={9}
              height="h-[26rem]"
            />
          </div>
          <dl className="mt-10 grid gap-px overflow-hidden border border-sand bg-sand sm:grid-cols-2 lg:grid-cols-5">
            {arrival.map((a) => (
              <div key={a.label} className="bg-white p-6">
                <dt className="text-[0.65rem] font-medium uppercase tracking-[0.25em] text-gold-dark">{a.label}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-ink-soft">{a.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
