"use client";

import { Check, X as XIcon } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { floorplanMeta, mapFeatures } from "@/config/floorplan";
import { mapConfig } from "@/config/map";
import type { Point } from "@/domain/types";
import type { MapSpaceStatus, SpaceView } from "@/features/spaces/types";
import { cn } from "@/lib/cn";

const { width: W, height: H } = floorplanMeta.viewBox;
const pct = (v: number, total: number) => `${(v / total) * 100}%`;
const toPoints = (poly: readonly Point[]) => poly.map(([x, y]) => `${x},${y}`).join(" ");

const STATUS_TEXT: Record<MapSpaceStatus, string> = {
  available: "verfügbar",
  unavailable: "nicht verfügbar",
  partial: "teilweise verfügbar",
  unknown: "Verfügbarkeit nach Datumswahl",
};

export interface SiteMapProps {
  spaces: SpaceView[];
  selectedIds: string[];
  statuses?: Record<string, MapSpaceStatus>;
  /** Short status line per space for tooltips, e.g. "18:00–23:00 verfügbar". */
  statusDetail?: Record<string, string>;
  onToggle?: (id: string) => void;
  /** Called when a space is clicked/activated (e.g. to show a preview card). */
  onActivate?: (id: string) => void;
  /** Mini-map mode: only these spaces are emphasised, others dimmed. */
  highlightIds?: string[];
  interactive?: boolean;
  reveal?: boolean;
  showParking?: boolean;
  showCompass?: boolean;
  labels?: "auto" | "code" | "full" | "none";
  className?: string;
  ariaLabel?: string;
  children?: ReactNode;
}

