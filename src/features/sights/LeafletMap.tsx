"use client";

import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
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

const LEAFLET_CSS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
const LEAFLET_JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";

declare global {
  interface Window {
    L?: unknown;
  }
}

/**
 * Privacy-first map: nothing is loaded until the visitor clicks. Then
 * Leaflet + OpenStreetMap tiles (see Datenschutz → Umgebungskarte). Markers:
 * the house (gold) and the sights (dark), each with name and driving time.
 */
export function LeafletMap({ markers, center, zoom = 10, className, height = "h-[28rem]" }: { markers: MapMarker[]; center: { lat: number; lng: number }; zoom?: number; className?: string; height?: string }) {
  const [consent, setConsent] = useState(false);
  const [ready, setReady] = useState(false);
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!consent) return;
    let cancelled = false;
    const load = async () => {
      if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = LEAFLET_CSS;
        document.head.appendChild(link);
      }
      if (!window.L) {
        await new Promise<void>((res, rej) => {
          const s = document.createElement("script");
          s.src = LEAFLET_JS;
          s.onload = () => res();
          s.onerror = () => rej(new Error("leaflet"));
          document.head.appendChild(s);
        });
      }
      if (cancelled || !el.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = window.L as any;
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
      setReady(true);
    };
    load().catch(() => setReady(false));
    return () => {
      cancelled = true;
    };
  }, [consent, markers, center, zoom]);

  return (
    <div className={cn("relative overflow-hidden rounded-none border border-sand bg-cream", height, className)} data-testid="map">
      <div ref={el} className={cn("absolute inset-0", !ready && "invisible")} />
      {!consent && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <MapPin className="h-8 w-8 text-gold" strokeWidth={1.2} aria-hidden />
          <p className="max-w-md text-sm leading-relaxed text-ink-soft">Die Karte wird von OpenStreetMap geladen. Dabei wird Ihre IP-Adresse an die OpenStreetMap Foundation übertragen – erst nach Ihrem Klick.</p>
          <Button variant="primary" onClick={() => setConsent(true)} data-testid="map-consent">
            Karte laden
          </Button>
        </div>
      )}
      {consent && !ready && <p className="absolute inset-0 grid place-items-center text-sm text-muted">Karte wird geladen …</p>}
    </div>
  );
}
