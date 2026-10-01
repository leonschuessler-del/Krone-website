"use client";

import Link from "next/link";
import { ArrowDown, ChevronsDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { floorplanMeta, mapFeatures } from "@/config/floorplan";
import { mapConfig } from "@/config/map";
import { FINALE_START_CAMERA, tourConfig, WIDE_CAMERA } from "@/config/tour";
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
}

interface Props {
  spaces: TourSpace[];
  hero: { eyebrow: string; subline: string };
}

const { width: MAP_W, height: MAP_H } = floorplanMeta.viewBox;
const pts = (poly: readonly Point[]) => poly.map(([x, y]) => `${x},${y}`).join(" ");

/**
 * Scroll film: a tall section with a sticky full-screen stage. The scroll
 * position scrubs one graded clip per chapter (crossfaded) and finally hands
 * over to the drone photo with the bookable areas. Per-frame work happens in
 * requestAnimationFrame with direct style writes; React only re-renders when
 * the chapter changes (which also decides which clips are loaded).
 */
export function ScrollTour({ spaces, hero }: Props) {
  const chapters = tourConfig.chapters;
  const spans = useMemo(() => chapterSpans(chapters), [chapters]);
  const byId = useMemo(() => new Map(spaces.map((s) => [s.id, s])), [spaces]);
  const roomChapters = chapters.filter((c) => c.spaceId);

  const sectionRef = useRef<HTMLElement>(null);
  const aerialRef = useRef<HTMLDivElement>(null);
  const areasRef = useRef<SVGGElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLAnchorElement>(null);
  const layerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const captionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const [announced, setAnnounced] = useState("");

  const apply = useCallback(
    (frame: TourFrame, vp: { width: number; height: number }) => {
      chapters.forEach((_, i) => {
        const layer = layerRefs.current[i];
        const o = frame.videoOpacity[i]!;
        if (layer) {
          layer.style.opacity = o.toFixed(3);
          layer.style.visibility = o > 0.001 ? "visible" : "hidden";
        }
        const video = videoRefs.current[i];
        if (video && o > 0.001 && video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0) {
          const target = Math.min(video.duration - 0.05, frame.videoProgress[i]! * video.duration);
          if (Math.abs(video.currentTime - target) > 1 / 45) video.currentTime = target;
        }
        const caption = captionRefs.current[i];
        if (caption) {
          const c = frame.captionOpacity[i]!;
          caption.style.opacity = c.toFixed(3);
          caption.style.transform = `translate3d(0, ${((1 - c) * 18).toFixed(1)}px, 0)`;
          caption.style.visibility = c > 0.01 ? "visible" : "hidden";
        }
      });
      const aerial = aerialRef.current;
      if (aerial) {
        aerial.style.opacity = frame.mapOpacity.toFixed(3);
        aerial.style.visibility = frame.mapOpacity > 0.001 ? "visible" : "hidden";
        const k = Number(aerial.dataset.k ?? 1);
        const to = overviewCamera(WIDE_CAMERA, vp, { width: MAP_W, height: MAP_H });
        const cam = frame.mapOpacity > 0 ? { ...frame.camera, ...(frame.camera.zoom < to.zoom ? to : {}) } : frame.camera;
        const { tx, ty, scale } = cameraTransform(cam, vp, { width: MAP_W, height: MAP_H });
        aerial.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${(scale / k).toFixed(5)})`;
      }
      if (areasRef.current) areasRef.current.style.opacity = frame.areasOpacity.toFixed(3);
      const skip = skipRef.current;
      if (skip) {
        const o = 1 - frame.areasOpacity;
        skip.style.opacity = o.toFixed(3);
        skip.style.visibility = o > 0.01 ? "visible" : "hidden";
      }
      const hint = hintRef.current;
      if (hint) {
        hint.style.opacity = frame.scrollHint.toFixed(3);
        hint.style.display = frame.scrollHint > 0.001 ? "" : "none";
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
    let lastTarget = -1;

    const measure = () => {
      const rect = section.getBoundingClientRect();
      const scrollable = Math.max(1, rect.height - window.innerHeight);
      return Math.min(1, Math.max(0, -rect.top / scrollable));
    };

    const tick = () => {
      raf = 0;
      target = measure();
      // an instant jump (skip link, history restore) snaps instead of fast-forwarding
      const jumped = lastTarget >= 0 && Math.abs(target - lastTarget) > 0.2;
      lastTarget = target;
      current = current < 0 || jumped ? target : current + (target - current) * 0.18;
      if (Math.abs(target - current) < 0.0004) current = target;
      const vp = { width: window.innerWidth, height: window.innerHeight };
      const finaleTo = overviewCamera(WIDE_CAMERA, vp, { width: MAP_W, height: MAP_H });
      apply(computeFrame(current, chapters, spans, FINALE_START_CAMERA, finaleTo), vp);
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${current.toFixed(4)})`;
      if (current !== target) raf = requestAnimationFrame(tick);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // when a clip has loaded its metadata, re-apply the current frame
    const videos = videoRefs.current.filter(Boolean) as HTMLVideoElement[];
    videos.forEach((v) => v.addEventListener("loadedmetadata", schedule));
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      videos.forEach((v) => v.removeEventListener("loadedmetadata", schedule));
      if (raf) cancelAnimationFrame(raf);
    };
  }, [apply, chapters, spans, active]);

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

  const jumpTo = (index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const scrollable = section.offsetHeight - window.innerHeight;
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + chapterScrollTarget(spans[index]!, scrollable, index === 0 ? 0 : 0.5), behavior: "instant" as ScrollBehavior });
  };

  // Only load clips around the current chapter (bandwidth); the rest keep their poster.
  const shouldLoad = (i: number) => i >= active - 1 && i <= active + 2;
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
        ["--tour-chapters" as string]: chapters.length,
        ["--tour-step-mobile" as string]: `${tourConfig.scrollPerChapterVh.mobile}vh`,
        ["--tour-step-desktop" as string]: `${tourConfig.scrollPerChapterVh.desktop}vh`,
      }}
    >
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden bg-anthracite text-paper">
        {/* CLIP LAYERS (stacked in tour order, later on top) */}
        {chapters.map((c, i) => (
          <div
            key={c.id}
            ref={(el) => {
              layerRefs.current[i] = el;
            }}
            className="absolute inset-0"
            style={{ opacity: i === 0 ? 1 : 0, visibility: i === 0 ? "visible" : "hidden" }}
            aria-hidden="true"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.poster} alt="" className="absolute inset-0 h-full w-full object-cover" fetchPriority={i === 0 ? "high" : "low"} loading={i < 2 ? "eager" : "lazy"} />
            <video
              ref={(el) => {
                videoRefs.current[i] = el;
              }}
              className="absolute inset-0 h-full w-full object-cover"
              src={shouldLoad(i) ? c.video : undefined}
              poster={c.poster}
              muted
              playsInline
              preload={shouldLoad(i) ? "auto" : "none"}
              disablePictureInPicture
              disableRemotePlayback
              tabIndex={-1}
            />
          </div>
        ))}

        {/* FINALE: drone photo from above with the bookable areas */}
        <div
          ref={aerialRef}
          data-k={k}
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{ width: MAP_W * k, height: MAP_H * k, opacity: 0, visibility: "hidden" }}
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mapConfig.baseLayer.src} srcSet={mapConfig.baseLayer.srcSet} sizes="150vw" alt="" className="absolute inset-0 h-full w-full" draggable={false} loading="lazy" />
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="absolute inset-0 h-full w-full will-change-transform">
            <g ref={areasRef} style={{ opacity: 0 }}>
              {mapFeatures
                .filter((f) => f.type === "toilets")
                .map((f) => (
                  <polygon key={f.id} points={pts(f.polygon)} fill="#1c1917" fillOpacity={0.45} stroke="#f4efe6" strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
                ))}
              {spaces
                .filter((s) => s.polygon && s.bookable)
                .map((s) => (
                  <polygon key={s.id} points={pts(s.polygon!)} fill={s.color} fillOpacity={0.42} stroke="#e0c386" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
                ))}
              {spaces
                .filter((s) => s.polygon && s.bookable && s.labelPosition)
                .map((s) => (
                  <g key={`l-${s.id}`} transform={`translate(${s.labelPosition!.x} ${s.labelPosition!.y})`}>
                    <circle r={24} fill="#1c1917" fillOpacity={0.9} stroke="#d8bb7e" strokeWidth={2} />
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
                      <Link href="#grundriss" prefetch={false} className="inline-flex h-13 items-center justify-center rounded-full border border-white/20 bg-white/5 px-7 font-semibold backdrop-blur hover:bg-white/10">
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
                  <button type="button" onClick={() => jumpTo(i)} className="group flex min-h-8 items-center gap-3" aria-current={on ? "step" : undefined} aria-label={`Zu: ${label}`}>
                    <span className={cn("text-xs font-semibold tracking-wide transition-opacity duration-300", on ? "text-paper opacity-100" : "text-paper/70 opacity-0 group-hover:opacity-100")}>{label}</span>
                    <span className={cn("block rounded-full transition-all duration-300", on ? "h-3 w-3 bg-gold-light" : "h-2 w-2 bg-white/45 group-hover:bg-white/80")} />
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
        <p className="sr-only" aria-live="polite">
          {announced}
        </p>
        <span hidden data-finale-index={finale} />
      </div>
    </section>
  );
}