export function SiteMap({
  spaces,
  selectedIds,
  statuses,
  statusDetail,
  onToggle,
  onActivate,
  highlightIds,
  interactive = true,
  reveal = false,
  showParking = true,
  showCompass = true,
  labels = "auto",
  className,
  ariaLabel = "Interaktive Grundstückskarte Zur Krone",
  children,
}: SiteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(1000);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(!reveal);
  const uid = useId().replace(/:/g, "");
  const drawn = useMemo(() => spaces.filter((s) => s.shape), [spaces]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!reveal || revealed) return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reveal, revealed]);

  const labelMode = labels === "auto" ? (width >= mapConfig.showNamesFromWidth ? "full" : "code") : labels;

  const focusSibling = useCallback((currentId: string, dir: 1 | -1) => {
    const ids = drawn.map((s) => s.id);
    const idx = ids.indexOf(currentId);
    const next = ids[(idx + dir + ids.length) % ids.length];
    const el = containerRef.current?.querySelector<SVGGElement>(`[data-space-id="${next}"]`);
    el?.focus();
  }, [drawn]);

  const handleKey = (e: KeyboardEvent<SVGGElement>, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle?.(id);
      onActivate?.(id);
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      focusSibling(id, 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      focusSibling(id, -1);
    }
  };

  const hovered = hoveredId ? drawn.find((s) => s.id === hoveredId) : undefined;

  return (
    <div
      ref={containerRef}
      className={cn("relative isolate aspect-[1536/1024] w-full select-none", className)}
      data-testid="site-map"
    >
      <div className="absolute inset-0 overflow-hidden rounded-[inherit] bg-[#cfc9b8]">
        {/* BASE LAYER – our own stylised site plan (static, cacheable image) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mapConfig.baseLayer.src}
          srcSet={mapConfig.baseLayer.srcSet}
          sizes="(min-width: 1024px) 66vw, 100vw"
          alt={mapConfig.baseLayer.alt}
          width={W}
          height={H}
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      {/* INTERACTION LAYER – one SVG polygon entity per space */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={cn("absolute inset-0 h-full w-full overflow-visible", reveal && "site-map-reveal", revealed && "is-revealed")}
        role="group"
        aria-label={ariaLabel}
      >
        <defs>
          <pattern id={`hatch-${uid}`} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="10" height="10" fill="transparent" />
            <line x1="0" y1="0" x2="0" y2="10" stroke="#f4efe6" strokeWidth="3" />
          </pattern>
        </defs>

        {/* Fixed facilities (not bookable) – always part of every booking */}
        {mapFeatures
          .filter((f) => f.type === "toilets")
          .map((f) => (
            <g key={f.id} className="site-map-facility" aria-hidden="true">
              <title>{`${f.label} – ${f.note ?? "nicht einzeln buchbar"}`}</title>
              <polygon points={toPoints(f.polygon)} fill="#1c1917" fillOpacity={0.42} stroke="#f4efe6" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
            </g>
          ))}

        {drawn.map((space, i) => {
          const shape = space.shape!;
          const selected = selectedIds.includes(space.id);
          const status = statuses?.[space.id] ?? "unknown";
          const dimmed = highlightIds ? !highlightIds.includes(space.id) : false;
          const pts = toPoints(shape.polygon);
          const label = `${space.name}, ${STATUS_TEXT[status]}, ${selected ? "ausgewählt" : "nicht ausgewählt"}`;
          return (
            <g
              key={space.id}
              data-space-id={space.id}
              data-space={space.id}
              data-selected={selected || (highlightIds?.includes(space.id) ?? false)}
              data-status={status}
              data-dimmed={dimmed}
              data-hovered={hoveredId === space.id}
              className="site-map-space"
              style={{ ["--space-color" as string]: space.color, ["--reveal-index" as string]: i, cursor: interactive || onActivate ? "pointer" : "default" }}
              {...(interactive
                ? {
                    role: "checkbox",
                    "aria-checked": selected,
                    "aria-label": label,
                    tabIndex: 0,
                    onClick: () => {
                      onToggle?.(space.id);
                      onActivate?.(space.id);
                    },
                    onKeyDown: (e: KeyboardEvent<SVGGElement>) => handleKey(e, space.id),
                    onPointerEnter: (e: React.PointerEvent) => e.pointerType === "mouse" && setHoveredId(space.id),
                    onPointerLeave: () => setHoveredId((h) => (h === space.id ? null : h)),
                    onFocus: () => setHoveredId(space.id),
                    onBlur: () => setHoveredId((h) => (h === space.id ? null : h)),
                  }
                : { "aria-hidden": true, onClick: () => onActivate?.(space.id) })}
            >
              <title>{label}</title>
              <polygon className="space-shape" points={pts} />
              <polygon className="space-hatch" points={pts} fill={`url(#hatch-${uid})`} />
              <polygon className="space-ring" points={pts} />
            </g>
          );
        })}
      </svg>

      {/* LABELS – HTML so they keep a constant, legible size at every zoom level */}
      {labelMode !== "none" && (
        <div className={cn("pointer-events-none absolute inset-0", reveal && "site-map-reveal", revealed && "is-revealed")} aria-hidden="true">
          {drawn.map((space, i) => {
            const pos = space.shape!.labelPosition;
            const selected = selectedIds.includes(space.id) || (highlightIds?.includes(space.id) ?? false);
            const status = statuses?.[space.id] ?? "unknown";
            const dimmed = highlightIds ? !highlightIds.includes(space.id) : false;
            return (
              <div
                key={space.id}
                className="site-map-label absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
                style={{ left: pct(pos.x, W), top: pct(pos.y, H), ["--reveal-index" as string]: i, opacity: dimmed ? 0.55 : undefined }}
              >
                <span
                  className={cn(
                    "relative grid place-items-center rounded-full border font-serif font-semibold shadow-[0_4px_12px_-4px_rgb(0_0_0/0.55)] transition-colors duration-200",
                    labelMode === "full" ? "h-9 min-w-9 px-1.5 text-[0.95rem]" : "h-7 min-w-7 px-1 text-[0.78rem]",
                    selected
                      ? "border-gold-light bg-gradient-to-b from-[#e0c386] to-[#b8904a] text-anthracite"
                      : "border-gold/70 bg-anthracite/90 text-paper",
                  )}
                >
                  {space.code}
                  {status !== "unknown" && (
                    <span
                      className={cn(
                        "absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full border border-white/80",
                        status === "available" && "bg-success",
                        status === "unavailable" && "bg-danger",
                        status === "partial" && "bg-warning",
                      )}
                    >
                      {status === "available" ? (
                        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
                      ) : status === "unavailable" ? (
                        <XIcon className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
                      ) : null}
                    </span>
                  )}
                </span>
                {labelMode === "full" && (
                  <span
                    className={cn(
                      "whitespace-nowrap rounded-md px-2 py-0.5 font-serif text-[0.9rem] font-semibold leading-tight shadow-[0_3px_10px_-4px_rgb(0_0_0/0.45)] transition-colors duration-200",
                      selected ? "bg-anthracite text-gold-light" : "bg-paper/92 text-ink",
                    )}
                  >
                    {space.name}
                  </span>
                )}
              </div>
            );
          })}

          {mapFeatures
            .filter((f) => f.type === "toilets" || f.type === "entrance")
            .map((f) =>
              f.type === "toilets" ? (
                <span
                  key={f.id}
                  className="absolute grid h-6 min-w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-md border border-white/50 bg-anthracite/80 px-1 text-[0.62rem] font-bold tracking-wide text-paper shadow"
                  style={{ left: pct(f.labelPosition.x, W), top: pct(f.labelPosition.y, H) }}
                  title={`${f.label} – ${f.note}`}
                >
                  WC
                </span>
              ) : (
                <span
                  key={f.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-paper/90 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-ink shadow"
                  style={{ left: pct(f.labelPosition.x, W), top: pct(f.labelPosition.y, H) }}
                >
                  ↓ {f.label}
                </span>
              ),
            )}
          {showParking &&
            mapFeatures
              .filter((f) => f.type === "parking")
              .map((f) => (
                <span
                  key={f.id}
                  className="absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-md border border-white/60 bg-[#40566e]/85 text-[0.75rem] font-bold text-white shadow"
                  style={{ left: pct(f.labelPosition.x, W), top: pct(f.labelPosition.y, H) }}
                  title="Parkplatz (nicht buchbar)"
                >
                  P
                </span>
              ))}
        </div>
      )}

      {/* Tooltip (desktop hover / keyboard focus) */}
      {interactive && hovered?.shape && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 hidden w-56 -translate-x-1/2 rounded-xl border border-white/10 bg-anthracite/95 px-4 py-3 text-left text-paper shadow-lift backdrop-blur-sm md:block"
          style={{
            left: pct(Math.min(Math.max(hovered.shape.labelPosition.x, 160), W - 160), W),
            top: pct(hovered.shape.labelPosition.y, H),
            transform:
              hovered.shape.labelPosition.y / H < 0.34
                ? "translate(-50%, 44px)"
                : "translate(-50%, calc(-100% - 34px))",
          }}
        >
          <p className="font-serif text-lg font-semibold leading-tight">{hovered.name}</p>
          <p
            className={cn(
              "mt-1 text-sm",
              (statuses?.[hovered.id] ?? "unknown") === "available" && "text-[#a9cf9f]",
              statuses?.[hovered.id] === "unavailable" && "text-[#f0a79c]",
              statuses?.[hovered.id] === "partial" && "text-gold-light",
              (statuses?.[hovered.id] ?? "unknown") === "unknown" && "text-paper/70",
            )}
          >
            {statusDetail?.[hovered.id] ??
              (statuses?.[hovered.id] === "available"
                ? "✓ Verfügbar"
                : statuses?.[hovered.id] === "unavailable"
                  ? "✕ Nicht verfügbar"
                  : "Termin wählen, um Verfügbarkeit zu sehen")}
          </p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.8rem] text-paper/70">
            <dt>Fläche</dt>
            <dd>{hovered.areaSqm !== null ? `${hovered.areaSqm} m²` : "Angabe folgt"}</dd>
            <dt>Kapazität</dt>
            <dd>
              {hovered.capacitySeated !== null || hovered.capacityStanding !== null
                ? [hovered.capacitySeated && `${hovered.capacitySeated} sitzend`, hovered.capacityStanding && `${hovered.capacityStanding} stehend`]
                    .filter(Boolean)
                    .join(" · ")
                : "Angabe folgt"}
            </dd>
          </dl>
          <p className="mt-2 border-t border-white/10 pt-2 text-[0.78rem] text-gold-light">
            {selectedIds.includes(hovered.id) ? "Anklicken zum Entfernen" : "Anklicken zum Auswählen"}
          </p>
        </div>
      )}

      {showCompass && (
        <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-center text-paper drop-shadow md:right-4 md:top-4" aria-hidden="true">
          <span className="font-serif text-xs font-semibold">N</span>
          <svg viewBox="0 0 12 28" className="h-6 w-3 md:h-8">
            <path d="M6 0 11 26 6 21 1 26z" fill="currentColor" fillOpacity="0.9" />
            <path d="M6 0v21L1 26z" fill="#b8904a" />
          </svg>
        </div>
      )}

      {children}
    </div>
  );
}
