import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, Ruler, Users } from "lucide-react";
import { Gallery } from "@/components/media/Gallery";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { displayFacts } from "@/content/space-estimates";
import { getHeroVideo, getPropertyGallery, getSpaceMedia, mediaExists } from "@/lib/media";
import { listSpaceViews } from "@/server/services/space-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Galerie – Die Krone in Bildern",
  description: "Haus, Zimmer, Restaurant, Wintergarten, Biergarten, Bühne und Küche: die Krone in Leidersbach in Bildern und im Film.",
  alternates: { canonical: "/galerie" },
};

/** Chapter texts – what one sees, in one or two sentences. */
const CHAPTER_TEXT: Record<string, string> = {
  hotel: "Zehn Zimmer und ein Apartment im ersten Obergeschoss. Holz, ruhige Farben, eigenes Bad – und morgens Frühstück im Haus.",
  restaurant: "Das Herz des Hauses: 60 Plätze, Theke, Eingang. Jede Veranstaltung beginnt hier.",
  "side-room": "Das Nebenzimmer für Gesellschaften bis 55 Personen, per Schiebetür zur Bühne zu öffnen.",
  stage: "Leicht erhöht, mit Licht und Technik – für Reden, Musik und den ersten Tanz.",
  "winter-garden": "Glasdach und Holz-Glastüren: Tageslicht von allen Seiten, davor der Biergarten.",
  "beer-garden": "Unter Pergola und Bäumen, hinter der Sandsteinmauer: Platz für 100 Gäste im Freien.",
  kitchen: "Die Profiküche für Ihren Caterer – Herdblock, Kombidämpfer, Spülküche, Kühlhaus.",
  "old-tavern": "Die Alte Wirtschaft: holzvertäfelt und gemütlich wie früher.",
};

export default async function GalleryPage() {
  const spaces = (await listSpaceViews()).filter((s) => s.media.gallery.length || s.media.hero);
  const property = getPropertyGallery();
  const film = getHeroVideo();
  const hotel = getSpaceMedia("hotel", "Hotel");
  const hero = mediaExists("/media/property/house-front.webp") ? "/media/property/house-front.webp" : (property[0]?.src ?? null);
  const chapters = [
    { id: "hotel", name: "Hotel & Zimmer", images: hotel.hero ? [hotel.hero, ...hotel.gallery.filter((g) => g.src !== hotel.hero!.src)] : hotel.gallery, href: "/hotel", facts: null },
    ...spaces
      .filter((s) => s.id !== "hotel")
      .map((s) => ({ id: s.id, name: s.name, images: s.media.hero ? [s.media.hero, ...s.media.gallery.filter((g) => g.src !== s.media.hero!.src)] : s.media.gallery, href: s.href, facts: displayFacts(s) })),
  ];
  return (
    <article>
      <header className="relative isolate flex min-h-[70svh] items-end overflow-hidden bg-anthracite text-paper" data-hero>
        {hero && <Image src={hero} alt="Landhotel Gasthof Zur Krone" fill priority sizes="100vw" className="object-cover object-[50%_35%]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-anthracite via-anthracite/55 to-anthracite/35" />
        <div className="absolute inset-0 bg-gradient-to-r from-anthracite/70 via-transparent to-transparent" />
        <div className="container-page relative pb-16 pt-40 text-shadow-hero">
          <p className="eyebrow !text-gold-light">Galerie</p>
          <h1 className="mt-5 max-w-3xl text-[3rem] font-light leading-[0.98] md:text-[4.8rem]">
            Die Krone <em>in Bildern.</em>
          </h1>
          <p className="mt-6 max-w-xl text-lg font-light text-paper/85">Ein Rundgang durch Haus, Zimmer und Räume – vom Frühstückstisch bis zum Biergarten.</p>
        </div>
      </header>

      {(film.webm || film.mp4) && (
        <section className="bg-anthracite py-16 md:py-24" aria-labelledby="film-title">
          <div className="container-page">
            <p className="eyebrow flex items-center gap-3 !text-gold-light">
              <span className="gold-rule" aria-hidden />
              Film
            </p>
            <h2 id="film-title" className="mt-3 font-serif text-4xl text-paper">
              Von oben gesehen.
            </h2>
            <video className="mt-8 aspect-video w-full bg-black object-cover" controls muted playsInline preload="none" poster={film.poster ?? undefined}>
              {film.webm && <source src={film.webm} type="video/webm" />}
              {film.mp4 && <source src={film.mp4} type="video/mp4" />}
            </video>
          </div>
        </section>
      )}

      {property.length > 0 && (
        <section className="bg-paper py-24" aria-labelledby="property-title">
          <div className="container-page">
            <SectionHeading id="property-title" eyebrow="Das Haus" title="Draußen und drinnen." className="mb-10">
              <p>Das Anwesen in der Dorfmitte von Leidersbach: Haupthaus mit Hotel, die ehemalige Gaststätte, Wintergarten, Biergarten und Hof.</p>
            </SectionHeading>
            <Gallery images={property} label="Galerie Haus" />
          </div>
        </section>
      )}

      {chapters.map((c, i) => (
        <section key={c.id} className={i % 2 ? "bg-paper py-24" : "bg-cream py-24"} aria-labelledby={`g-${c.id}`}>
          <div className="container-page">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <SectionHeading id={`g-${c.id}`} eyebrow={`${String(i + 1).padStart(2, "0")} / ${String(chapters.length).padStart(2, "0")}`} title={c.name}>
                <p>{CHAPTER_TEXT[c.id] ?? ""}</p>
                {c.facts && (
                  <p className="mt-3 flex flex-wrap gap-x-5 text-sm text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Ruler className="h-3.5 w-3.5 text-gold-dark" strokeWidth={1.5} aria-hidden />
                      {c.facts.area}
                    </span>
                    {c.facts.seats && (
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-gold-dark" strokeWidth={1.5} aria-hidden />
                        {c.facts.seats}
                      </span>
                    )}
                  </p>
                )}
              </SectionHeading>
              <ButtonLink href={c.href} variant="secondary">
                {c.id === "hotel" ? "Zum Hotel" : "Zum Raum"} <ArrowRight className="h-4 w-4" />
              </ButtonLink>
            </div>
            <div className="mt-10">
              <Gallery images={c.images} label={`Galerie ${c.name}`} />
            </div>
          </div>
        </section>
      ))}
    </article>
  );
}
