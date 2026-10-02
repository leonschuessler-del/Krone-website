"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { tourConfig } from "@/config/tour";
import { displayFacts } from "@/content/space-estimates";
import { getFullVenueSpaceIds, isFullVenueSelection } from "@/domain/selection";
import { useAvailabilityCheck } from "@/features/availability/use-availability-check";
import { AvailabilityResult } from "@/features/booking/AvailabilityResult";
import { scheduleHasRange } from "@/features/booking/hooks";
import { SchedulePicker } from "@/features/booking/SchedulePicker";
import type { SpaceView } from "@/features/spaces/types";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { formatDateMedium, pluralize } from "@/lib/format";
import { useBookingStore, type ScheduleDraft } from "@/store/booking-store";

function scheduleLabel(s: ScheduleDraft): string | null {
  if (!s.date) return null;
  if (s.rentalMode === "daily") return s.endDate && s.endDate !== s.date ? `${formatDateMedium(s.date)} – ${formatDateMedium(s.endDate)}` : `${formatDateMedium(s.date)} · ganztägig`;
  const day = s.endDate && s.endDate !== s.date ? `${formatDateMedium(s.date)} – ${formatDateMedium(s.endDate)}` : formatDateMedium(s.date);
  return s.startTime && s.endTime ? `${day} · ${s.startTime}–${s.endTime}` : day;
}

/**
 * The room planner at the end of the scroll film: the drone photo stays on
 * screen, the areas on it are buttons and this panel holds the date, the
 * selection and the way into the booking. The data-* attributes are the
 * contract with the static preview runtime (tools/browser-demo/snapshot).
 */
