import { ArrowUpRight, Car } from "lucide-react";
import type { Sight } from "@/content/sights";
import { mediaExists } from "@/lib/media";

/** One sight: image (own photo once it exists, otherwise a quiet placeholder), facts, link. */
export function SightCard({ sight, index }: { sight: Sight; index: number }) {
  const img = `/media/sights/${sight.id}.webp`;
  const hasImg = mediaExists(img);
  return (
    <article className="group flex flex-col bg-white" data-testid="sight">
      <div className="relative aspect-[4/3] overflow-hidden bg-cream">
        {hasImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={sight.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-[1.04]" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,#efe9dd,#e4dac6)] text-center">
            <span className="font-serif text-[2.6rem] leading-none text-gold-dark/70">{String(index + 1).padStart(2, "0")}</span>
            <span className="px-6 text-[0.65rem] uppercase tracking-[0.28em] text-muted">Bild folgt</span>
          </div>
        )}
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 bg-paper/90 px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-ink">
          <Car className="h-3 w-3" aria-hidden /> {sight.minutes} Min.
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="eyebrow">{sight.place}</p>
        <h3 className="mt-2 font-serif text-[1.7rem] leading-tight">{sight.name}</h3>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-soft">{sight.text}</p>
        {sight.tip && <p className="mt-3 border-l-2 border-gold pl-3 text-sm italic text-muted">{sight.tip}</p>}
        <div className="mt-auto flex items-center justify-between pt-5 text-xs uppercase tracking-[0.18em] text-muted">
          <span>{sight.distanceKm} km</span>
          {sight.url && (
            <a href={sight.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink hover:text-gold-dark">
              Website <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
