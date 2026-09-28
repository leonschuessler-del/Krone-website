"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaAsset } from "@/domain/types";
import { cn } from "@/lib/cn";

/**
 * Gallery: grid + lightbox on desktop, swipeable rail on mobile.
 * Lightbox: keyboard (←/→/Esc), swipe, focus handled by native <dialog>.
 */
export function Gallery({ images, className, label = "Galerie" }: { images: MediaAsset[]; className?: string; label?: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);

  const open = (i: number) => setIndex(i);
  const close = useCallback(() => setIndex(null), []);
  const step = useCallback((d: number) => setIndex((i) => (i === null ? i : (i + d + images.length) % images.length)), [images.length]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (index !== null && !el.open) el.showModal();
    if (index === null && el.open) el.close();
  }, [index]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, step]);

  if (images.length === 0) return null;
  const current = index !== null ? images[index] : null;
  const hasDemo = images.some((i) => !i.isReal);

  return (
    <div className={className}>
      {/* Mobile rail */}
      <ul className="rail -mx-5 flex gap-3 overflow-x-auto px-5 pb-2 md:hidden" aria-label={label}>
        {images.map((img, i) => (
          <li key={img.src} className="relative aspect-[4/3] w-[82%] shrink-0 overflow-hidden rounded-2xl">
            <button type="button" className="absolute inset-0" onClick={() => open(i)} aria-label={`${img.alt} vergrößern`}>
              <Image src={img.src} alt={img.alt} fill sizes="82vw" className="object-cover" loading="lazy" />
            </button>
          </li>
        ))}
      </ul>
      {/* Desktop grid */}
      <ul className="hidden auto-rows-[200px] grid-cols-4 gap-3 md:grid lg:auto-rows-[230px]" aria-label={label}>
        {images.map((img, i) => (
          <li key={img.src} className={cn("group relative overflow-hidden rounded-2xl", i === 0 && "col-span-2 row-span-2")}>
            <button type="button" className="absolute inset-0" onClick={() => open(i)} aria-label={`${img.alt} vergrößern`}>
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes={i === 0 ? "50vw" : "25vw"}
                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                loading="lazy"
              />
            </button>
          </li>
        ))}
      </ul>
      {hasDemo && <p className="mt-2 text-xs text-muted">Beispielbilder (Illustrationen) – echte Aufnahmen folgen.</p>}

      <dialog
        ref={dialogRef}
        onClose={close}
        onClick={(e) => e.target === dialogRef.current && close()}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-anthracite/95 p-0 text-paper backdrop:bg-black/70"
        aria-label="Bildansicht"
      >
        {current && (
          <div
            className="relative flex h-full w-full items-center justify-center"
            onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
            onTouchEnd={(e) => {
              const start = touchX.current;
              const end = e.changedTouches[0]?.clientX;
              if (start !== null && end !== undefined && Math.abs(end - start) > 40) step(end < start ? 1 : -1);
              touchX.current = null;
            }}
          >
            <div className="relative h-[80vh] w-[92vw] max-w-6xl">
              <Image src={current.src} alt={current.alt} fill sizes="92vw" className="object-contain" />
            </div>
            <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-sm text-paper/70">
              {current.alt} · {index! + 1} / {images.length}
            </p>
            <button type="button" onClick={close} className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Schließen">
              <X className="h-5 w-5" />
            </button>
            {images.length > 1 && (
              <>
                <button type="button" onClick={() => step(-1)} className="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Vorheriges Bild">
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button type="button" onClick={() => step(1)} className="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Nächstes Bild">
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
        )}
      </dialog>
    </div>
  );
}
