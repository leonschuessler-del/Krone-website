"use client";

import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Clock, Layers, RefreshCw, Sun } from "lucide-react";
import { useMemo, useState } from "react";
import { addDays, isoWeekday, monthRange, parseLocalDate, todayLocal, utcToLocal, zonedToUtc } from "@/domain/time";
import type { SpaceAvailabilityStatus } from "@/domain/types";
import { useAvailabilityCheck } from "@/features/availability/use-availability-check";
import type { SpaceView } from "@/features/spaces/types";
import { cn } from "@/lib/cn";
import { formatDateLong, formatTime } from "@/lib/format";
import type { ScheduleDraft } from "@/store/booking-store";
import { useAvailabilityCalendar } from "./hooks";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Time options in 30-minute steps from 06:00 to 03:00 (next day). */
const TIME_OPTIONS = Array.from({ length: 43 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  const m = minutes % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

const DAY_STATUS_STYLE: Record<SpaceAvailabilityStatus, string> = {
  available: "bg-success-pale text-success border-success/25 hover:border-success/60",
  partially_available: "bg-warning-pale text-[#7a5410] border-warning/25 hover:border-warning/60",
  reserved: "bg-[#efe9df] text-muted border-transparent line-through decoration-muted/50",
  booked: "bg-[#efe9df] text-muted border-transparent line-through decoration-muted/50",
  blocked: "bg-[#efe9df] text-muted border-transparent line-through decoration-muted/50",
  closed: "bg-transparent text-stone border-transparent",
  unknown: "bg-white text-ink border-sand",
};

export const STATUS_TEXT_DE: Record<SpaceAvailabilityStatus, string> = {
  available: "verfügbar",
  partially_available: "teilweise frei",
  reserved: "reserviert",
  booked: "belegt",
  blocked: "gesperrt",
  closed: "nicht buchbar",
  unknown: "–",
};

interface Props {
  spaces: SpaceView[];
  selectedIds: string[];
  schedule: ScheduleDraft;
  onChange: (patch: Partial<ScheduleDraft>) => void;
  className?: string;
}

export function SchedulePicker({ spaces, selectedIds, schedule, onChange, className }: Props) {
  const today = todayLocal();
  const initial = parseLocalDate(schedule.date ?? addDays(today, 14));
  const [month, setMonth] = useState({ y: initial.y, m: initial.m });
  const [view, setView] = useState<"common" | "per-space">("common");
  const range = monthRange(month.y, month.m);
  const calendar = useAvailabilityCalendar(selectedIds, range.from, range.to);
  const dayMap = useMemo(() => new Map((calendar.data?.days ?? []).map((d) => [d.date, d])), [calendar.data]);
  const selectedSpaces = spaces.filter((s) => selectedIds.includes(s.id));

  const leading = isoWeekday(range.from) - 1;
  const daysInMonth = Number(range.to.slice(8, 10));
  const cells: Array<string | null> = [...Array(leading).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => addDays(range.from, i))];

  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(month.y, month.m - 1 + delta, 1));
    setMonth({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 });
  };
  const canGoBack = `${month.y}-${String(month.m).padStart(2, "0")}` > today.slice(0, 7);

  const pickDate = (date: string) => {
    if (schedule.rentalMode === "daily") {
      if (!schedule.date || schedule.endDate !== schedule.date || date < schedule.date) {
        onChange({ date, endDate: date });
      } else {
        onChange({ endDate: date });
      }
    } else {
      onChange({ date, endDate: null });
    }
  };

  const inRange = (date: string) =>
    schedule.rentalMode === "daily" && schedule.date && schedule.endDate && date >= schedule.date && date <= schedule.endDate;

  return (
    <div className={cn("space-y-5", className)} data-testid="schedule-picker">
      {/* Rental mode */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Mietdauer" className="inline-flex rounded-full border border-sand bg-cream/60 p-1 text-sm">
          {(
            [
              ["hourly", "Stundenweise", Clock],
              ["daily", "Ganztägig / mehrere Tage", Sun],
            ] as const
          ).map(([mode, label, Icon]) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={schedule.rentalMode === mode}
              onClick={() => onChange({ rentalMode: mode, endDate: mode === "daily" ? (schedule.date ?? null) : null })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-semibold transition-colors",
                schedule.rentalMode === mode ? "bg-ink text-paper shadow" : "text-ink-soft hover:text-ink",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        {selectedIds.length > 1 && (
          <div role="radiogroup" aria-label="Kalenderansicht" className="inline-flex rounded-full border border-sand p-1 text-xs">
            {(
              [
                ["common", "Gemeinsame Termine", CalendarDays],
                ["per-space", "Je Bereich", Layers],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold transition-colors",
                  view === v ? "bg-gold-pale text-ink" : "text-muted hover:text-ink",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
      {/* Month grid */}
      <div className="rounded-2xl border border-sand bg-white p-4 shadow-soft sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            disabled={!canGoBack}
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-cream disabled:opacity-30"
            aria-label="Vorheriger Monat"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="font-serif text-xl font-semibold" aria-live="polite">
            {MONTHS[month.m - 1]} {month.y}
          </p>
          <button type="button" onClick={() => shiftMonth(1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-cream" aria-label="Nächster Monat">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {calendar.state === "error" && !calendar.data ? (
          <div className="grid place-items-center gap-3 py-10 text-center text-sm text-muted">
            <AlertCircle className="h-6 w-6 text-danger" />
            <p>Die Verfügbarkeit konnte gerade nicht geladen werden.</p>
            <button type="button" onClick={calendar.retry} className="inline-flex items-center gap-1.5 font-semibold text-ink underline underline-offset-4">
              <RefreshCw className="h-4 w-4" /> Erneut versuchen
            </button>
          </div>
        ) : (
          <div className={cn("transition-opacity", calendar.state === "loading" && "opacity-60")} aria-busy={calendar.state === "loading"}>
            <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[0.7rem] font-semibold uppercase tracking-wider text-muted">
              {WEEKDAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((date, i) => {
                if (!date) return <span key={`e${i}`} />;
                const info = dayMap.get(date);
                const past = date < today;
                const status: SpaceAvailabilityStatus = past ? "closed" : (info?.status ?? "unknown");
                const selected = schedule.date === date || (schedule.rentalMode === "daily" && schedule.endDate === date);
                const disabled = past || status === "closed" || (selectedIds.length === 0);
                const label = `${formatDateLong(date)}: ${STATUS_TEXT_DE[status]}`;
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={disabled}
                    onClick={() => pickDate(date)}
                    aria-label={label}
                    aria-pressed={selected}
                    title={label}
                    data-date={date}
                    data-status={status}
                    className={cn(
                      "relative flex h-11 flex-col items-center justify-center rounded-xl border text-sm font-semibold transition-all duration-150 sm:h-12",
                      DAY_STATUS_STYLE[status],
                      inRange(date) && "bg-gold-pale text-ink",
                      selected && "!border-gold !bg-ink !text-paper !no-underline shadow-[0_0_0_3px_rgb(216_187_126/0.45)]",
                      disabled && "cursor-not-allowed",
                    )}
                  >
                    {Number(date.slice(8, 10))}
                    {view === "per-space" && info && selectedSpaces.length > 1 ? (
                      <span className="absolute inset-x-1.5 bottom-1 flex gap-0.5" aria-hidden>
                        {selectedSpaces.map((s) => {
                          const st = info.perSpace[s.id];
                          return (
                            <span
                              key={s.id}
                              className="h-1 flex-1 rounded-full"
                              style={{
                                background: st === "available" ? s.color : st === "partially_available" ? `color-mix(in oklab, ${s.color} 45%, #e8dfcd)` : "#cfc5b3",
                                opacity: st === "available" || st === "partially_available" ? 1 : 0.6,
                              }}
                            />
                          );
                        })}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
              <li className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-success-pale ring-1 ring-success/40" /> {selectedIds.length > 1 ? "alle frei" : "frei"}
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-warning-pale ring-1 ring-warning/40" /> teilweise frei
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-[#efe9df]" /> belegt / gesperrt
              </li>
              {view === "per-space" && <li className="flex items-center gap-1.5">Balken = je Bereich</li>}
            </ul>
          </div>
        )}
      </div>

      {schedule.date ? (
        <DayDetail spaces={selectedSpaces} selectedIds={selectedIds} schedule={schedule} onChange={onChange} perSpace />
      ) : (
        <div className="hidden h-full min-h-48 place-items-center rounded-2xl border border-dashed border-stone p-6 text-center text-sm text-muted lg:grid">
          <p>
            <CalendarDays className="mx-auto mb-2 h-6 w-6 text-gold-dark" />
            Wählen Sie links einen Tag – hier sehen Sie dann die freien Zeiten je Bereich und die gemeinsame Verfügbarkeit.
          </p>
        </div>
      )}
      </div>
    </div>
  );
}

function DayDetail({
  spaces,
  selectedIds,
  schedule,
  onChange,
  perSpace,
}: {
  spaces: SpaceView[];
  selectedIds: string[];
  schedule: ScheduleDraft;
  onChange: (patch: Partial<ScheduleDraft>) => void;
  perSpace: boolean;
}) {
  const date = schedule.date!;
  const overview = useAvailabilityCheck(selectedIds, { rentalMode: "hourly", date, endDate: null, startTime: null, endTime: null });
  const dayStart = zonedToUtc(date, 6 * 60);
  const dayEnd = zonedToUtc(date, 27 * 60);
  const span = dayEnd - dayStart;
  const pos = (iso: string) => Math.min(100, Math.max(0, ((Date.parse(iso) - dayStart) / span) * 100));

  const selStart = schedule.startTime ? zonedToUtc(date, minutesOf(schedule.startTime, 0)) : null;
  const selEnd = schedule.startTime && schedule.endTime ? zonedToUtc(date, minutesOf(schedule.endTime, minutesOf(schedule.startTime, 0))) : null;

  const common = overview.data?.commonFreeIntervals ?? [];
  const hours = [6, 9, 12, 15, 18, 21, 24, 27];

  return (
    <div className="rounded-2xl border border-sand bg-white p-4 shadow-soft sm:p-5" data-testid="day-detail">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-serif text-lg font-semibold">
          {formatDateLong(date)}
          {schedule.rentalMode === "daily" && schedule.endDate && schedule.endDate !== date && <> – {formatDateLong(schedule.endDate)}</>}
        </p>
        {overview.state === "loading" && <span className="text-xs text-muted">Verfügbarkeit wird geladen …</span>}
      </div>

      {overview.state === "error" && !overview.data ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4" /> Die Verfügbarkeit konnte gerade nicht geladen werden.
          <button type="button" className="font-semibold underline" onClick={overview.retry}>
            Erneut versuchen
          </button>
        </p>
      ) : (
        <>
          {/* Timeline */}
          <div className="mt-4 space-y-1.5" aria-hidden="true">
            <div className="relative ml-[7.5rem] h-4 text-[0.65rem] text-muted">
              {hours.map((h) => (
                <span key={h} className="absolute -translate-x-1/2" style={{ left: `${((h - 6) / 21) * 100}%` }}>
                  {String(h % 24).padStart(2, "0")}
                </span>
              ))}
            </div>
            {(perSpace ? spaces : []).map((s) => {
              const r = overview.data?.spaces.find((x) => x.spaceId === s.id);
              return (
                <TimelineRow key={s.id} label={s.name} color={s.color}>
                  {(r?.freeIntervals ?? []).map((f, i) => (
                    <span key={i} className="absolute inset-y-0 rounded-sm" style={{ left: `${pos(f.start)}%`, width: `${pos(f.end) - pos(f.start)}%`, background: s.color, opacity: 0.75 }} />
                  ))}
                </TimelineRow>
              );
            })}
            <TimelineRow label={selectedIds.length > 1 ? "Gemeinsam frei" : "Frei"} color="#b8904a" strong>
              {common.map((f, i) => (
                <span
                  key={i}
                  className="absolute inset-y-0 rounded-sm bg-gradient-to-b from-[#dcbf82] to-[#b8904a]"
                  style={{ left: `${pos(f.start)}%`, width: `${pos(f.end) - pos(f.start)}%` }}
                />
              ))}
              {selStart && selEnd && (
                <span
                  className="absolute -inset-y-1 rounded border-2 border-ink/80"
                  style={{ left: `${pos(new Date(selStart).toISOString())}%`, width: `${pos(new Date(selEnd).toISOString()) - pos(new Date(selStart).toISOString())}%` }}
                />
              )}
            </TimelineRow>
          </div>

          <div className="mt-4">
            {common.length > 0 ? (
              <p className="text-sm text-ink-soft">
                <span className="font-semibold text-ink">{selectedIds.length > 1 ? "Gemeinsam verfügbar:" : "Verfügbar:"}</span>{" "}
                {common.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      onChange({ rentalMode: "hourly", startTime: utcToLocal(Date.parse(c.start)).time, endTime: utcToLocal(Date.parse(c.end)).time })
                    }
                    className="mr-2 mt-1 inline-flex items-center rounded-full border border-gold/40 bg-gold-pale/60 px-2.5 py-0.5 font-semibold text-ink transition-colors hover:border-gold"
                    title="Diesen Zeitraum übernehmen"
                  >
                    {formatTime(Date.parse(c.start))}–{formatTime(Date.parse(c.end))} Uhr
                  </button>
                ))}
              </p>
            ) : overview.data ? (
              <p className="text-sm text-danger">An diesem Tag gibt es keine gemeinsame freie Zeit für Ihre Auswahl.</p>
            ) : null}
          </div>
        </>
      )}

      {schedule.rentalMode === "hourly" ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
          <label className="block">
            <span className="field-label">Beginn</span>
            <select
              className="field-input"
              value={schedule.startTime ?? ""}
              onChange={(e) => onChange({ startTime: e.target.value || null })}
              data-testid="start-time"
            >
              <option value="">– wählen –</option>
              {TIME_OPTIONS.slice(0, 36).map((t) => (
                <option key={t} value={t}>
                  {t} Uhr
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">Ende</span>
            <select
              className="field-input"
              value={schedule.endTime ?? ""}
              onChange={(e) => onChange({ endTime: e.target.value || null })}
              data-testid="end-time"
            >
              <option value="">– wählen –</option>
              {TIME_OPTIONS.slice(1).map((t) => (
                <option key={t} value={t}>
                  {t} Uhr{schedule.startTime && t <= schedule.startTime ? " (Folgetag)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">
          Tagesbuchung: Klicken Sie im Kalender auf das Enddatum, um mehrere Tage zu wählen. Gebucht wird jeweils ab Öffnung des ersten bis zum
          Ende des letzten Tages.
        </p>
      )}
    </div>
  );
}

function TimelineRow({ label, color, strong, children }: { label: string; color: string; strong?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("flex w-[7rem] shrink-0 items-center gap-1.5 truncate text-xs", strong ? "font-semibold text-ink" : "text-ink-soft")}>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span
        className="relative h-3.5 flex-1 rounded-sm"
        style={{ background: "repeating-linear-gradient(135deg, #efe9df 0 5px, #e3dacb 5px 7px)" }}
      >
        {children}
      </span>
    </div>
  );
}

/** Minutes for a HH:mm value; values <= reference are treated as next day. */
function minutesOf(time: string, reference: number): number {
  const [h, m] = time.split(":").map(Number);
  let v = h! * 60 + m!;
  if (v < 6 * 60) v += 1440; // early morning belongs to the evening before
  if (reference && v <= reference) v += 1440;
  return v;
}
