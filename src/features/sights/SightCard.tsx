import { ArrowUpRight, Bike, Building, Car, Castle, Church, Landmark, Lightbulb, Route, ShoppingBag, TreePine, Wine, type LucideIcon } from "lucide-react";
import type { Sight } from "@/content/sights";
import { mediaExists } from "@/lib/media";

/** Quiet category marker per sight – small beside the place, large and faint in the placeholder. */
const KIND_ICON: Record<Sight["kind"], LucideIcon> = {
  schloss: Castle,
  kloster: Church,
  natur: TreePine,
  rad: Bike,
  wein: Wine,
  stadt: Landmark,
  metropole: Building,
  shopping: ShoppingBag,
};

/** One sight: image (own photo once it exists, otherwise a quiet placeholder), facts, link. */
export function SightCard({ sight, index }: { sight: Sight; index: number }) {
  const img = `/media/sights/${sight.id}.webp`;
  const hasImg = mediaExists(img);
  const Kind = KIND_ICON[sight.kind];
  return (
    <article className="flex flex-col bg-white" data-testid="sight">
      <div className="hover-zoom relative aspect-[4/3] overflow-hidden bg-cream">
        {hasImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={sight.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,#efe9dd,#e4dac6)] text-center">
            <Kind className="h-10 w-10 text-gold-dark/30" strokeWidth={1.2} aria-hidden />
            <span className="font-serif text-[2.6rem] leading-none text-gold-dark/70">{String(index + 1).padStart(2, "0")}</span>
            <span className="px-6 text-[0.65rem] uppercase tracking-[0.28em] text-muted">Bild folgt</span>
          </div>
        )}
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 bg-paper/90 px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-ink">
          <Car className="h-3 w-3 text-gold-dark" aria-hidden /> {sight.minutes} Min.
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="eyebrow flex items-center gap-2">
          <Kind className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
          {sight.place}
        </p>
        <h3 className="mt-2 font-serif text-[1.7rem] leading-tight">{sight.name}</h3>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-soft">{sight.text}</p>
        {sight.tip && (
          <div className="mt-3 border-l-2 border-gold pl-3">
            <span className="mb-1 flex items-center gap-1.5 text-[0.62rem] uppercase tracking-[0.22em] text-gold-dark">
              <Lightbulb className="h-3 w-3" aria-hidden />
              Unser Tipp
            </span>
            <p className="text-sm italic text-muted">{sight.tip}</p>
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-5 text-xs uppercase tracking-[0.18em] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Route className="h-3.5 w-3.5 text-gold-dark" aria-hidden />
            {sight.distanceKm} km
          </span>
          {sight.url && (
            <a
              href={sight.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-ink transition-colors hover:text-gold-dark [&>svg]:transition-transform hover:[&>svg]:-translate-y-0.5 hover:[&>svg]:translate-x-0.5"
            >
              Website <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
