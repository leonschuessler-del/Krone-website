"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { mapConfig } from "@/config/map";
import type { HeroVideoSources } from "@/lib/media";

/**
 * Hero film (16:9, muted autoplay loop). Performance:
 *  - preload="none" + poster; playback starts only when visible
 *  - prefers-reduced-motion / Data-Saver → poster only, no autoplay
 * Without a film file, an animated placeholder based on our own bird's-eye
 * site plan is shown (slow camera drift) – visually leading into the map.
 */
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
/** Below this width the smaller 720p rendition is used (phones, Data volume). */
const SMALL_QUERY = "(max-width: 767px)";

function subscribeMedia(query: string) {
  return (onChange: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  };
}

const subscribeReducedMotion = subscribeMedia(REDUCED_QUERY);
const subscribeSmallViewport = subscribeMedia(SMALL_QUERY);

function getReducedMotion(): boolean {
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  return window.matchMedia(REDUCED_QUERY).matches || saveData;
}

function getSmallViewport(): boolean {
  return window.matchMedia(SMALL_QUERY).matches;
}

export function HeroVideo({ sources }: { sources: HeroVideoSources }) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduced = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
  const small = useSyncExternalStore(subscribeSmallViewport, getSmallViewport, () => false);
  const mp4 = small && sources.mp4Small ? sources.mp4Small : sources.mp4;
  const hasVideo = Boolean(sources.mp4 || sources.webm);

  useEffect(() => {
    const video = ref.current;
    if (!video || reduced) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: 0.2 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, [reduced, hasVideo, mp4]);

  if (hasVideo && !reduced) {
    return (
      <video
        // a <source> src is only read when the element loads → remount when the rendition changes
        key={mp4 ?? "video"}
        ref={ref}
        className="absolute inset-0 h-full w-full object-cover"
        muted
        loop
        playsInline
        preload="none"
        poster={sources.poster ?? undefined}
        aria-hidden="true"
        disablePictureInPicture
      >
        {sources.webm && <source src={sources.webm} type="video/webm" />}
        {mp4 && <source src={mp4} type="video/mp4" />}
      </video>
    );
  }

  if (hasVideo && sources.poster) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={sources.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />;
  }

  // Placeholder "film": our own stylised aerial view with a slow camera drift.
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#cfc9b8]" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mapConfig.baseLayer.src} alt="" className="absolute inset-0 h-full w-full animate-kenburns object-cover will-change-transform" />
    </div>
  );
}
