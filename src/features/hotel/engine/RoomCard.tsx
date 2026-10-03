"use client";

import { Armchair, Bath, BedDouble, BedSingle, Briefcase, Check, ChevronDown, ChevronLeft, ChevronRight, Coffee, CookingPot, Croissant, DoorOpen, Images, KeyRound, Phone, RectangleVertical, ShieldCheck, Sun, Tv, Users, UtensilsCrossed, Wallet, Wifi, X, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { ratePlans, type RateBulletIcon } from "@/content/rates";
import type { AvailabilityType } from "@/domain/booking-engine";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { EngineRoom } from "./types";
import { Pill, plural } from "./ui";

const FEATURE_ICON: Record<string, LucideIcon> = {
  "WLAN kostenlos": Wifi,
  "Smart-TV mit Sat-Empfang": Tv,
  "Sat-TV in jedem Zimmer": Tv,
  Telefon: Phone,
  Schreibtisch: Briefcase,
  Sitzecke: Armchair,
  Ganzkörperspiegel: RectangleVertical,
  "Ausgestattete Küche": CookingPot,
  Südbalkon: Sun,
  "Sitz- und Essecke": UtensilsCrossed,
  "10 Zimmer + Apartment": DoorOpen,
  "bis 22 Gäste": Users,
  "Frühstück für alle": Coffee,
  "Schlüsselübergabe vor Ort": KeyRound,
};
const BULLET_ICON: Record<RateBulletIcon, LucideIcon> = { check: Check, breakfast: Croissant, wallet: Wallet, shield: ShieldCheck };

export interface RoomCardProps {
  room: EngineRoom;
  live: AvailabilityType | undefined;
  nights: number;
  /** dates chosen – prices for the stay can be shown */
  stayReady: boolean;
  canAdd: { ok: boolean; reason?: string };
  inCart: number;
  onAdd: (rateId: string) => void;
  highlighted?: boolean;
  /** "rates" view shows only one rate row and the rate name as the card title */
  rateOnly?: string;
}

/**
 * One room type: photo with gallery, facts (beds · guests · bath), details on
 * demand, then one row per rate plan with its inclusions and JETZT BUCHEN.
 */
export function RoomCard({ room, live, nights, stayReady, canAdd, inCart, onAdd, highlighted, rateOnly }: RoomCardProps) {
  const [details, setDetails] = useState(false);
  const [gallery, setGallery] = useState<number | null>(null);
  const soldOut = !!live && live.free === 0;
  const onRequest = room.basePricePerNight === null;
  const plans = rateOnly ? ratePlans.filter((r) => r.id === rateOnly) : ratePlans;
  const images = room.gallery.length ? room.gallery : room.photo ? [{ src: room.photo, alt: room.name }] : [];

  useEffect(() => {
    if (gallery === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGallery(null);
      if (e.key === "ArrowRight") setGallery((g) => (g === null ? g : (g + 1) % images.length));
      if (e.key === "ArrowLeft") setGallery((g) => (g === null ? g : (g - 1 + images.length) % images.length));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [gallery, images.length]);

  const BedIcon = room.bedKind === "single" ? BedSingle : BedDouble;

  return (
    <article className={cn("grid overflow-hidden border bg-white shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-lift)] md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]", highlighted ? "border-gold" : "border-sand", soldOut && "opacity-80")} data-testid={`room-${room.id}`}>
      {/* photo */}
      <div className="relative">
        <button type="button" onClick={() => images.length && setGallery(0)} className="group relative block aspect-[4/3] w-full overflow-hidden bg-cream md:h-full md:min-h-[18rem]" aria-label={`Bilder: ${room.name}`} disabled={!images.length}>
          {room.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={room.photo} alt={room.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-[1.6s] ease-out group-hover:scale-[1.04]" />
          ) : (
            <span className="grid h-full w-full place-items-center text-[0.65rem] uppercase tracking-[0.28em] text-muted">Bild folgt</span>
          )}
          {images.length > 1 && (
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 bg-anthracite/80 px-2.5 py-1.5 text-[0.65rem] uppercase tracking-[0.16em] text-paper backdrop-blur">
              <Images className="h-3.5 w-3.5" aria-hidden /> {images.length}
            </span>
          )}
          {soldOut && <span className="absolute left-3 top-3 bg-anthracite/85 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.18em] text-paper">Ausgebucht</span>}
          {inCart > 0 && <span className="absolute left-3 top-3 bg-gold px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink">{inCart} × im Warenkorb</span>}
        </button>
        <ul className="hidden flex-wrap gap-x-4 gap-y-1 px-5 py-3 text-[0.72rem] text-muted md:flex" aria-label="Ausstattung">
          {room.features.slice(0, 4).map((f) => {
            const Icon = FEATURE_ICON[f] ?? Check;
            return (
              <li key={f} className="inline-flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-gold-dark" aria-hidden /> {f}
              </li>
            );
          })}
        </ul>
      </div>

      {/* facts + rates */}
      <div className="flex flex-col p-5 md:p-7">
        <h3 className="font-serif text-[1.75rem] leading-tight text-ink">{rateOnly ? room.name : room.name}</h3>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-muted">
          <span className="inline-flex items-center gap-1.5"><BedIcon className="h-4 w-4 text-gold-dark" aria-hidden /> {room.beds}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-gold-dark" aria-hidden /> {plural(room.maxGuests, "Gast", "Gäste")}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5"><Bath className="h-4 w-4 text-gold-dark" aria-hidden /> Eigenes Bad</span>
        </p>
        <p className="mt-2 text-[0.95rem] text-ink-soft">{room.description}</p>
        <button type="button" onClick={() => setDetails((d) => !d)} aria-expanded={details} className="mt-2 inline-flex items-center gap-1 self-start text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-gold-dark underline-offset-4 hover:underline">
          Zimmerdetails <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", details && "rotate-180")} aria-hidden />
        </button>
        {details && (
          <div className="mt-3 border-l-2 border-gold-pale pl-4 text-sm text-ink-soft" data-testid={`details-${room.id}`}>
            <p>{room.details}</p>
            <p className="mt-2 text-muted">{room.bathroom}</p>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {room.features.map((f) => {
                const Icon = FEATURE_ICON[f] ?? Check;
                return (
                  <li key={f} className="inline-flex items-center gap-2 text-[0.85rem]">
                    <Icon className="h-4 w-4 text-gold-dark" aria-hidden /> {f}
                  </li>
                );
              })}
            </ul>
            {room.sizeHint && <p className="mt-2 text-xs text-muted">{room.sizeHint}</p>}
            {live && !soldOut && <p className="mt-2 text-xs text-muted">{live.free} von {live.totalRooms} frei im gewählten Zeitraum</p>}
          </div>
        )}

        <div className="mt-5 divide-y divide-sand border-t border-sand">
          {plans.map((plan) => {
            const total = room.basePricePerNight === null ? null : room.basePricePerNight * Math.max(1, nights);
            return (
              <div key={plan.id} className="grid gap-4 py-5 sm:grid-cols-[1fr_auto]" data-testid={`rate-${room.id}-${plan.id}`}>
                <div>
                  <p className="font-semibold text-gold-dark underline decoration-gold-pale decoration-2 underline-offset-4">{plan.name}</p>
                  <ul className="mt-2 space-y-1.5">
                    {plan.bullets.map((b) => {
                      const Icon = BULLET_ICON[b.icon];
                      return (
                        <li key={b.text} className="flex items-start gap-2 text-[0.85rem] text-ink-soft">
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> {b.text}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="flex flex-row items-end justify-between gap-4 sm:flex-col sm:items-end sm:text-right">
                  <div>
                    {onRequest ? (
                      <p className="font-serif text-2xl text-ink">auf Anfrage</p>
                    ) : (
                      <>
                        <p className="font-serif text-[1.65rem] leading-none text-ink tabular-nums">{formatMoney(room.basePricePerNight)}</p>
                        <p className="mt-1 text-[0.7rem] leading-tight text-muted">
                          pro Nacht · {plan.priceNote}
                          {stayReady && nights > 0 && total !== null && (
                            <>
                              <br />
                              {formatMoney(total)} für {plural(nights, "Nacht", "Nächte")}
                            </>
                          )}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="text-right">
                    <Pill variant={soldOut ? "outline" : "primary"} size="md" disabled={soldOut || !canAdd.ok} onClick={() => onAdd(plan.id)} data-testid={`book-${room.id}`} title={!canAdd.ok ? canAdd.reason : undefined}>
                      {soldOut ? "Ausgebucht" : onRequest ? "Anfragen" : "Jetzt buchen"}
                    </Pill>
                    {!soldOut && !canAdd.ok && canAdd.reason && <p className="mt-1 max-w-[12rem] text-[0.68rem] text-muted">{canAdd.reason}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {gallery !== null && images[gallery] && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-anthracite/95 p-4" role="dialog" aria-modal="true" aria-label={`Bilder: ${room.name}`} onClick={() => setGallery(null)}>
          <button type="button" onClick={() => setGallery(null)} aria-label="Schließen" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-paper hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
          {images.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); setGallery((gallery - 1 + images.length) % images.length); }} aria-label="Vorheriges Bild" className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-paper hover:bg-white/20">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setGallery((gallery + 1) % images.length); }} aria-label="Nächstes Bild" className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-paper hover:bg-white/20">
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[gallery].src} alt={images[gallery].alt} className="max-h-[86vh] max-w-full object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-paper/70">
            {room.name} · {gallery + 1} / {images.length}
          </p>
        </div>
      )}
    </article>
  );
}
