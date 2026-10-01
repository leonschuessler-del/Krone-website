"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Check, ChevronUp, List, Map as MapIcon, Maximize2, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SpaceImage } from "@/components/media/SpaceImage";
import { siteConfig } from "@/config/site";
import { getFullVenueSpaceIds, isFullVenueSelection } from "@/domain/selection";
import type { AvailabilityCheckResponse } from "@/features/availability/api-types";
import { useAvailabilityCheck } from "@/features/availability/use-availability-check";
import { AvailabilityResult } from "@/features/booking/AvailabilityResult";
import { scheduleHasRange, usePriceQuote } from "@/features/booking/hooks";
import { SchedulePicker } from "@/features/booking/SchedulePicker";
import type { MapSpaceStatus, SpaceView } from "@/features/spaces/types";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { displayFacts } from "@/content/space-estimates";
import { formatDateMedium, formatMoney, formatTime, pluralize } from "@/lib/format";
import { useBookingStore, type ScheduleDraft } from "@/store/booking-store";
import { SiteMap } from "./SiteMap";

function scheduleLabel(s: ScheduleDraft): string | null {
  if (!s.date) return null;
  if (s.rentalMode === "daily") {
    return s.endDate && s.endDate !== s.date ? `${formatDateMedium(s.date)} – ${formatDateMedium(s.endDate)}` : `${formatDateMedium(s.date)} · ganztägig`;
  }
  return s.startTime && s.endTime ? `${formatDateMedium(s.date)} · ${s.startTime}–${s.endTime} Uhr` : formatDateMedium(s.date);
}

function deriveMapStatus(data: AvailabilityCheckResponse | null): { statuses: Record<string, MapSpaceStatus>; detail: Record<string, string> } {
  const statuses: Record<string, MapSpaceStatus> = {};
  const detail: Record<string, string> = {};
  if (!data) return { statuses, detail };
  const range =
    data.requested.start && data.requested.end
      ? `${formatTime(Date.parse(data.requested.start))}–${formatTime(Date.parse(data.requested.end))}`
      : null;
  for (const s of data.spaces) {
    if (data.requested.hasTimeRange) {
      statuses[s.spaceId] = s.available ? "available" : "unavailable";
      detail[s.spaceId] = s.available
        ? `✓ ${data.requested.rentalMode === "daily" ? "im gewählten Zeitraum" : range} verfügbar`
        : `✕ ${data.requested.rentalMode === "daily" ? "im gewählten Zeitraum" : range} ${s.status === "closed" ? "nicht buchbar" : "belegt"}`;
    } else {
      statuses[s.spaceId] = s.status === "available" ? "available" : s.status === "partially_available" ? "partial" : "unavailable";
      detail[s.spaceId] =
        s.status === "available"
          ? "✓ ganztägig frei"
          : s.status === "partially_available"
            ? `◐ frei: ${s.freeIntervals.map((i) => `${formatTime(Date.parse(i.start))}–${formatTime(Date.parse(i.end))}`).join(", ")}`
            : "✕ an diesem Tag nicht verfügbar";
    }
  }
  return { statuses, detail };
}

