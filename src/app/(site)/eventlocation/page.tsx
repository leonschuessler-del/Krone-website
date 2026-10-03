import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, BedDouble, BedSingle, CalendarCheck, Car, ChefHat, Coffee, Grid2x2, House, LandPlot, MousePointerClick, Phone, Sparkles, Theater, Toilet, TreeDeciduous, Users, Wallet } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MediaPlaceholder } from "@/components/media/MediaPlaceholder";
import { faqItems } from "@/content/faq";
import { siteConfig } from "@/config/site";
import { FaqList } from "@/features/home/FaqList";
import { Hero } from "@/features/home/Hero";
import { ScrollTour } from "@/features/home/ScrollTour";
import { StructuredData } from "@/features/home/StructuredData";
import { MapConfigurator } from "@/features/map/MapConfigurator";
import { SpaceCard } from "@/features/spaces/SpaceCard";
import { env } from "@/lib/env";
import { getPropertyGallery } from "@/lib/media";
import { listSpaceViews } from "@/server/services/space-service";
import { Offers } from "@/features/home/Offers";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: MousePointerClick, title: "Räume wählen", text: "Auf der Karte einzelne Räume auswählen oder das ganze Haus." },
  { icon: CalendarCheck, title: "Termin prüfen", text: "Der Kalender zeigt, wann alle gewählten Räume frei sind." },
  { icon: Sparkles, title: "Details ergänzen", text: "Anlass, Gästezahl und Wünsche wie Übernachtung oder Technik." },
  { icon: Wallet, title: "Anfrage senden", text: "Unverbindlich oder verbindlich. Sie erhalten sofort eine Bestätigung mit Vorgangsnummer." },
];

/** Gold accent on one word of a config string – site.ts stays the single source for the text. */
function accentWord(text: string, word: string): ReactNode {
  const i = text.lastIndexOf(word);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className="accent">{word}</span>
      {text.slice(i + word.length)}
    </>
  );
}

export const metadata: Metadata = {
  title: "Eventlocation – Räume mieten in Leidersbach",
  description: "Die Krone als Eventlocation: Restaurant, Nebenzimmer, Bühne, Wintergarten, Biergarten und Küche für Hochzeiten, Feiern und Firmenveranstaltungen bis 160 Personen – mit der ganzen Hotel-Etage für Ihre Gäste.",
  alternates: { canonical: "/eventlocation" },
};

