import { ArrowDown, Film } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { siteConfig } from "@/config/site";
import { getHeroVideo } from "@/lib/media";
import { HeroVideo } from "./HeroVideo";

export function Hero() {
  const { hero } = siteConfig;
  const sources = getHeroVideo();
  const isPlaceholder = !sources.isReal;
  return (
    <section className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-anthracite text-paper md:min-h-[min(100svh,56.25vw)] lg:min-h-[100svh]" aria-labelledby="hero-title">
      {sources.poster ? (
        // Static fallback only (reduced motion / no-JS): a lazy <img> inside the display:none
        // wrapper is never fetched, unlike <video poster>. With JS off, Chrome loads it eagerly.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sources.poster} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <HeroVideo sources={sources} />
      )}
      {/* legibility gradients */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-anthracite via-anthracite/35 to-anthracite/10" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-anthracite/70 via-anthracite/10 to-transparent" />

      <div className="container-page relative pb-16 pt-32 md:pb-24">
        <div className="max-w-3xl animate-fade-up">
          <p className="eyebrow !text-gold-light">{hero.eyebrow}</p>
          <h1 id="hero-title" className="mt-5 text-[2.9rem] leading-[1.02] sm:text-6xl lg:text-[5.4rem]">
            Ein Ort. <em className="font-medium text-gold-light">Viele Möglichkeiten.</em>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper/85 md:text-xl">{hero.subline}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={hero.primaryCta.href} variant="gold" size="lg">
              {hero.primaryCta.label}
            </ButtonLink>
            <ButtonLink href={hero.secondaryCta.href} variant="dark" size="lg">
              {hero.secondaryCta.label}
            </ButtonLink>
          </div>
        </div>
      </div>

      {isPlaceholder && (
        <span className="absolute right-4 top-24 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-anthracite/60 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wider text-paper/80 backdrop-blur md:right-8">
          <Film className="h-3.5 w-3.5" /> {sources.webm || sources.mp4 ? "Testfilm – Imagefilm folgt" : "Imagefilm folgt"}
        </span>
      )}
      <a href="#location" className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 text-xs uppercase tracking-[0.25em] text-paper/70 hover:text-paper md:flex" aria-label="Weiter nach unten scrollen">
        Entdecken
        <ArrowDown className="h-4 w-4 animate-bounce" />
      </a>
    </section>
  );
}
