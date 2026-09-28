"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ChevronsDown, Film } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { floorplanMeta } from "@/config/floorplan";
import { mapConfig } from "@/config/map";
import { tourConfig, WIDE_CAMERA } from "@/config/tour";
import type { Point } from "@/domain/types";
import { SelectSpaceButton } from "@/features/spaces/SelectSpaceButton";
import { cn } from "@/lib/cn";
import { cameraTransform, chapterScrollTarget, chapterSpans, computeFrame, overviewCamera, type TourFrame } from "./tour-timeline";

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
  images: Array<{ src: string; alt: string; isReal: boolean }>;
}

interface Props {
  spaces: TourSpace[];
  hero: { eyebrow: string; subline: string };
  /** Real film for scroll-scrubbing (video mode) – null = storyboard mode. */
  videoSrc: string | null;
  videoPoster: string | null;
}

const { width: MAP_W, height: MAP_H } = floorplanMeta.viewBox;
const pts = (poly: readonly Point[]) => poly.map(([x, y]) => `${x},${y}`).join(" ");

/**
 * Scroll-driven opening tour ("scroll film").
 * A tall section with a sticky full-screen stage; the scroll position drives
 * the camera over our site plan and the room sequence. All per-frame work is
 * done with direct style writes in requestAnimationFrame (transform/opacity
 * only) – React only re-renders when the chapter changes.
 */