export default async function EventLocationPage() {
  const spaces = await listSpaceViews();
  const demo = env.demoMode;
  const gallery = [
    ...getPropertyGallery(),
    ...spaces.flatMap((s) => s.media.gallery.slice(0, 1).map((g) => ({ ...g, spaceId: s.id }))),
  ].slice(0, 7);
  const hotel = spaces.find((s) => s.id === "hotel");
  const eventSpaces = spaces.filter((s) => s.bookable);

  return (
    <>
      <StructuredData />
      <ScrollTour spaces={spaces} hero={{ eyebrow: siteConfig.hero.eyebrow, subline: siteConfig.hero.subline }} />
      {/* Static hero for reduced motion and no-JS */}
      <div className="hero-static hidden motion-reduce:block" data-hero>
        <Hero />
      </div>
      <noscript>
        <style>{".tour-section{display:none!important}.hero-static,.map-fallback{display:block!important}"}</style>
      </noscript>

      {/* Interactive map – with motion the planner lives at the end of the scroll film;
          this section is the version for reduced motion and no-JS */}
      {/* -scroll-mt-22 cancels html's scroll-padding-top: /#karte lands flush under the fixed header */}
      <section id="karte" className="map-fallback relative hidden -scroll-mt-22 bg-cream py-20 motion-reduce:block md:py-28" aria-labelledby="map-title">
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

      <Offers />

      {/* Positioning */}
      <section id="location" className="relative bg-paper py-24 md:py-32" aria-labelledby="location-title">
        <div className="container-page grid gap-14 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <SectionHeading id="location-title" eyebrow={siteConfig.positioning.eyebrow} title={accentWord(siteConfig.positioning.title, "Feste")}>
            <p>{siteConfig.positioning.text}</p>
          </SectionHeading>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-sand bg-sand">
            {[
              { icon: Users, k: "160", v: "Gäste", note: "bis zu, im ganzen Haus" },
              { icon: Grid2x2, k: String(eventSpaces.filter((s) => s.type !== "hotel").length), v: "Räume und Bereiche", note: "einzeln oder kombiniert" },
              { icon: BedDouble, k: "10 + 1", v: "Hotelzimmer und Wohnung", note: "Übernachtung mit Frühstück" },
              { icon: LandPlot, k: "1.720 m²", v: "Anwesen", note: "Haus, Hof, Biergarten, Parkplatz" },
            ].map((f) => (
              <div key={f.v} className="bg-white p-7 md:p-8">
                {/* the number is the one gold accent per tile – like the milestone years on the start page */}
                <dt className="flex flex-col gap-3">
                  <f.icon className="h-5 w-5 text-gold-dark" strokeWidth={1.5} aria-hidden />
                  <span className="accent font-serif text-4xl font-medium tracking-tight md:text-5xl">{f.k}</span>
                </dt>
                <dd className="mt-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-soft">{f.v}</dd>
                <dd className="mt-1 text-sm text-muted">{f.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Spaces */}
      <section id="bereiche" className="bg-paper py-24 md:py-32" aria-labelledby="spaces-title">
        <div className="container-page">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading id="spaces-title" eyebrow="Die Räume" title="Jeder Raum mit eigenem Charakter.">
              <p>Von der holzvertäfelten Gaststube bis zum Biergarten unter Bäumen. Jeder Raum ist einzeln buchbar und lässt sich mit den anderen verbinden.</p>
            </SectionHeading>
            <ButtonLink href="/bereiche" variant="secondary">
              Alle Räume <ArrowRight className="h-4 w-4" />
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
          <SectionHeading id="features-title" tone="dark" eyebrow="Ausstattung" title="Was das Haus mitbringt.">
            <p>Eine Eventlocation mit Profiküche, eigenem Hotel und Platz unter freiem Himmel.</p>
          </SectionHeading>
          <ul className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: ChefHat, title: "Profiküche", text: "Herdblock, Kombidämpfer und Spülküche direkt hinter der Theke." },
              { icon: Theater, title: "Bühne", text: "Leicht erhöht und per Schiebetür zum Nebenzimmer zu öffnen." },
              { icon: TreeDeciduous, title: "Wintergarten & Biergarten", text: "Glasdach und Holz-Glastüren, davor der Biergarten mit Pergola und Sandsteinmauer." },
              { icon: BedDouble, title: "Landhotel", text: "Acht Doppelzimmer, zwei Einzelzimmer und ein Apartment im Obergeschoss – einzeln buchbar, Frühstück inklusive." },
              { icon: Car, title: "Parken am Haus", text: "Stellplätze in der Hofeinfahrt und im Hof, direkt vor Biergarten und Eingang." },
              { icon: Toilet, title: "Toiletten inklusive", text: "Zwei WC-Anlagen im Erdgeschoss gehören zu jeder Buchung." },
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

      {/* Whole floor with the event */}
      {hotel && (
        <section id="hotel" className="bg-paper py-24 md:py-32" aria-labelledby="hotel-title">
          <div className="container-page grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="hover-zoom hover-nudge relative aspect-[4/3] overflow-hidden shadow-lift">
              {hotel.media.hero ? (
                <Image src={hotel.media.hero.src} alt={hotel.media.hero.alt} fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
              ) : (
                <MediaPlaceholder spaceId="hotel" code="H" color={hotel.color} size="lg" />
              )}
            </div>
            <div>
              <SectionHeading
                id="hotel-title"
                eyebrow="Die ganze Etage"
                title={
                  <>
                    Feiern und bleiben – das Hotel <span className="accent">exklusiv</span>.
                  </>
                }
              >
                <p>Auf Wunsch gehört das ganze Obergeschoss zu Ihrer Feier – ein Festpreis pro Nacht, bei mehreren Nächten günstiger. Einzelne Zimmer buchen Ihre Gäste auf der Hotelseite.</p>
                <ul className="fact-list mt-6">
                  <li>
                    <BedDouble strokeWidth={1.5} aria-hidden />
                    Acht Doppelzimmer
                  </li>
                  <li>
                    <BedSingle strokeWidth={1.5} aria-hidden />
                    Zwei Einzelzimmer
                  </li>
                  <li>
                    <House strokeWidth={1.5} aria-hidden />
                    Ein Apartment
                  </li>
                  <li>
                    <Users strokeWidth={1.5} aria-hidden />
                    Bis zu 22 Gäste
                  </li>
                  <li>
                    <Coffee strokeWidth={1.5} aria-hidden />
                    Frühstück für alle inklusive
                  </li>
                </ul>
              </SectionHeading>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="#karte" variant="primary">
                  Etage zur Feier hinzufügen
                </ButtonLink>
                <ButtonLink href="/hotel" variant="secondary">
                  Zum Hotel
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
            <SectionHeading id="gallery-title" eyebrow="Eindrücke" title="Die Krone in Bildern.">
              <p>{gallery.some((g) => !g.isReal) ? "Aktuell mit Beispielbildern – echte Aufnahmen folgen." : "Aktuelle Aufnahmen aus Haus, Hof und Hotel."}</p>
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
                    className={`hover-zoom relative overflow-hidden rounded-2xl ${i === 0 ? "col-span-2 row-span-2" : ""}`}
                  >
                    <Image src={g.src} alt={g.alt} fill sizes={i === 0 ? "50vw" : "25vw"} className="object-cover" />
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
          <SectionHeading id="booking-title" eyebrow="Ablauf" title="So kommen Sie zu Ihrem Termin." align="center">
            <p>Vier Schritte, alles online. Wir melden uns anschließend persönlich bei Ihnen.</p>
          </SectionHeading>
          <ol className="mx-auto mt-14 grid max-w-6xl gap-6 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card-surface relative p-7">
                <span className="absolute right-6 top-5 font-serif text-5xl font-semibold text-sand">{String(i + 1).padStart(2, "0")}</span>
                <s.icon className="h-7 w-7 text-gold-dark" strokeWidth={1.5} aria-hidden />
                <h3 className="mt-5 font-serif text-2xl">{s.title}</h3>
                <p className="mt-2 text-ink-soft">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/buchen" variant="gold" size="lg">
              Termin anfragen <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink href="#karte" variant="secondary" size="lg">
              Räume auf der Karte wählen
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
                Erzählen Sie uns von Ihrem <span className="accent">Fest</span>.
              </h2>
              <p className="mt-3 max-w-xl text-paper/70">
                Ob Hochzeit, runder Geburtstag oder Firmenabend: Wir beraten Sie persönlich und planen den Ablauf mit Ihnen.
              </p>
              {siteConfig.contact.phone && (
                <a href={`tel:${siteConfig.contact.phone.replace(/[\s-]/g, "")}`} className="mt-5 inline-flex items-center gap-2 text-sm text-paper/80 transition-colors hover:text-paper">
                  <Phone className="h-4 w-4 text-gold-light" aria-hidden />
                  {siteConfig.contact.phone}
                </a>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <ButtonLink href="/kontakt" variant="gold" size="lg">
                Nachricht schreiben
              </ButtonLink>
              <ButtonLink href="/buchen" variant="dark" size="lg">
                Termin anfragen
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
