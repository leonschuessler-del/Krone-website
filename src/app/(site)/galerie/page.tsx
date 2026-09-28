import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Gallery } from "@/components/media/Gallery";
import { MediaPlaceholder } from "@/components/media/MediaPlaceholder";
import { getHeroVideo, getPropertyGallery } from "@/lib/media";
import { listSpaceViews } from "@/server/services/space-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Galerie – Bilder & Filme",
  description: "Bilder und Filme aus der Krone Leidersbach: Restaurant, Eventräume, Wintergarten, Biergarten und Hotel.",
  alternates: { canonical: "/galerie" },
};

export default async function GalleryPage() {
  const spaces = await listSpaceViews();
  const property = getPropertyGallery();
  const film = getHeroVideo();
  return (
    <div className="bg-paper pb-24 pt-28 md:pt-32">
      <div className="container-page">
        <Breadcrumbs items={[{ label: "Start", href: "/" }, { label: "Galerie" }]} />
        <h1 className="mt-6 text-5xl md:text-6xl">Galerie</h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-soft">
          Ein Blick in die Krone. {property.some((p) => !p.isReal) || spaces.some((s) => s.media.gallery.some((g) => !g.isReal)) ? "Derzeit mit Beispielbildern – echte Aufnahmen folgen." : ""}
        </p>

        {(film.webm || film.mp4) && (
          <section className="mt-14" aria-labelledby="film-title">
            <h2 id="film-title" className="font-serif text-3xl">
              Imagefilm {film.isReal ? "" : "(Testfilm)"}
            </h2>
            <video className="mt-5 aspect-video w-full rounded-2xl bg-anthracite object-cover shadow-lift" controls muted playsInline preload="none" poster={film.poster ?? undefined}>
              {film.webm && <source src={film.webm} type="video/webm" />}
              {film.mp4 && <source src={film.mp4} type="video/mp4" />}
            </video>
          </section>
        )}

        <section className="mt-14" aria-labelledby="property-title">
          <h2 id="property-title" className="font-serif text-3xl">
            Die Location
          </h2>
          <div className="mt-5">
            {property.length ? (
              <Gallery images={property} label="Galerie Location" />
            ) : (
              <div className="h-64 overflow-hidden rounded-2xl">
                <MediaPlaceholder />
              </div>
            )}
          </div>
        </section>

        {spaces.map((s) => (
          <section key={s.id} className="mt-14" aria-labelledby={`g-${s.id}`}>
            <h2 id={`g-${s.id}`} className="flex items-center gap-3 font-serif text-3xl">
              <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
              {s.name}
            </h2>
            <div className="mt-5">
              {s.media.gallery.length ? (
                <Gallery images={s.media.gallery} label={`Galerie ${s.name}`} />
              ) : (
                <div className="h-56 overflow-hidden rounded-2xl">
                  <MediaPlaceholder spaceId={s.id} code={s.code} color={s.color} />
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