export function ScrollTour({ spaces, hero, videoSrc, videoPoster }: Props) {
  const chapters = tourConfig.chapters;
  const spans = useMemo(() => chapterSpans(chapters, videoSrc ? tourConfig.video.duration : null), [chapters, videoSrc]);
  const byId = useMemo(() => new Map(spaces.map((s) => [s.id, s])), [spaces]);
  const roomChapters = chapters.filter((c) => c.spaceId);

  const sectionRef = useRef<HTMLElement>(null);
  const aerialRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLAnchorElement>(null);
  const layerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const secondaryRefs = useRef<Array<HTMLDivElement | null>>([]);
  const captionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const polygonRefs = useRef<Array<SVGPolygonElement | null>>([]);
  const allPolygonsRef = useRef<SVGGElement>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const [announced, setAnnounced] = useState("");

  const apply = useCallback(
    (frame: TourFrame, vp: { width: number; height: number }) => {
      // aerial camera
      const aerial = aerialRef.current;
      if (aerial) {
        const k = Number(aerial.dataset.k ?? 1);
        const { tx, ty, scale } = cameraTransform(frame.camera, vp, { width: MAP_W, height: MAP_H });
        aerial.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${(scale / k).toFixed(5)})`;
      }
      chapters.forEach((_, i) => {
        const layer = layerRefs.current[i];
        if (layer) {
          layer.style.opacity = frame.roomOpacity[i]!.toFixed(3);
          layer.style.visibility = frame.roomOpacity[i]! > 0.001 ? "visible" : "hidden";
          const inner = layer.firstElementChild as HTMLElement | null;
          if (inner) inner.style.transform = `scale(${frame.roomScale[i]!.toFixed(4)})`;
        }
        const secondary = secondaryRefs.current[i];
        if (secondary) secondary.style.opacity = frame.roomSecondary[i]!.toFixed(3);
        const caption = captionRefs.current[i];
        if (caption) {
          const o = frame.captionOpacity[i]!;
          caption.style.opacity = o.toFixed(3);
          caption.style.transform = `translate3d(0, ${((1 - o) * 18).toFixed(1)}px, 0)`;
          caption.style.visibility = o > 0.01 ? "visible" : "hidden";
        }
        const poly = polygonRefs.current[i];
        if (poly) poly.style.opacity = frame.polygonOpacity[i]!.toFixed(3);
      });
      if (allPolygonsRef.current) allPolygonsRef.current.style.opacity = frame.allPolygons.toFixed(3);
      // The skip link duplicates the finale CTA – fade it out there.
      const skip = skipRef.current;
      if (skip) {
        const o = 1 - frame.allPolygons;
        skip.style.opacity = o.toFixed(3);
        skip.style.visibility = o > 0.01 ? "visible" : "hidden"; // also removes it from the tab order
      }
      const hint = hintRef.current;
      if (hint) {
        hint.style.opacity = frame.scrollHint.toFixed(3);
        hint.style.display = frame.scrollHint > 0.001 ? "" : "none"; // stops the bounce animation when hidden
      }
      if (frame.index !== activeRef.current) {
        activeRef.current = frame.index;
        setActive(frame.index);
      }
    },
    [chapters],
  );

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let raf = 0;
    let current = -1;
    let target = 0;
    let lastVideoTime = -1;

    const measure = () => {
      const rect = section.getBoundingClientRect();
      const scrollable = Math.max(1, rect.height - window.innerHeight);
      return Math.min(1, Math.max(0, -rect.top / scrollable));
    };

    let lastTarget = -1;
    const tick = () => {
      raf = 0;
      target = measure();
      // First frame, or an instant jump (skip links, /#karte, End key, history restore):
      // snap so we don't fast-forward through every chapter (re-renders, image loads, aria-live).
      const jumped = lastTarget >= 0 && Math.abs(target - lastTarget) > 0.2;
      lastTarget = target;
      // gentle smoothing for a filmic feel with mouse wheels; snaps when close
      current = current < 0 || jumped ? target : current + (target - current) * 0.2;
      if (Math.abs(target - current) < 0.0004) current = target;
      const vp = { width: window.innerWidth, height: window.innerHeight };
      const frame = computeFrame(current, chapters, spans, WIDE_CAMERA, overviewCamera(WIDE_CAMERA, vp, { width: MAP_W, height: MAP_H }));
      apply(frame, vp);
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${current.toFixed(4)})`;
      const video = videoRef.current;
      if (video && video.duration && Number.isFinite(video.duration)) {
        const time = current * video.duration;
        if (Math.abs(time - lastVideoTime) > 1 / 30) {
          video.currentTime = time;
          lastVideoTime = time;
        }
      }
      if (current !== target) raf = requestAnimationFrame(tick);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [apply, chapters, spans]);

  // Screen-reader announcement: only once the chapter has settled (debounce) and only
  // while the stage is pinned, so jumps across the tour (skip link, /#karte,
  // /#location) don't read out every room on the way.
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

  const jumpTo = (index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const scrollable = section.offsetHeight - window.innerHeight;
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + chapterScrollTarget(spans[index]!, scrollable, index === 0 ? 0 : 0.55), behavior: "smooth" });
  };

  // Load room images only around the current chapter (performance).
  const shouldLoad = (i: number) => i <= active + 2 && i >= active - 1;
  const k = 1.5; // render the plan 1.5× larger for crisp zooms

  return (
    <section
      ref={sectionRef}
      id="rundgang"
      data-hero="sticky"
      aria-label="Rundgang durch die Krone"
      className="tour-section relative bg-anthracite motion-reduce:hidden"
      style={{
        ["--tour-chapters" as string]: chapters.length,
        ["--tour-step-mobile" as string]: `${tourConfig.scrollPerChapterVh.mobile}vh`,
        ["--tour-step-desktop" as string]: `${tourConfig.scrollPerChapterVh.desktop}vh`,
      }}
    >
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden text-paper">
        {/* STAGE: aerial site plan (storyboard) or scrubbed film (video mode) */}
        {videoSrc ? (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            src={videoSrc}
            poster={videoPoster ?? undefined}
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
          />
        ) : (
          <div
            ref={aerialRef}
            data-k={k}
            className="absolute left-0 top-0 origin-top-left will-change-transform"
            style={{ width: MAP_W * k, height: MAP_H * k }}
            aria-hidden="true"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mapConfig.baseLayer.src} alt="" width={MAP_W * k} height={MAP_H * k} className="absolute inset-0 h-full w-full" draggable={false} fetchPriority="high" />
            {/* own compositing layer: overlay repaints must not force base.svg to re-rasterize */}
            <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="absolute inset-0 h-full w-full will-change-transform">
              {chapters.map((c, i) => {
                const s = c.spaceId ? byId.get(c.spaceId) : undefined;
                if (!s?.polygon) return null;
                return (
                  <polygon
                    key={c.id}
                    ref={(el) => {
                      polygonRefs.current[i] = el;
                    }}
                    points={pts(s.polygon)}
                    fill={s.color}
                    fillOpacity={0.45}
                    stroke="#e0c386"
                    strokeWidth={3}
                    vectorEffect="non-scaling-stroke"
                    style={{ opacity: 0 }}
                  />
                );
              })}
              <g ref={allPolygonsRef} style={{ opacity: 0 }}>
                {spaces
                  .filter((s) => s.polygon && s.bookable)
                  .map((s) => (
                    <polygon key={s.id} points={pts(s.polygon!)} fill={s.color} fillOpacity={0.5} stroke="#e0c386" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
                  ))}
                {spaces
                  .filter((s) => s.polygon && s.bookable && s.labelPosition)
                  .map((s) => (
                    <g key={`l-${s.id}`} transform={`translate(${s.labelPosition!.x} ${s.labelPosition!.y})`}>
                      <circle r={25} fill="#1c1917" fillOpacity={0.9} stroke="#d8bb7e" strokeWidth={2} />
                      <text textAnchor="middle" dominantBaseline="central" fill="#fbf8f2" fontSize={s.code.length > 1 ? 19 : 23} fontFamily="Georgia, serif" fontWeight={600}>
                        {s.code}
                      </text>
                    </g>
                  ))}
              </g>
            </svg>
          </div>
        )}

        {/* ROOM LAYERS */}
        {!videoSrc &&
          chapters.map((c, i) => {
            const s = c.spaceId ? byId.get(c.spaceId) : undefined;
            if (!s) return null;
            const [first, second] = s.images;
            return (
              <div
                key={c.id}
                ref={(el) => {
                  layerRefs.current[i] = el;
                }}
                className="absolute inset-0 overflow-hidden bg-anthracite"
                style={{ opacity: 0, visibility: "hidden" }}
                aria-hidden="true"
              >
                <div className="absolute inset-0 will-change-transform">
                  {first && shouldLoad(i) ? (
                    <Image src={first.src} alt="" fill sizes="100vw" className="object-cover" />
                  ) : (
                    <div className="absolute inset-0" style={{ background: `radial-gradient(120% 90% at 30% 20%, ${s.color}55, #1c1917 70%)` }} />
                  )}
                  {second && shouldLoad(i) && (
                    <div
                      ref={(el) => {
                        secondaryRefs.current[i] = el;
                      }}
                      className="absolute inset-0"
                      style={{ opacity: 0 }}
                    >
                      <Image src={second.src} alt="" fill sizes="100vw" className="object-cover" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        {/* legibility gradients */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-anthracite/90 via-anthracite/20 to-anthracite/35" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-anthracite/75 via-anthracite/10 to-transparent" />

        {/* CAPTIONS */}
        <div className="absolute inset-0">
          {chapters.map((c, i) => {
            const isActive = i === active;
            const common = {
              ref: (el: HTMLDivElement | null) => {
                captionRefs.current[i] = el;
              },
              style: { opacity: i === 0 ? 1 : 0, visibility: (i === 0 ? "visible" : "hidden") as "visible" | "hidden" },
            };
            if (c.id === "intro") {
              return (
                <div key={c.id} {...common} className={cn("container-page absolute inset-x-0 bottom-0 pb-24 md:pb-28", !isActive && "pointer-events-none")}>
                  <div className="max-w-3xl">
                    <p className="eyebrow !text-gold-light">{hero.eyebrow}</p>
                    <h1 className="mt-5 text-[2.9rem] leading-[1.02] sm:text-6xl lg:text-[5.4rem] short:mt-3 short:text-[2.25rem]">
                      Ein Ort. <em className="font-medium text-gold-light">Viele Möglichkeiten.</em>
                    </h1>
                    <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper/85 md:text-xl short:hidden">{hero.subline}</p>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row short:mt-5">
                      <button type="button" onClick={() => jumpTo(1)} className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#d4b06a] to-[#b8904a] px-7 font-semibold text-anthracite shadow-[0_8px_20px_-10px_rgb(138_106_47/0.9)]">
                        Rundgang starten <ArrowDown className="h-4 w-4" />
                      </button>
                      {/* <Link>, not <a>: a native #hash jump leaves a history entry without router
                          state, and Back from a room page opened from the map would then do nothing. */}
                      <Link href="#grundriss" prefetch={false} className="inline-flex h-13 items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 font-semibold hover:bg-white/10">
                        Direkt zum Grundriss
                      </Link>
                    </div>
                  </div>
                </div>
              );
            }
            if (c.id === "finale") {
              return (
                <div key={c.id} {...common} className={cn("container-page absolute inset-x-0 bottom-0 pb-20 md:pb-24 short:pb-12", !isActive && "pointer-events-none")}>
                  <div className="max-w-xl">
                    <p className="eyebrow !text-gold-light">Grundriss</p>
                    <h2 className="mt-3 text-4xl md:text-6xl short:text-3xl">{tourConfig.copy.finaleTitle}</h2>
                    <p className="mt-4 max-w-xl text-lg text-paper/85 short:hidden">{tourConfig.copy.finaleText}</p>
                    <Link href="#grundriss" prefetch={false} className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-gold px-6 font-semibold text-anthracite hover:bg-gold-light">
                      {tourConfig.copy.finaleCta} <ArrowDown className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              );
            }
            const s = c.spaceId ? byId.get(c.spaceId) : undefined;
            if (!s) return null;
            const n = roomChapters.findIndex((r) => r.id === c.id) + 1;
            const demoImage = s.images[0] && !s.images[0].isReal;
            return (
              <div key={c.id} {...common} className={cn("container-page absolute inset-x-0 bottom-0 pb-20 md:pb-24 short:pb-12", !isActive && "pointer-events-none")}>
                <div className="max-w-xl">
                  <p className="eyebrow !text-gold-light">
                    Bereich {n} von {roomChapters.length}
                  </p>
                  <h2 className="mt-3 flex items-center gap-4 text-5xl md:text-7xl short:text-4xl">
                    <span className="grid h-12 min-w-12 place-items-center rounded-full border border-white/40 px-2 font-serif text-lg font-semibold md:h-14 md:min-w-14" style={{ background: s.color }}>
                      {s.code}
                    </span>
                    {s.name}
                  </h2>
                  {s.shortDescription && <p className="mt-4 text-lg text-paper/85 [@media(max-height:440px)]:hidden">{s.shortDescription}</p>}
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href={s.href} className="inline-flex h-11 items-center rounded-full border border-white/25 bg-white/5 px-5 font-semibold backdrop-blur hover:bg-white/15" tabIndex={isActive ? 0 : -1}>
                      Details ansehen
                    </Link>
                    {s.bookable && <SelectSpaceButton spaceId={s.id} name={s.name} className="h-11" />}
                  </div>
                  {demoImage && <p className="mt-4 text-[0.7rem] font-semibold uppercase tracking-wider text-paper/55">Beispielbild (Illustration) – echte Aufnahmen folgen</p>}
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
              const label = s?.name ?? (c.id === "intro" ? "Start" : "Grundriss");
              const on = i === active;
              return (
                <li key={c.id}>
                  {/* min-h-8: usable touch target on tablets in landscape (lg) */}
                  <button type="button" onClick={() => jumpTo(i)} className="group flex min-h-8 items-center gap-3" aria-current={on ? "step" : undefined} aria-label={`Zu: ${label}`}>
                    <span className={cn("text-xs font-semibold tracking-wide transition-opacity duration-300", on ? "text-paper opacity-100" : "text-paper/70 opacity-0 group-hover:opacity-100")}>{label}</span>
                    <span
                      className={cn("block rounded-full transition-all duration-300", on ? "h-3 w-3 bg-gold-light" : "h-2 w-2 bg-white/45 group-hover:bg-white/80")}
                      style={on && s ? { boxShadow: `0 0 0 3px ${s.color}` } : undefined}
                    />
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* scroll hint */}
        <div ref={hintRef} className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-xs uppercase tracking-[0.25em] text-paper/75">
          {tourConfig.copy.scrollHint}
          <ChevronsDown className="h-5 w-5 animate-bounce" />
        </div>

        {/* bottom bar: progress + skip */}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10" aria-hidden="true">
          <div ref={progressRef} className="h-full origin-left bg-gradient-to-r from-gold to-gold-light" style={{ transform: "scaleX(0)" }} />
        </div>
        <Link ref={skipRef} href="#grundriss" prefetch={false} className="absolute bottom-5 right-5 hidden items-center gap-1.5 rounded-full border border-white/15 bg-anthracite/50 px-3.5 py-1.5 text-xs font-semibold text-paper/85 backdrop-blur hover:text-paper sm:inline-flex">
          {tourConfig.copy.skip} <ArrowDown className="h-3.5 w-3.5" />
        </Link>
        {!videoSrc && (
          <span className="absolute left-5 top-24 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-anthracite/55 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-paper/75 backdrop-blur md:left-auto md:right-5 short:hidden">
            <Film className="h-3.5 w-3.5" /> Rundgang-Vorschau · Imagefilm folgt
          </span>
        )}
        <p className="sr-only" aria-live="polite">
          {announced}
        </p>
      </div>
    </section>
  );
}
