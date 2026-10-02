"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { addDays, isoWeekday, monthRange, parseLocalDate, todayLocal, type LocalDate } from "@/domain/time";
import { cn } from "@/lib/cn";
import { formatDateLong } from "@/lib/format";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export interface StayCalendarProps {
  arrival: LocalDate | null;
  departure: LocalDate | null;
  /** nights where the house is full (no room of any type) */
  fullNights?: ReadonlySet<LocalDate>;
  onChange: (next: { arrival: LocalDate | null; departure: LocalDate | null }) => void;
  /** months shown side by side (1 on phones, 2 on wide screens) */
  months?: 1 | 2;
  className?: string;
}

/**
 * Arrival/departure picker like on the big booking portals: first tap sets
 * the arrival, the second the departure; tapping before the arrival starts
 * over. Full nights are struck through and cannot be inside the stay.
 */
export function StayCalendar({ arrival, departure, fullNights, onChange, months = 2, className }: StayCalendarProps) {
  const today = todayLocal();
  const start = arrival ?? today;
  const [cursor, setCursor] = useState(start.slice(0, 7));
  const [hover, setHover] = useState<LocalDate | null>(null);
  const [cy, cm] = cursor.split("-").map(Number) as [number, number];
  const canPrev = cursor > today.slice(0, 7);
  const shift = (n: number) => {
    const d = new Date(Date.UTC(cy, cm - 1 + n, 1));
    setCursor(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  const pick = (date: LocalDate) => {
    if (!arrival || departure || date <= arrival) return onChange({ arrival: date, departure: null });
    // a full night inside the stay? then start over at this date
    for (let d = arrival; d < date; d = addDays(d, 1)) if (fullNights?.has(d)) return onChange({ arrival: date, departure: null });
    onChange({ arrival, departure: date });
  };

  const previewEnd = departure ?? (arrival && hover && hover > arrival ? hover : null);

  const renderMonth = (y: number, m: number) => {
    const { from, to } = monthRange(y, m);
    const days = parseLocalDate(to).d;
    const lead = isoWeekday(from) - 1;
    const cells: React.ReactNode[] = [];
    for (let i = 0; i < lead; i++) cells.push(<span key={`e${i}`} />);
    for (let d = 1; d <= days; d++) {
      const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const past = date < today;
      const full = fullNights?.has(date) ?? false;
      const isArrival = date === arrival;
      const isDeparture = date === departure;
      const inRange = !!arrival && !!previewEnd && date > arrival && date < previewEnd;
      // the departure day itself may be a full night (guests leave in the morning)
      const disabled = past || (full && !(arrival && !departure && date > arrival));
      cells.push(
        <button
          key={date}
          type="button"
          disabled={disabled}
          onClick={() => pick(date)}
          onMouseEnter={() => setHover(date)}
          onMouseLeave={() => setHover(null)}
          aria-pressed={isArrival || isDeparture}
          aria-label={`${formatDateLong(date)}${full ? ": ausgebucht" : ""}`}
          data-date={date}
          className={cn(
            "relative aspect-square rounded-lg text-sm font-semibold tabular-nums transition-colors",
            past && "text-stone",
            !past && !full && !isArrival && !isDeparture && !inRange && "bg-white hover:ring-2 hover:ring-gold-light",
            full && !past && "text-muted line-through decoration-muted/60",
            inRange && "bg-gold-pale text-ink",
            (isArrival || isDeparture) && "bg-anthracite text-paper",
            isArrival && !isDeparture && departure && "rounded-r-none",
            isDeparture && "rounded-l-none",
          )}
        >
          {d}
        </button>,
      );
    }
    return (
      <div key={`${y}-${m}`} className="min-w-0">
        <p className="mb-2 text-center font-serif text-lg font-semibold">
          {MONTHS[m - 1]} {y}
        </p>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => (
            <span key={w} className="pb-1 text-center text-[0.7rem] font-bold text-muted">
              {w}
            </span>
          ))}
          {cells}
        </div>
      </div>
    );
  };

  const second = new Date(Date.UTC(cy, cm, 1));
  return (
    <div className={cn("rounded-2xl bg-cream p-4", className)} data-testid="stay-calendar">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} disabled={!canPrev} aria-label="Vorheriger Monat" className="grid h-9 w-9 place-items-center rounded-full bg-white disabled:opacity-30">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-xs text-muted">{!arrival ? "Anreisetag wählen" : !departure ? "Jetzt den Abreisetag wählen" : "Erneut tippen, um neu zu wählen"}</p>
        <button type="button" onClick={() => shift(1)} aria-label="Nächster Monat" className="grid h-9 w-9 place-items-center rounded-full bg-white">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className={cn("grid gap-6", months === 2 && "md:grid-cols-2")}>
        {renderMonth(cy, cm)}
        {months === 2 && <div className="hidden md:block">{renderMonth(second.getUTCFullYear(), second.getUTCMonth() + 1)}</div>}
      </div>
    </div>
  );
}
