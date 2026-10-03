"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface MapMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  text?: string;
  minutes?: number;
  primary?: boolean;
}

/**
 * Map of the house and the sights: Leaflet is bundled with the site (no CDN),
 * the tiles come from OpenStreetMap and load as soon as the map scrolls into
 * view (see Datenschutz → Umgebungskarte). Markers: the house in gold, the
 * sights in dark, each with name and driving time.
 */
export function LeafletMap({ markers, center, zoom = 10, className, height = "h-[28rem]" }: { markers: MapMarker[]; center: { lat: number; lng: number }; zoom?: number; className?: string; height?: string }) {
  const [ready, setReady] = useState(false);
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let cancelled = false;
    let destroy: (() => void) | null = null;
    const start = async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !el.current) return;
      const map = L.map(el.current, { scrollWheelZoom: false }).setView([center.lat, center.lng], zoom);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende' }).addTo(map);
      const icon = (primary: boolean) =>
        L.divIcon({
          className: "",
          html: `<span style="display:block;width:${primary ? 18 : 12}px;height:${primary ? 18 : 12}px;border-radius:999px;background:${primary ? "#bc8620" : "#1b1816"};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></span>`,
          iconSize: [primary ? 18 : 12, primary ? 18 : 12],
          iconAnchor: [primary ? 9 : 6, primary ? 9 : 6],
        });
      for (const m of markers) {
        const marker = L.marker([m.lat, m.lng], { icon: icon(!!m.primary) }).addTo(map);
        marker.bindPopup(`<strong style="font-family:Georgia,serif;font-size:1.05rem">${m.name}</strong>${m.minutes ? `<br><span style="color:#6a6056">${m.minutes} Min. ab Hotel</span>` : ""}${m.text ? `<br><span style="color:#3a332d">${m.text}</span>` : ""}`);
        if (m.primary) marker.openPopup();
      }
      destroy = () => map.remove();
      setReady(true);
    };
    // load when near the viewport – saves the tiles for visitors who never scroll this far
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void start();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(node);
    return () => {
      cancelled = true;
      io.disconnect();
      destroy?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn("relative overflow-hidden border border-sand bg-cream", height, className)} data-testid="map">
      <div ref={el} className="absolute inset-0" />
      {!ready && <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted">Karte wird geladen …</p>}
    </div>
  );
}
