"use client";

import { useEffect, useRef, useState } from "react";
import { mapConfig } from "@/config/map";
import type { HeroVideoSources } from "@/lib/media";

/**
 * Hero film (16:9, muted autoplay loop). Performance:
 *  - preload="none" + poster; playback starts only when visible
 *  - prefers-reduced-motion / Data-Saver → poster only, no autoplay
 * Without a film file, an animated placeholder based on our own bird's-eye
 * site plan is shown (slow camera drift) – visually leading into the map.
 */
export function HeroVideo({ sources }: { sources: HeroVideoSources }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);
  const hasVideo = Boolean(sources.mp4 || sources.webm);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    setReduced(mq.matches || saveData);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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
  }, [reduced, hasVideo]);

  if (hasVideo && !reduced) {
    return (
      <video
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
        {sources.mp4 && <source src={sources.mp4} type="video/mp4" />}
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
