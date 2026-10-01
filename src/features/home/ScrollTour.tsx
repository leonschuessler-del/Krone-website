"use client";

import Link from "next/link";
import { ArrowDown, ChevronsDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { floorplanMeta, mapFeatures } from "@/config/floorplan";
import { mapConfig } from "@/config/map";
import { tourConfig } from "@/config/tour";
import type { Point } from "@/domain/types";
import { SelectSpaceButton } from "@/features/spaces/SelectSpaceButton";
import { cn } from "@/lib/cn";
import { mountTourPlayer } from "./tour-player";
import { totalWeight } from "./tour-timeline";

export interface TourSpace {
  id: string;
  name: string;
  code: string;
  color: string;
  href: string;
  shortDescription: string | null;
  bookable: boolean;
  polygon: Point[] | null;
  labelPosition: { x: number; y: number } | null;
}

interface Props {
  spaces: TourSpace[];
  hero: { eyebrow: string; subline: string };
}

const { width: MAP_W, height: MAP_H } = floorplanMeta.viewBox;
const pts = (poly: readonly Point[]) => poly.map(([x, y]) => `${x},${y}`).join(" ");

/**
 * Scroll film: a tall section with a sticky full-screen stage. The scroll
 * position scrubs one image sequence per chapter on a canvas (crossfaded) and
 * finally hands over to the drone photo with the bookable areas. All per-frame
 * work lives in the framework-agnostic tour player (shared with the static
 * preview); React only re-renders when the chapter changes.
 */
export function ScrollTour({ spaces, hero }: Props) {
  const chapters = tourConfig.chapters;
  const byId = useMemo(() => new Map(spaces.map((s) => [s.id, s])), [spaces]);
  const roomChapters = chapters.filter((c) => c.spaceId);

  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [announced, setAnnounced] = useState("");

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    return mountTourPlayer(section, { chapters, map: { width: MAP_W, height: MAP_H }, onActive: setActive });
  }, [chapters]);

  // Screen-reader announcement once the chapter settled and only while pinned.
  const activeSpaceId = chapters[active]?.spaceId;
  const activeLabel = activeSpaceId ? (byId.get(activeSpaceId)?.name ?? "") : active === 0 ? "Start" : "Grundriss";
  useEffect(() => {
    const id = window.setTimeout(() => {
      const r = sectionRef.current?.getBoundingClientRect();
      const pinned = !!r && r.top < 0 && r.bottom > window.innerHeight;
      setAnnounced(pinned ? activeLabel : "");
    }, 500);
    return () => window.clearTimeout(id);
  }, [activeLabel]);

  const k = 1.5; // render the photo 1.5× larger for crisp zooms
  const finale = chapters.length - 1;

  return (
    <section
      ref={sectionRef}
      id="rundgang"
      data-hero="sticky"
      aria-label="Rundgang durch die Krone"
      className="tour-section relative bg-anthracite motion-reduce:hidden"
      style={{
        ["--tour-chapters" as string]: totalWeight(chapters).toFixed(2),
        ["--tour-step-mobile" as string]: `${tourConfig.scrollPerChapterVh.mobile}vh`,
        ["--tour-step-desktop" as string]: `${tourConfig.scrollPerChapterVh.desktop}vh`,
      }}
    >
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden bg-anthracite text-paper">
        {/* IMAGE SEQUENCES (drawn by the tour player) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img data-tour-poster src={chapters[0]!.poster} alt="" className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" aria-hidden="true" />
        <canvas data-tour-canvas className="absolute inset-0 h-full w-full" aria-hidden="true" />

        {/* FINALE: drone photo from above with the bookable areas */}
        <div
          data-tour-aerial
          data-k={k}
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{ width: MAP_W * k, height: MAP_H * k, opacity: 0, visibility: "hidden" }}
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mapConfig.baseLayer.src} srcSet={mapConfig.baseLayer.srcSet} sizes="150vw" alt="" className="absolute inset-0 h-full w-full" draggable={false} loading="lazy" />
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="absolute inset-0 h-full w-full will-change-transform">
            <g data-tour-areas style={{ opacity: 0 }}>
              {mapFeatures
                .filter((f) => f.type === "toilets")
                .map((f) => (
                  <polygon key={f.id} points={pts(f.polygon)} fill="#1c1917" fillOpacity={0.45} stroke="#f4efe6" strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
                ))}
              {spaces
                .filter((s) => s.polygon && s.bookable)
                .map((s) => (
                  <polygon key={s.id} points={pts(s.polygon!)} fill="#ffffff" fillOpacity={0.1} stroke="#f4efe6" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                ))}
              {spaces
                .filter((s) => s.polygon && s.bookable && s.labelPosition)
                .map((s) => (
                  <g key={`l-${s.id}`} transform={`translate(${s.labelPosition!.x} ${s.labelPosition!.y})`}>
                    <circle r={22} fill="#1c1917" fillOpacity={0.88} stroke="#f4efe6" strokeOpacity={0.7} strokeWidth={1.5} />
                    <text textAnchor="middle" dominantBaseline="central" fill="#fbf8f2" fontSize={s.code.length > 1 ? 17 : 21} fontFamily="Georgia, serif" fontWeight={600}>
                      {s.code}
                    </text>
                  </g>
                ))}
            </g>
          </svg>
        </div>

        {/* legibility gradients */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-anthracite/85 via-anthracite/10 to-anthracite/40" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-anthracite/60 via-transparent to-transparent" />

        {/* CAPTIONS */}
        <div className="absolute inset-0">
          {chapters.map((c, i) => {
            const isActive = i === active;
            const common = {
              "data-tour-caption": i,
              style: { opacity: i === 0 ? 1 : 0, visibility: (i === 0 ? "visible" : "hidden") as "visible" | "hidden" },
            };
            if (c.id === "intro") {
              return (
                <div key={c.id} {...common} className={cn("container-page absolute inset-x-0 bottom-0 pb-24 md:pb-28", !isActive && "pointer-events-none")}>
                  <div className="max-w-3xl">
                    <p className="eyebrow !text-gold-light">{hero.eyebrow}</p>
                    <h1 className="mt-5 text-[2.9rem] leading-[1.02] sm:text-6xl lg:text-[5.4rem] short:mt-3 short:text-[2.25rem]">
                      Willkommen <em className="font-medium text-gold-light">in der Krone.</em>
                    </h1>
                    <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper/85 md:text-xl short:hidden">{hero.subline}</p>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row short:mt-5">
                      <button type="button" data-tour-start className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#d4b06a] to-[#b8904a] px-7 font-semibold text-anthracite shadow-[0_8px_20px_-10px_rgb(138_106_47/0.9)]">
                        Rundgang starten <ArrowDown className="h-4 w-4" />
                      </button>
                      <Link href="#grundriss" prefetch={false} className="inline-flex h-13 items-center justify-center rounded-full border border-white/20 bg-white/5 px-7 font-semibold backdrop-blur hover:bg-white/10">
                        Direkt zur Karte
                      </Link>
                    </div>
                  </div>
                </div>
              );
            }
            if (c.id === "finale") {
              return (
                <div key={c.id} {...common} className={cn("container-page absolute inset-x-0 bottom-0 pb-20 md:pb-24 short:pb-12", !isActive && "pointer-events-none")}>
                  <div className="max-w-xl rounded-[1.5rem] bg-anthracite/55 p-6 backdrop-blur-md md:p-8">
                    <p className="eyebrow !text-gold-light">Grundriss</p>
                    <h2 className="mt-3 text-4xl md:text-5xl short:text-3xl">{tourConfig.copy.finaleTitle}</h2>
                    <p className="mt-4 max-w-xl text-lg text-paper/85 short:hidden">{tourConfig.copy.finaleText}</p>
                    <Link href="#grundriss" prefetch={false} className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-gold px-6 font-semibold text-anthracite hover:bg-gold-light">
                      {tourConfig.copy.finaleCta} <ArrowDown className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              );
            }
            const s = c.spaceId ? byId.get(c.spaceId) : undefined;
            if (!s) return null;
            const n = roomChapters.findIndex((r) => r.id === c.id) + 1;
            return (
              <div key={c.id} {...common} className={cn("container-page absolute inset-x-0 bottom-0 pb-20 md:pb-24 short:pb-12", !isActive && "pointer-events-none")}>
                <div className="max-w-xl">
                  <p className="eyebrow !text-gold-light">
                    {String(n).padStart(2, "0")} / {String(roomChapters.length).padStart(2, "0")}{"kicker" in c && c.kicker ? ` · ${c.kicker}` : ""}
                  </p>
                  <h2 className="mt-3 text-5xl md:text-7xl short:text-4xl">{s.name}</h2>
                  {s.shortDescription && <p className="mt-4 text-lg text-paper/85 [@media(max-height:440px)]:hidden">{s.shortDescription}</p>}
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href={s.href} className="inline-flex h-11 items-center rounded-full border border-white/25 bg-white/5 px-5 font-semibold backdrop-blur hover:bg-white/15" tabIndex={isActive ? 0 : -1}>
                      Details ansehen
                    </Link>
                    {s.bookable && <SelectSpaceButton spaceId={s.id} name={s.name} className="h-11" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* chapter rail (desktop) */}
        <nav aria-label="Kapitel des Rundgangs" className="absolute right-5 top-1/2 hidden -translate-y-1/2 lg:block">
          <ol className="flex flex-col items-end">
            {chapters.map((c, i) => {
              const s = c.spaceId ? byId.get(c.spaceId) : undefined;
              const label = s?.name ?? (c.id === "intro" ? "Ankommen" : "Grundriss");
              const on = i === active;
              return (
                <li key={c.id}>
                  <button type="button" data-tour-rail={i} data-active={on} className="tour-rail group flex min-h-8 items-center gap-3" aria-current={on ? "step" : undefined} aria-label={`Zu: ${label}`}>
                    <span className="tour-rail-label text-xs font-semibold tracking-wide">{label}</span>
                    <span className="tour-rail-dot block rounded-full" />
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* scroll hint */}
        <div data-tour-hint className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-xs uppercase tracking-[0.25em] text-paper/75">
          {tourConfig.copy.scrollHint}
          <ChevronsDown className="h-5 w-5 animate-bounce" />
        </div>

        {/* bottom bar: progress + skip */}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10" aria-hidden="true">
          <div data-tour-progress className="h-full origin-left bg-gradient-to-r from-gold to-gold-light" style={{ transform: "scaleX(0)" }} />
        </div>
        <Link data-tour-skip href="#grundriss" prefetch={false} className="absolute bottom-5 right-5 hidden items-center gap-1.5 rounded-full border border-white/15 bg-anthracite/50 px-3.5 py-1.5 text-xs font-semibold text-paper/85 backdrop-blur hover:text-paper sm:inline-flex">
          {tourConfig.copy.skip} <ArrowDown className="h-3.5 w-3.5" />
        </Link>
        <p className="sr-only" aria-live="polite">
          {announced}
        </p>
        <span hidden data-finale-index={finale} />
      </div>
    </section>
  );
}
