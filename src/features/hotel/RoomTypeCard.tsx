import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import type { RoomTypeSeed } from "@/content/hotel";
import { mediaExists } from "@/lib/media";
import { formatMoney } from "@/lib/format";

/** Room type teaser: photo, name, "ab"-price, guests, one line. */
export function RoomTypeCard({ type, href, compact = false }: { type: RoomTypeSeed; href?: string; compact?: boolean }) {
  const img = mediaExists(type.image) ? type.image : null;
  return (
    <Link href={href ?? `/hotel/buchen?zimmer=${type.id}`} className="group flex flex-col bg-white" data-testid={`roomcard-${type.id}`}>
      <div className="relative aspect-[4/3] overflow-hidden bg-cream">
        {img ? (
          <Image src={img} alt={type.name} fill sizes="(min-width:1024px) 33vw, 100vw" className="object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-[1.04]" />
        ) : (
          <div className="grid h-full place-items-center text-[0.65rem] uppercase tracking-[0.28em] text-muted">Bild folgt</div>
        )}
      </div>
      <div className={compact ? "p-5" : "p-6 md:p-7"}>
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-serif text-[1.65rem] leading-tight">{type.name}</h3>
          <p className="shrink-0 text-right">
            {type.basePricePerNight === null ? (
              <span className="font-serif text-lg text-muted">auf Anfrage</span>
            ) : (
              <>
                <span className="block text-[0.6rem] uppercase tracking-[0.2em] text-muted">ab</span>
                <span className="font-serif text-2xl tabular-nums">{formatMoney(type.basePricePerNight)}</span>
              </>
            )}
          </p>
        </div>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">{type.description}</p>
        <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" aria-hidden /> bis {type.maxGuests} {type.maxGuests === 1 ? "Gast" : "Gäste"}
          </span>
          <span className="inline-flex items-center gap-1 text-ink group-hover:text-gold-dark">
            {type.basePricePerNight === null ? "Anfragen" : "Buchen"} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}