export function MapConfigurator({ spaces, demo }: { spaces: SpaceView[]; demo: boolean }) {
  const router = useRouter();
  const selectedRaw = useBookingStore((s) => s.selectedSpaceIds);
  const schedule = useBookingStore((s) => s.schedule);
  const previewId = useBookingStore((s) => s.previewSpaceId);
  const { toggleSpace, removeSpace, setSelection, clearSelection, setPreview, setSchedule, setStep } = useBookingStore.getState();

  const bookable = useMemo(() => spaces.filter((s) => s.bookable && s.active), [spaces]);
  const allIds = useMemo(() => bookable.map((s) => s.id), [bookable]);
  const selected = selectedRaw.filter((id) => allIds.includes(id));
  const fullVenueIds = useMemo(() => getFullVenueSpaceIds(spaces), [spaces]);
  const fullVenueSelected = isFullVenueSelection(selected, spaces);
  const hotel = useMemo(() => spaces.find((s) => s.type === "hotel" && s.bookable && s.active) ?? null, [spaces]);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [view, setView] = useState<"map" | "list">("map");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [sectionVisible, setSectionVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  const mapCheck = useAvailabilityCheck(allIds, schedule);
  const selectionCheck = useAvailabilityCheck(selected, schedule, { alternatives: 3 });
  const quote = usePriceQuote(selected, schedule, { enabled: selectionCheck.data?.bookingAllowed ?? false });
  const { statuses, detail } = useMemo(() => deriveMapStatus(mapCheck.data), [mapCheck.data]);

  useEffect(() => {
    if (mapCheck.state === "ready") track("availability_checked", { spaces: allIds.length, date: schedule.date });
  }, [mapCheck.state, allIds.length, schedule.date]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => setSectionVisible(entries.some((e) => e.isIntersecting)), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const preview = previewId ? spaces.find((s) => s.id === previewId) : undefined;
  const label = scheduleLabel(schedule);
  const hasRange = scheduleHasRange(schedule);
  const allAvailable = selectionCheck.data?.bookingAllowed === true && selectionCheck.state !== "loading";

  const goToBooking = (inquiry = false) => {
    useBookingStore.getState().setSubmissionMode(inquiry ? "inquiry" : "booking");
    setStep(hasRange ? 3 : 2);
    track("booking_started", { spaces: selected.length, fullVenue: fullVenueSelected });
    router.push(`/buchen?spaces=${selected.join(",")}`);
  };

  const primaryCta = () => {
    if (selected.length === 0) return;
    if (!hasRange) {
      setScheduleOpen(true);
      return;
    }
    goToBooking();
  };

  const panel = (
    <SelectionPanelContent
      spaces={spaces}
      selected={selected}
      scheduleText={label}
      hasDate={Boolean(schedule.date)}
      hasRange={hasRange}
      selectionCheck={selectionCheck}
      quote={quote}
      demo={demo}
      fullVenueSelected={fullVenueSelected}
      onRemove={removeSpace}
      onOpenSchedule={() => setScheduleOpen(true)}
      onPickAlternative={(alt) => setSchedule({ rentalMode: "hourly", date: alt.date, startTime: alt.startTime, endTime: alt.endTime })}
      onFullVenue={() => {
        setSelection(fullVenueIds);
        track("space_selected", { fullVenue: true });
      }}
      onPrimary={primaryCta}
      onInquiry={() => goToBooking(true)}
      allAvailable={allAvailable}
    />
  );

  return (
    <div ref={sectionRef} className="relative" data-testid="map-configurator">
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden font-serif text-lg text-ink-soft sm:inline">{siteConfig.mapSection.dateQuestion}</span>
          <button
            type="button"
            onClick={() => setScheduleOpen(true)}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
              label ? "border-gold bg-gold-pale/60 text-ink" : "border-ink/20 bg-white text-ink hover:border-ink/40",
            )}
            data-testid="open-schedule"
          >
            <CalendarDays className="h-4 w-4 text-gold-dark" />
            {label ?? "Datum auswählen"}
          </button>
          {label && (
            <button
              type="button"
              onClick={() => setSchedule({ date: null, endDate: null, startTime: null, endTime: null })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink"
            >
              <X className="h-3.5 w-3.5" /> Termin zurücksetzen
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={fullVenueSelected ? "primary" : "secondary"}
            size="sm"
            onClick={() => (fullVenueSelected ? clearSelection() : setSelection(fullVenueIds))}
            aria-pressed={fullVenueSelected}
            data-testid="full-venue"
          >
            {fullVenueSelected ? <Check className="h-4 w-4" /> : null}
            Gesamte Location
          </Button>
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <RotateCcw className="h-4 w-4" /> Zurücksetzen
            </Button>
          )}
          <div role="radiogroup" aria-label="Ansicht" className="inline-flex rounded-full border border-sand bg-white p-1">
            {(
              [
                ["map", "Karte", MapIcon],
                ["list", "Liste", List],
              ] as const
            ).map(([v, text, Icon]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  view === v ? "bg-ink text-paper" : "text-ink-soft hover:text-ink",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {text}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)] xl:gap-8">
        {/* Map / list */}
        <div className="min-w-0">
          {view === "map" ? (
            <div className="relative">
              <div className={cn("-mx-5 overflow-x-auto sm:mx-0", zoomed && "touch-pan-x")}>
                <div className={cn("transition-[width] duration-300", zoomed ? "w-[190%] sm:w-full" : "w-full")}>
                  <SiteMapWithStatus
                    spaces={spaces}
                    selected={selected}
                    statuses={statuses}
                    detail={detail}
                    onToggle={toggleSpace}
                    onActivate={(id) => {
                      setPreview(id);
                      track("space_viewed", { spaceId: id, source: "map" });
                    }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setZoomed((z) => !z)}
                className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-paper/90 px-3 py-1.5 text-xs font-semibold shadow sm:hidden"
                aria-pressed={zoomed}
              >
                <Maximize2 className="h-3.5 w-3.5" /> {zoomed ? "Übersicht" : "Vergrößern"}
              </button>
              {mapCheck.state === "loading" && (
                <span className="absolute left-3 top-3 rounded-full bg-anthracite/80 px-3 py-1 text-xs font-semibold text-paper">Verfügbarkeit wird aktualisiert …</span>
              )}
              {mapCheck.state === "error" && (
                <button
                  type="button"
                  onClick={mapCheck.retry}
                  className="absolute left-3 top-3 rounded-full bg-danger px-3 py-1 text-xs font-semibold text-white"
                >
                  Verfügbarkeit nicht geladen – erneut versuchen
                </button>
              )}
              {preview && <SpacePreviewCard space={preview} selected={selected.includes(preview.id)} statusText={detail[preview.id]} onToggle={() => toggleSpace(preview.id)} onClose={() => setPreview(null)} />}
            </div>
          ) : (
            <SpaceList spaces={spaces} selected={selected} statuses={statuses} detail={detail} onToggle={toggleSpace} />
          )}
          <MapLegend spaces={spaces} selected={selected} onToggle={toggleSpace} hasStatus={Boolean(schedule.date)} />
          {hotel && <HotelCard hotel={hotel} selected={selected.includes(hotel.id)} status={statuses[hotel.id]} onToggle={() => toggleSpace(hotel.id)} />}
        </div>

        {/* Selection panel – desktop */}
        <aside className="hidden lg:block" aria-label="Ihre Auswahl">
          <div className="panel-dark sticky top-24 rounded-[1.5rem] p-6 shadow-lift">{panel}</div>
        </aside>
      </div>

      {/* Mobile sticky bottom CTA + sheet */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-anthracite/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-paper backdrop-blur transition-transform duration-300 lg:hidden",
          sectionVisible ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setSheetOpen(true)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={sheetOpen}>
            <ChevronUp className="h-4 w-4 shrink-0 text-gold-light" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {selected.length ? pluralize(selected.length, "Bereich", "Bereiche") + " ausgewählt" : "Noch nichts ausgewählt"}
              </span>
              <span className="block truncate text-xs text-paper/60">{label ?? "Tippen Sie auf die Karte"}</span>
            </span>
          </button>
          <Button variant="gold" size="sm" onClick={selected.length ? primaryCta : () => setSheetOpen(true)} disabled={selected.length === 0}>
            {hasRange && allAvailable ? "Weiter" : "Verfügbarkeit prüfen"}
          </Button>
        </div>
      </div>
      <Dialog open={sheetOpen} onClose={() => setSheetOpen(false)} title="Ihre Auswahl" size="md" tone="dark" className="lg:hidden">
        {panel}
      </Dialog>

      <Dialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title="Termin & Verfügbarkeit"
        description={
          selected.length
            ? `${pluralize(selected.length, "Bereich", "Bereiche")}: ${spaces
                .filter((s) => selected.includes(s.id))
                .map((s) => s.name)
                .join(", ")}`
            : "Wählen Sie zuerst Bereiche – oder prüfen Sie direkt die gesamte Location."
        }
        size="xl"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <AvailabilityResult
                result={selectionCheck}
                onRemoveSpace={removeSpace}
                onPickAlternative={(alt) => setSchedule({ rentalMode: "hourly", ...alt })}
              />
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" onClick={() => setScheduleOpen(false)}>
                Zur Karte
              </Button>
              <Button
                variant="gold"
                disabled={!hasRange || !allAvailable}
                onClick={() => {
                  setScheduleOpen(false);
                  goToBooking();
                }}
                data-testid="schedule-continue"
              >
                Weiter zur Buchung <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        }
      >
        {selected.length === 0 ? (
          <div className="grid place-items-center gap-4 py-10 text-center">
            <p className="text-muted">Noch keine Bereiche ausgewählt.</p>
            <Button variant="gold" onClick={() => setSelection(fullVenueIds)}>
              Gesamte Location auswählen
            </Button>
          </div>
        ) : (
          <SchedulePicker spaces={spaces} selectedIds={selected} schedule={schedule} onChange={setSchedule} />
        )}
      </Dialog>


    </div>
  );
}

// ---------------------------------------------------------------------------

function SiteMapWithStatus({
  spaces,
  selected,
  statuses,
  detail,
  onToggle,
  onActivate,
}: {
  spaces: SpaceView[];
  selected: string[];
  statuses: Record<string, MapSpaceStatus>;
  detail: Record<string, string>;
  onToggle: (id: string) => void;
  onActivate: (id: string) => void;
}) {
  return (
    <SiteMap
      spaces={spaces.filter((s) => s.bookable)}
      selectedIds={selected}
      statuses={statuses}
      statusDetail={detail}
      onToggle={onToggle}
      onActivate={onActivate}
      reveal
      className="overflow-hidden rounded-[1.5rem] shadow-lift ring-1 ring-black/5"
    />
  );
}

function SpacePreviewCard({
  space,
  selected,
  statusText,
  onToggle,
  onClose,
}: {
  space: SpaceView;
  selected: boolean;
  statusText?: string;
  onToggle: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="relative z-10 mt-3 w-full animate-[fade-up_0.3s_var(--ease-out-soft)] overflow-hidden rounded-2xl border border-sand bg-white shadow-lift sm:absolute sm:bottom-4 sm:left-4 sm:mt-0 sm:w-[19rem]"
      role="region"
      aria-label={`Vorschau ${space.name}`}
      data-testid="space-preview"
    >
      <div className="relative h-32">
        <SpaceImage space={space} sizes="320px" placeholderSize="sm" />
        {space.media.hero && !space.media.hero.isReal && (
          <span className="absolute left-2 top-2 rounded-full bg-anthracite/75 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-paper">Beispielbild</span>
        )}
        <button type="button" onClick={onClose} aria-label="Vorschau schließen" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-paper/90 shadow">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-7 min-w-7 place-items-center rounded-full px-1 font-serif text-sm font-semibold text-white" style={{ background: space.color }}>
            {space.code}
          </span>
          <h3 className="font-serif text-xl">{space.name}</h3>
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{space.shortDescription}</p>
        {statusText && <p className="mt-1.5 text-sm font-semibold">{statusText}</p>}
        <div className="mt-3 flex gap-2">
          <Link href={space.href} className="inline-flex h-9 flex-1 items-center justify-center rounded-full border border-ink/20 text-sm font-semibold hover:border-ink/50">
            Details ansehen
          </Link>
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-full text-sm font-semibold transition-colors",
              selected ? "bg-ink text-paper" : "bg-gold text-anthracite hover:bg-gold-light",
            )}
          >
            {selected ? (
              <>
                <Check className="h-4 w-4" /> Ausgewählt
              </>
            ) : (
              "Auswählen"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function MapLegend({ spaces, selected, onToggle, hasStatus }: { spaces: SpaceView[]; selected: string[]; onToggle: (id: string) => void; hasStatus: boolean }) {
  const onMap = spaces.filter((s) => s.shape && s.bookable);
  const notDrawn = spaces.filter((s) => !s.shape);
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-sand bg-white/70 p-4 text-sm md:flex-row md:items-start md:justify-between">
      <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Legende Bereiche">
        {onMap.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => onToggle(s.id)} aria-pressed={selected.includes(s.id)} className="inline-flex items-center gap-1.5 hover:text-ink">
              <span
                className={cn("h-3 w-3 rounded-sm border transition-colors", selected.includes(s.id) ? "border-white bg-[#d9d3c8] shadow-[0_0_0_1px_rgb(0_0_0/0.35)]" : "border-ink/30 bg-transparent")}
              />
              <span className="font-semibold">{s.code}</span> <span className="text-ink-soft">{s.name}</span>
            </button>
          </li>
        ))}
        {notDrawn.map((s) => (
          <li key={s.id} className="inline-flex items-center gap-1.5 text-muted">
            <span className="h-3 w-3 rounded-sm border border-dashed border-taupe" />
            <Link href={s.href} className="underline-offset-4 hover:underline">
              {s.type === "hotel" ? "Übernachtung im Hotel (1. OG) – unter der Karte hinzufügen" : `${s.name} – genaue Abgrenzung folgt`}
            </Link>
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5 text-muted">
          <span className="grid h-4 min-w-4 place-items-center rounded bg-anthracite/80 px-0.5 text-[0.55rem] font-bold text-white">WC</span> Toiletten – bei jeder Buchung inklusive
        </li>
      </ul>
      <ul className="flex shrink-0 flex-wrap gap-x-4 gap-y-2 text-xs text-muted" aria-label="Legende Status">
        <li className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border-2 border-white bg-[#d9d3c8] shadow-[0_0_0_1px_rgb(0_0_0/0.25)]" /> Ausgewählt
        </li>
        {hasStatus && (
          <>
            <li className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-success" /> Verfügbar
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-warning" /> Teilweise
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-danger" /> Nicht verfügbar
            </li>
          </>
        )}
      </ul>
    </div>
  );
}

function SpaceList({
  spaces,
  selected,
  statuses,
  detail,
  onToggle,
}: {
  spaces: SpaceView[];
  selected: string[];
  statuses: Record<string, MapSpaceStatus>;
  detail: Record<string, string>;
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-sand overflow-hidden rounded-[1.5rem] border border-sand bg-white shadow-soft" aria-label="Bereiche als Liste">
      {spaces
        .filter((s) => s.bookable)
        .map((s) => {
          const isSel = selected.includes(s.id);
          const st = statuses[s.id];
          return (
            <li key={s.id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
              <label className="flex flex-1 cursor-pointer items-center gap-3">
                <input type="checkbox" className="h-5 w-5 accent-[#b8904a]" checked={isSel} onChange={() => onToggle(s.id)} aria-describedby={`st-${s.id}`} />
                <span className="grid h-8 min-w-8 place-items-center rounded-full px-1 font-serif text-sm font-semibold text-white" style={{ background: s.color }}>
                  {s.code}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{s.name}</span>
                  <span id={`st-${s.id}`} className="block text-xs text-muted">
                    {detail[s.id] ?? "Datum wählen für Verfügbarkeit"} · {displayFacts(s).area} · {displayFacts(s).seats}
                  </span>
                </span>
              </label>
              <span
                className={cn(
                  "hidden h-2.5 w-2.5 shrink-0 rounded-full sm:block",
                  st === "available" && "bg-success",
                  st === "partial" && "bg-warning",
                  st === "unavailable" && "bg-danger",
                  !st && "bg-stone",
                )}
                aria-hidden
              />
              <Link href={s.href} className="shrink-0 text-sm font-semibold text-gold-dark underline-offset-4 hover:underline">
                Details
              </Link>
            </li>
          );
        })}
    </ul>
  );
}

function SelectionPanelContent({
  spaces,
  selected,
  scheduleText,
  hasDate,
  hasRange,
  selectionCheck,
  quote,
  demo,
  fullVenueSelected,
  allAvailable,
  onRemove,
  onOpenSchedule,
  onPickAlternative,
  onFullVenue,
  onPrimary,
  onInquiry,
}: {
  spaces: SpaceView[];
  selected: string[];
  scheduleText: string | null;
  hasDate: boolean;
  hasRange: boolean;
  selectionCheck: ReturnType<typeof useAvailabilityCheck>;
  quote: ReturnType<typeof usePriceQuote>;
  demo: boolean;
  fullVenueSelected: boolean;
  allAvailable: boolean;
  onRemove: (id: string) => void;
  onOpenSchedule: () => void;
  onPickAlternative: (alt: { date: string; startTime: string; endTime: string }) => void;
  onFullVenue: () => void;
  onPrimary: () => void;
  onInquiry: () => void;
}) {
  const selectedSpaces = spaces.filter((s) => selected.includes(s.id));
  const q = quote.data;
  const inquiryOnly = q ? q.bookingMode === "inquiry" : false;

  return (
    <div data-testid="selection-panel">
      <p className="eyebrow !text-gold-light">Ihre Auswahl</p>
      <p className="mt-1 font-serif text-2xl" aria-live="polite" data-testid="selection-count">
        {selected.length ? `${pluralize(selected.length, "Bereich", "Bereiche")} ausgewählt` : "Noch keine Auswahl"}
      </p>
      {fullVenueSelected && <p className="mt-1 text-sm text-gold-light">Gesamte Location</p>}

      {selected.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-paper/70">
          Klicken Sie auf der Karte auf einen oder mehrere Bereiche – oder wählen Sie die gesamte Location.
        </p>
      ) : (
        <ul className="mt-4 space-y-1.5" data-testid="selected-list">
          {selectedSpaces.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
              <span className="grid h-7 min-w-7 place-items-center rounded-full px-1 font-serif text-[0.8rem] font-semibold text-white" style={{ background: s.color }}>
                {s.code}
              </span>
              <span className="flex-1 font-semibold">{s.name}</span>
              <Link href={s.href} className="text-xs text-paper/60 underline-offset-4 hover:text-paper hover:underline">
                Details
              </Link>
              <button type="button" onClick={() => onRemove(s.id)} aria-label={`${s.name} entfernen`} className="grid h-7 w-7 place-items-center rounded-full text-paper/60 hover:bg-white/10 hover:text-paper">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-5 space-y-3 border-t border-white/10 pt-4 text-sm">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-paper/60">Termin</dt>
          <dd className="text-right">
            {scheduleText ? (
              <button type="button" onClick={onOpenSchedule} className="font-semibold underline-offset-4 hover:underline">
                {scheduleText}
              </button>
            ) : (
              <button type="button" onClick={onOpenSchedule} className="font-semibold text-gold-light underline-offset-4 hover:underline">
                Datum wählen
              </button>
            )}
          </dd>
        </div>
        <div>
          <dt className="mb-1.5 text-paper/60">Verfügbarkeit</dt>
          <dd>
            {!hasDate || selected.length === 0 ? (
              <span className="text-paper/70">{selected.length ? "Termin wählen, um die Verfügbarkeit zu prüfen" : "–"}</span>
            ) : (
              <AvailabilityResult result={selectionCheck} tone="dark" onRemoveSpace={onRemove} onPickAlternative={onPickAlternative} onChooseOtherDate={onOpenSchedule} />
            )}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-paper/60">Preis</dt>
          <dd className="text-right" data-testid="panel-price">
            {!hasRange || selected.length === 0 ? (
              <span className="text-paper/70">wird berechnet</span>
            ) : quote.state === "loading" && !q ? (
              <span className="text-paper/70">wird berechnet …</span>
            ) : q ? (
              <span>
                <span className="font-serif text-xl font-semibold">{formatMoney(q.total, inquiryOnly ? "auf Anfrage" : "Preis folgt")}</span>
                {q.total !== null && <span className="block text-xs text-paper/60">Mietsumme inkl. Reinigung{q.deposit ? ` · zzgl. ${formatMoney(q.deposit)} Kaution` : ""}</span>}
                {(demo || q.isDemo) && q.total !== null && <span className="mt-0.5 block text-[0.7rem] uppercase tracking-wider text-gold-light">Demo-Preis – unverbindlich</span>}
              </span>
            ) : (
              <span className="text-paper/70">{quote.state === "error" ? "Preis konnte nicht berechnet werden" : "–"}</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-5 space-y-2.5">
        <Button variant="gold" size="lg" className="w-full" disabled={selected.length === 0 || (hasRange && !allAvailable && selectionCheck.state !== "loading")} onClick={onPrimary} data-testid="panel-primary">
          {!hasDate || !hasRange ? "Gemeinsame Verfügbarkeit prüfen" : inquiryOnly ? "Weiter zur Anfrage" : "Weiter zur Buchung"}
          <ArrowRight className="h-4 w-4" />
        </Button>
        {hasRange && allAvailable && inquiryOnly && (
          <p className="text-xs text-paper/60">Diese Kombination wird individuell kalkuliert – Sie senden eine unverbindliche Anfrage.</p>
        )}
        {!fullVenueSelected && (
          <Button variant="dark" className="w-full" onClick={onFullVenue}>
            Gesamte Location auswählen
          </Button>
        )}
        {selected.length > 0 && !inquiryOnly && (
          <button type="button" onClick={onInquiry} className="w-full text-center text-xs font-semibold text-paper/60 underline-offset-4 hover:text-paper hover:underline">
            Lieber unverbindlich anfragen
          </button>
        )}
      </div>
    </div>
  );
}

/** The upper floor is rented as a whole – shown as its own button next to the map. */
/** Overnight stay: the whole upper floor, booked as one add-on for the guests of the event. */
function HotelCard({ hotel, selected, status, onToggle }: { hotel: SpaceView; selected: boolean; status?: MapSpaceStatus; onToggle: () => void }) {
  const thumbs = hotel.media.gallery.slice(0, 3);
  return (
    <div
      className={cn(
        "mt-5 grid overflow-hidden rounded-[1.25rem] bg-anthracite text-paper shadow-soft transition-shadow md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]",
        selected && "ring-2 ring-paper/70",
      )}
      data-testid="hotel-card"
    >
      <div className="relative min-h-52">
        <SpaceImage space={hotel} className="absolute inset-0" sizes="(min-width: 768px) 40vw, 100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-anthracite/70 via-transparent to-transparent" />
        {thumbs.length > 0 && (
          <div className="absolute inset-x-3 bottom-3 flex gap-2" aria-hidden="true">
            {thumbs.map((t) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={t.src} src={t.src} alt="" className="h-12 w-16 rounded-md border border-white/40 object-cover shadow" loading="lazy" />
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-4 p-5 md:p-6">
        <div>
          <p className="eyebrow !text-gold-light">Übernachten im Haus · 1. Obergeschoss</p>
          <h3 className="mt-2 text-2xl md:text-[1.7rem]">Ihre Gäste schlafen direkt über der Feier</h3>
          <p className="mt-2 text-sm leading-relaxed text-paper/75">
            Das Landhotel gehört während Ihres Fests ganz Ihrer Gesellschaft – kein Heimweg, keine Fremden auf dem Flur.
          </p>
        </div>
        <ul className="flex flex-wrap gap-2 text-[0.8rem] font-semibold" aria-label="Ausstattung Hotel">
          <li className="rounded-full border border-white/20 px-3 py-1">10 Zimmer</li>
          <li className="rounded-full border border-white/20 px-3 py-1">1 Wohnung mit Küche</li>
          <li className="rounded-full border border-white/20 px-3 py-1">Zimmer mit eigenem Bad</li>
        </ul>
        {status && status !== "unknown" && (
          <p className={cn("text-sm font-semibold", status === "available" ? "text-[#a9cf9f]" : status === "unavailable" ? "text-[#f0a79c]" : "text-gold-light")}>
            {status === "available" ? "✓ Im gewählten Zeitraum frei" : status === "unavailable" ? "Im gewählten Zeitraum belegt" : "Teilweise frei"}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <Button variant={selected ? "light" : "gold"} size="sm" onClick={onToggle} aria-pressed={selected} data-testid="hotel-toggle">
            {selected ? <Check className="h-4 w-4" /> : null}
            {selected ? "Übernachtung ist dabei" : "Übernachtung hinzufügen"}
          </Button>
          <Link href={hotel.href} className="inline-flex h-9 items-center rounded-full border border-white/25 px-4 text-sm font-semibold hover:border-white/60">
            Zimmer ansehen
          </Link>
          <span className="w-full text-xs text-paper/55">Exklusiv für Ihre Gesellschaft · Preis auf Anfrage</span>
        </div>
      </div>
    </div>
  );
}
