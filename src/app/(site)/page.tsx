import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BedDouble, CalendarCheck, Car, ChefHat, Map as MapIcon, MousePointerClick, Sparkles, Theater, TreeDeciduous, Wallet } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MediaPlaceholder } from "@/components/media/MediaPlaceholder";
import { faqItems } from "@/content/faq";
import { siteConfig } from "@/config/site";
import { FaqList } from "@/features/home/FaqList";
import { Hero } from "@/features/home/Hero";
import { ScrollTour, type TourSpace } from "@/features/home/ScrollTour";
import { tourConfig } from "@/config/tour";
import { StructuredData } from "@/features/home/StructuredData";
import { MapConfigurator } from "@/features/map/MapConfigurator";
import { SpaceCard } from "@/features/spaces/SpaceCard";
import { env } from "@/lib/env";
import { getHeroVideo, getPropertyGallery } from "@/lib/media";
import { listSpaceViews } from "@/server/services/space-service";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: MousePointerClick, title: "Bereiche wählen", text: "Auf der Karte einen oder mehrere Bereiche anklicken – oder die gesamte Location." },
  { icon: CalendarCheck, title: "Termin prüfen", text: "Gemeinsame freie Zeiten aller gewählten Bereiche im Kalender sehen." },
  { icon: Sparkles, title: "Wünsche ergänzen", text: "Zusatzleistungen, Veranstaltungsdetails, Übergabe und Rückgabe festlegen." },
  { icon: Wallet, title: "Buchen oder anfragen", text: "Direkt buchen oder unverbindlich anfragen – mit transparenter Zusammenfassung." },
];