export function TourPlannerPanel({ spaces, index }: { spaces: SpaceView[]; index: number }) {
  const router = useRouter();
  const selectedRaw = useBookingStore((s) => s.selectedSpaceIds);
  const schedule = useBookingStore((s) => s.schedule);
  const { toggleSpace, removeSpace, setSelection, clearSelection, setSchedule, setStep, setSubmissionMode } = useBookingStore.getState();
  const [open, setOpen] = useState(false);

  const bookable = useMemo(() => spaces.filter((s) => s.bookable && s.active), [spaces]);
  const allIds = useMemo(() => bookable.map((s) => s.id), [bookable]);
  const selected = selectedRaw.filter((id) => allIds.includes(id));
  const fullVenueIds = useMemo(() => getFullVenueSpaceIds(spaces), [spaces]);
  const fullVenue = isFullVenueSelection(selected, spaces);
  const check = useAvailabilityCheck(selected, schedule, { alternatives: 3 });
  const hasRange = scheduleHasRange(schedule);
  const allAvailable = check.data?.bookingAllowed === true && check.state !== "loading";
  const label = scheduleLabel(schedule);

  const goToBooking = (inquiry = false) => {
    setSubmissionMode(inquiry ? "inquiry" : "booking");
    setStep(hasRange ? 3 : 2);
    track("booking_started", { spaces: selected.length, fullVenue });
    router.push(`/buchen?spaces=${selected.join(",")}`);
  };
  const primary = () => (selected.length && hasRange && allAvailable ? goToBooking() : setOpen(true));

  return (
    <div
      data-tour-caption={index}
      data-tour-planner
      className="tour-planner absolute inset-x-3 bottom-3 z-10 flex max-h-[min(23rem,47svh)] flex-col overflow-hidden rounded-[1.6rem] border border-white/12 bg-[#171411]/72 text-paper shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)] backdrop-blur-xl lg:inset-x-auto lg:bottom-6 lg:right-6 lg:top-24 lg:max-h-none lg:w-[24.5rem]"
      style={{ opacity: 0, visibility: "hidden" }}
    >
      <div className="border-b border-white/10 px-5 pb-4 pt-5 lg:px-7 lg:pb-6 lg:pt-7">
        <p className="eyebrow !text-gold-light">Raumplaner</p>
        <h2 className="mt-2 text-[1.7rem] leading-tight lg:mt-3 lg:text-[2.35rem]">{tourConfig.copy.finaleTitle}</h2>
        <p className="mt-2 hidden text-[0.95rem] leading-relaxed text-paper/70 lg:block">{tourConfig.copy.finaleText}</p>
        <button
          type="button"
          data-flow
          data-flow-at="date"
          onClick={() => setOpen(true)}
          className={cn(
            "mt-3 inline-flex h-10 w-full items-center gap-2.5 rounded-full border px-4 text-left text-sm font-semibold transition-colors lg:mt-5 lg:h-11",
            label ? "border-gold/60 bg-gold/15 text-paper" : "border-white/20 bg-white/5 text-paper/90 hover:bg-white/10",
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-gold-light" />
          <span className="truncate">{label ?? "Datum wählen"}</span>
          <span className="ml-auto text-xs font-medium text-paper/50">{label ? "ändern" : "Kalender"}</span>
        </button>
      </div>

      <ul className="tour-planner-list flex min-h-0 flex-1 gap-2 overflow-x-auto px-5 py-3 lg:flex-col lg:gap-0 lg:overflow-y-auto lg:overflow-x-hidden lg:px-4 lg:py-2" aria-label="Räume">
        {bookable.map((s) => {
          const on = selected.includes(s.id);
          const facts = displayFacts(s);
          const name = s.type === "hotel" ? "Übernachtung" : s.name;
          return (
            <li key={s.id} className="shrink-0 lg:shrink">
              <div className="group flex items-center rounded-2xl transition-colors has-[[aria-pressed=true]]:lg:bg-white/10 lg:px-3 lg:py-2.5 lg:hover:bg-white/5">
                <button
                  type="button"
                  data-toggle-space={s.id}
                  aria-pressed={on}
                  onClick={() => toggleSpace(s.id, s.requires)}
                  className="tour-planner-item flex min-w-0 flex-1 items-center gap-3 text-left max-lg:h-10 max-lg:rounded-full max-lg:border max-lg:border-white/20 max-lg:bg-white/5 max-lg:pl-1 max-lg:pr-4 max-lg:aria-pressed:border-white max-lg:aria-pressed:bg-paper max-lg:aria-pressed:text-anthracite"
                >
                  <span
                    className="tour-planner-badge grid h-8 min-w-8 shrink-0 place-items-center rounded-full border border-white/30 px-1 font-serif text-[0.8rem] font-semibold text-paper/90 transition-colors"
                  >
                    <span className="tour-planner-code">{s.code}</span>
                    <Check className="tour-planner-check hidden h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate whitespace-nowrap font-serif text-[1.02rem] leading-tight lg:text-[1.1rem]">{name}</span>
                    <span className="hidden truncate text-xs text-paper/55 lg:block">
                      {facts.area}
                      {facts.seats ? ` · ${facts.seats}` : ""}
                    </span>
                  </span>
                </button>
                <Link href={s.href} className="ml-2 hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-paper/55 hover:bg-white/10 hover:text-paper lg:inline-flex" tabIndex={-1}>
                  Details
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-white/10 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:px-7 lg:pb-6 lg:pt-5">
        <p className="mb-2 text-xs text-paper/55">
          Übernachtung? <Link href="/bereiche/hotel#zimmer" className="text-gold-light underline-offset-2 hover:underline">Zimmer einzeln buchen</Link>
        </p>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span data-testid="selection-count" className="text-paper/70">
            {selected.length ? `${pluralize(selected.length, "Bereich", "Bereiche")} ausgewählt` : "Noch keine Auswahl"}
          </span>
          <button
            type="button"
            data-full-venue
            aria-pressed={fullVenue}
            onClick={() => (fullVenue ? clearSelection() : setSelection(fullVenueIds))}
            className="tour-planner-full rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-paper/85 hover:bg-white/10 aria-pressed:border-gold aria-pressed:bg-gold aria-pressed:text-anthracite"
          >
            Ganzes Haus
          </button>
        </div>
        <button
          type="button"
          data-flow
          onClick={primary}
          className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#d4b06a] to-[#b8904a] font-semibold text-anthracite shadow-[0_10px_24px_-12px_rgb(212_176_106/0.9)] transition-transform hover:-translate-y-px"
        >
          {selected.length && hasRange && allAvailable ? "Weiter zur Anfrage" : tourConfig.copy.finaleCta} <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Termin & Verfügbarkeit"
        description={
          selected.length
            ? `${pluralize(selected.length, "Bereich", "Bereiche")}: ${bookable
                .filter((s) => selected.includes(s.id))
                .map((s) => s.name)
                .join(", ")}`
            : "Wählen Sie zuerst Räume – oder prüfen Sie direkt das ganze Haus."
        }
        size="xl"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <AvailabilityResult result={check} onRemoveSpace={removeSpace} onPickAlternative={(alt) => setSchedule({ rentalMode: "hourly", ...alt })} />
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Zurück
              </Button>
              <Button
                variant="gold"
                disabled={!hasRange || !allAvailable}
                onClick={() => {
                  setOpen(false);
                  goToBooking();
                }}
              >
                Weiter zur Anfrage <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        }
      >
        {selected.length === 0 ? (
          <div className="grid place-items-center gap-4 py-10 text-center">
            <p className="text-muted">Noch keine Räume ausgewählt.</p>
            <Button variant="gold" onClick={() => setSelection(fullVenueIds)}>
              Ganzes Haus auswählen
            </Button>
          </div>
        ) : (
          <SchedulePicker spaces={spaces} selectedIds={selected} schedule={schedule} onChange={setSchedule} />
        )}
      </Dialog>
    </div>
  );
}
