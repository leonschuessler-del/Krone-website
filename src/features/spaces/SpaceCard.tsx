import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SpaceImage } from "@/components/media/SpaceImage";
import { displayFacts } from "@/content/space-estimates";
import type { SpaceView } from "./types";
import { SelectSpaceButton } from "./SelectSpaceButton";
import { formatPriceFrom } from "./price-label";

export function SpaceCard({ space, demo }: { space: SpaceView; demo: boolean }) {
  const price = formatPriceFrom(space);
  return (
    <article className="group card-surface flex flex-col overflow-hidden transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-lift" data-testid={`space-card-${space.id}`}>
      <Link href={space.href} className="relative block aspect-[3/2] overflow-hidden" tabIndex={-1} aria-hidden="true">
        <div className="h-full w-full transition-transform duration-700 group-hover:scale-[1.04]">
          <SpaceImage space={space} sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw" />
        </div>
        {space.media.hero && !space.media.hero.isReal && (
          <span className="absolute left-3 top-3 rounded-full bg-anthracite/70 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-paper backdrop-blur">
            Beispielbild
          </span>
        )}
        <span
          className="absolute bottom-3 left-3 grid h-9 min-w-9 place-items-center rounded-full border border-white/40 px-1.5 font-serif text-sm font-semibold text-white shadow"
          style={{ background: space.color }}
        >
          {space.code}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-serif text-2xl">
          <Link href={space.href} className="hover:text-gold-dark">
            {space.name}
          </Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[0.95rem] text-ink-soft">{space.shortDescription}</p>
        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Fläche</dt>
            <dd className="font-semibold">{displayFacts(space).area}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Plätze</dt>
            <dd className="font-semibold">{displayFacts(space).seats}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Preis</dt>
            <dd className="font-semibold">
              {price}
              {demo && space.basePrice !== null && <span className="ml-1 text-[0.65rem] font-semibold uppercase tracking-wider text-warning">Demo</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Verfügbarkeit</dt>
            <dd className="font-semibold">{space.bookable ? "im Kalender" : "auf Anfrage"}</dd>
          </div>
        </dl>
        <div className="mt-auto flex items-center gap-2 pt-5">
          <Link href={space.href} className="inline-flex h-10 flex-1 items-center justify-center gap-1 rounded-full border border-ink/20 text-sm font-semibold transition-colors hover:border-ink/50">
            Details <ArrowUpRight className="h-4 w-4" />
          </Link>
          {space.bookable ? (
            <SelectSpaceButton spaceId={space.id} name={space.name} className="flex-1" />
          ) : (
            <Link href="/kontakt?betreff=Hotel" className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-cream text-sm font-semibold hover:bg-sand">
              Anfragen
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