export default async function HomePage() {
  const spaces = await listSpaceViews();
  const demo = env.demoMode;
  const gallery = [
    ...getPropertyGallery(),
    ...spaces.flatMap((s) => s.media.gallery.slice(0, 1).map((g) => ({ ...g, spaceId: s.id }))),
  ].slice(0, 7);
  const hotel = spaces.find((s) => s.id === "hotel");
  const tourSpaces: TourSpace[] = spaces.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    color: s.color,
    href: s.href,
    shortDescription: s.shortDescription,
    bookable: s.bookable,
    polygon: s.shape?.polygon ?? null,
    labelPosition: s.shape?.labelPosition ?? null,
    images: [s.media.hero, ...s.media.gallery]
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .filter((m, i, arr) => arr.findIndex((x) => x.src === m.src) === i)
      .slice(0, 2)
      .map((m) => ({ src: m.src, alt: m.alt, isReal: m.isReal })),
  }));
  const film = getHeroVideo();
  const scrubVideo = tourConfig.video.enabled && film.isReal && film.mp4 ? film.mp4 : null;
  const eventSpaces = spaces.filter((s) => s.bookable);

  return (
    <>
      <StructuredData />
      <ScrollTour spaces={tourSpaces} hero={{ eyebrow: siteConfig.hero.eyebrow, subline: siteConfig.hero.subline }} videoSrc={scrubVideo} videoPoster={film.poster} />
      {/* Static hero for reduced motion and no-JS */}
      <div className="hero-static hidden motion-reduce:block" data-hero>
        <Hero />
      </div>
      <noscript>
        <style>{".tour-section{display:none!important}.hero-static{display:block!important}"}</style>
      </noscript>

      {/* Interactive map */}
      {/* -scroll-mt-22 cancels html's scroll-padding-top: /#karte lands flush under the fixed header */}
      <section id="karte" className="relative -scroll-mt-22 bg-cream py-20 md:py-28" aria-labelledby="map-title">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
        <div className="container-page">
          <SectionHeading id="map-title" eyebrow={siteConfig.mapSection.eyebrow} title={siteConfig.mapSection.title} className="mb-10">
            <p>{siteConfig.mapSection.text}</p>
          </SectionHeading>
          {/* Tour → floor-plan handoff target: toolbar + whole map right under the header.
              tabIndex -1: the router focuses it after the jump, so keyboard users continue in the map. */}
          <div id="grundriss" tabIndex={-1} className="outline-none">
            <MapConfigurator spaces={spaces} demo={demo} />
          </div>
        </div>
      </section>

      {/* Positioning */}
      <section id="location" className="relative bg-paper py-24 md:py-32" aria-labelledby="location-title">
        <div className="container-page grid gap-14 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <SectionHeading id="location-title" eyebrow={siteConfig.positioning.eyebrow} title={siteConfig.positioning.title}>
            <p>{siteConfig.positioning.text}</p>
          </SectionHeading>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-sand bg-sand">
            {[
              { k: "ca. 1.720 m²", v: "Gesamtfläche der Immobilie", note: "laut Immobilienangebot" },
              { k: String(eventSpaces.length), v: "kombinierbare Bereiche", note: "einzeln oder zusammen" },
              { k: "Hotel", v: "Übernachten vor Ort", note: "Zimmerdetails folgen" },
              { k: "Biergarten", v: "Außenbereich im Grünen", note: "unter Bäumen" },
            ].map((f) => (
              <div key={f.v} className="bg-white p-6">
                <dt className="font-serif text-3xl font-semibold text-ink md:text-4xl">{f.k}</dt>
                <dd className="mt-1 text-sm font-semibold text-ink-soft">{f.v}</dd>
                <dd className="text-xs text-muted">{f.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Spaces */}
      <section id="bereiche" className="bg-paper py-24 md:py-32" aria-labelledby="spaces-title">
        <div className="container-page">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading id="spaces-title" eyebrow="Bereiche entdecken" title="Jeder Raum mit eigenem Charakter.">
              <p>Vom Restaurant bis zum Biergarten – entdecken Sie die einzelnen Bereiche und stellen Sie Ihre Kombination zusammen.</p>
            </SectionHeading>
            <ButtonLink href="/bereiche" variant="secondary">
              Alle Bereiche <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {spaces.map((s) => (
              <SpaceCard key={s.id} space={s} demo={demo} />
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="ausstattung" className="panel-dark py-24 md:py-28" aria-labelledby="features-title">
        <div className="container-page">
          <SectionHeading id="features-title" tone="dark" eyebrow="Ausstattung & Möglichkeiten" title="Alles an einem Ort.">
            <p>Die detaillierte Ausstattung je Bereich (Technik, Bestuhlung, Barrierefreiheit) wird aktuell zusammengestellt.</p>
          </SectionHeading>
          <ul className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: ChefHat, title: "Restaurant & Küche", text: "Zentraler Gastraum mit angeschlossener Küche." },
              { icon: Theater, title: "Bühne & Eventräume", text: "Bühne, Nebenzimmer und Alte Wirtschaft – einzeln oder kombiniert." },
              { icon: TreeDeciduous, title: "Wintergarten & Biergarten", text: "Helle Räume und ein Außenbereich im Grünen." },
              { icon: BedDouble, title: "Landhotel", text: "Übernachtungsmöglichkeiten direkt vor Ort – Details folgen." },
              { icon: Car, title: "Parken auf dem Grundstück", text: "Parkflächen auf dem Gelände – Anzahl der Stellplätze folgt." },
              { icon: MapIcon, title: "Alles auf einen Blick", text: "Interaktive Karte, Live-Verfügbarkeit und transparente Kosten." },
            ].map((f) => (
              <li key={f.title} className="bg-anthracite/80 p-7">
                <f.icon className="h-7 w-7 text-gold-light" strokeWidth={1.4} aria-hidden />
                <h3 className="mt-4 font-serif text-2xl text-paper">{f.title}</h3>
                <p className="mt-1.5 text-paper/65">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Hotel */}
      {hotel && (
        <section id="hotel" className="bg-paper py-24 md:py-32" aria-labelledby="hotel-title">
          <div className="container-page grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-lift">
              {hotel.media.hero ? (
                <>
                  <Image src={hotel.media.hero.src} alt={hotel.media.hero.alt} fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
                  {!hotel.media.hero.isReal && (
                    <span className="absolute left-4 top-4 rounded-full bg-anthracite/70 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wider text-paper">Beispielbild</span>
                  )}
                </>
              ) : (
                <MediaPlaceholder spaceId="hotel" code="H" color={hotel.color} size="lg" />
              )}
            </div>
            <div>
              <SectionHeading id="hotel-title" eyebrow="Landhotel" title="Feiern und bleiben.">
                <p>{hotel.longDescription?.replace("[PLACEHOLDER]", "")}</p>
              </SectionHeading>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/bereiche/hotel" variant="primary">
                  Zum Hotel
                </ButtonLink>
                <ButtonLink href="/kontakt?betreff=Hotelanfrage" variant="secondary">
                  Zimmer anfragen
                </ButtonLink>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Gallery teaser */}
      <section id="galerie" className="bg-cream py-24 md:py-28" aria-labelledby="gallery-title">
        <div className="container-page">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading id="gallery-title" eyebrow="Bilder & Filme" title="Eindrücke aus der Krone.">
              <p>{gallery.some((g) => !g.isReal) ? "Aktuell mit Beispielbildern – echte Aufnahmen folgen." : "Ein erster Blick in unsere Räume."}</p>
            </SectionHeading>
            <ButtonLink href="/galerie" variant="secondary">
              Zur Galerie <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
          <div className="mt-12 grid auto-rows-[180px] grid-cols-2 gap-3 md:auto-rows-[220px] md:grid-cols-4">
            {gallery.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={i === 0 ? "col-span-2 row-span-2 overflow-hidden rounded-2xl" : "overflow-hidden rounded-2xl"}>
                    <MediaPlaceholder />
                  </div>
                ))
              : gallery.map((g, i) => (
                  <Link
                    key={g.src}
                    href="/galerie"
                    className={`group relative overflow-hidden rounded-2xl ${i === 0 ? "col-span-2 row-span-2" : ""}`}
                  >
                    <Image src={g.src} alt={g.alt} fill sizes={i === 0 ? "50vw" : "25vw"} className="object-cover transition-transform duration-700 group-hover:scale-105" />
                    {!g.isReal && i === 0 && (
                      <span className="absolute left-3 top-3 rounded-full bg-anthracite/70 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-paper">Beispielbilder</span>
                    )}
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* Booking CTA */}
      <section id="buchen" className="bg-paper py-24 md:py-32" aria-labelledby="booking-title">
        <div className="container-page">
          <SectionHeading id="booking-title" eyebrow="Buchung" title="In wenigen Schritten zu Ihrer Veranstaltung." align="center">
            <p>Wählen Sie Bereiche, prüfen Sie freie Termine und buchen Sie direkt – oder fragen Sie unverbindlich an.</p>
          </SectionHeading>
          <ol className="mx-auto mt-14 grid max-w-6xl gap-6 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card-surface relative p-7">
                <span className="absolute right-6 top-5 font-serif text-5xl font-semibold text-sand">{i + 1}</span>
                <s.icon className="h-7 w-7 text-gold-dark" strokeWidth={1.5} aria-hidden />
                <h3 className="mt-5 font-serif text-2xl">{s.title}</h3>
                <p className="mt-2 text-ink-soft">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/buchen" variant="gold" size="lg">
              Jetzt buchen <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink href="#karte" variant="secondary" size="lg">
              Bereiche auf der Karte wählen
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-cream py-24 md:py-28" aria-labelledby="faq-title">
        <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <SectionHeading id="faq-title" eyebrow="Häufige Fragen" title="Gut zu wissen." />
          <FaqList items={faqItems} />
        </div>
      </section>

      {/* Contact teaser */}
      <section id="kontakt" className="bg-paper py-24" aria-labelledby="contact-title">
        <div className="container-page">
          <div className="panel-dark flex flex-col items-start gap-8 rounded-[2rem] p-10 md:flex-row md:items-center md:justify-between md:p-14">
            <div>
              <p className="eyebrow !text-gold-light">Kontakt</p>
              <h2 id="contact-title" className="mt-3 text-4xl text-paper md:text-5xl">
                Wir freuen uns auf Ihre Nachricht.
              </h2>
              <p className="mt-3 max-w-xl text-paper/70">
                Fragen zu Räumen, Terminen oder Ihrer Idee? Schreiben Sie uns – wir melden uns persönlich.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <ButtonLink href="/kontakt" variant="gold" size="lg">
                Kontakt aufnehmen
              </ButtonLink>
              <ButtonLink href="/buchen" variant="dark" size="lg">
                Unverbindlich anfragen
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
