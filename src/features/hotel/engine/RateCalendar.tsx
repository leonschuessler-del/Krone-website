"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { addDays, isoWeekday, monthRange, parseLocalDate, todayLocal, type LocalDate } from "@/domain/time";
import { cn } from "@/lib/cn";
import { formatDateLong } from "@/lib/format";

const WEEKDAYS = ["M", "D", "M", "D", "F", "S", "S"];
const WEEKDAYS_LONG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export interface RateCalendarProps {
  arrival: LocalDate | null;
  departure: LocalDate | null;
  onChange: (next: { arrival: LocalDate | null; departure: LocalDate | null }) => void;
  /** best available price for the night starting that day, null = no price / full */
  priceFor: (night: LocalDate) => number | null;
  /** nights where the whole house is full */
  fullNights: ReadonlySet<LocalDate>;
  months?: 1 | 2;
  className?: string;
}

/**
 * Two months side by side with the best available price under every day –
 * the calendar of the big booking engines. First tap = arrival, second tap =
 * departure; tapping before the arrival starts over.
 */
export function RateCalendar({ arrival, departure, onChange, priceFor, fullNights, months = 2, className }: RateCalendarProps) {
  const today = todayLocal();
  const [cursor, setCursor] = useState((arrival ?? today).slice(0, 7));
  const [hover, setHover] = useState<LocalDate | null>(null);
  const [cy, cm] = cursor.split("-").map(Number) as [number, number];
  const canPrev = cursor > today.slice(0, 7);
  const shift = (n: number) => {
    const d = new Date(Date.UTC(cy, cm - 1 + n, 1));
    setCursor(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  const pick = (date: LocalDate) => {
    if (!arrival || departure || date <= arrival) return onChange({ arrival: date, departure: null });
    for (let d = arrival; d < date; d = addDays(d, 1)) if (fullNights.has(d)) return onChange({ arrival: date, departure: null });
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
      const full = fullNights.has(date);
      const isArrival = date === arrival;
      const isDeparture = date === departure;
      const inRange = !!arrival && !!previewEnd && date > arrival && date < previewEnd;
      const departureOnly = full && !!arrival && !departure && date > arrival; // leaving on a full night is fine
      const disabled = past || (full && !departureOnly);
      const price = past || full ? null : priceFor(date);
      cells.push(
        <button
          key={date}
          type="button"
          disabled={disabled}
          onClick={() => pick(date)}
          onMouseEnter={() => setHover(date)}
          onMouseLeave={() => setHover(null)}
          aria-pressed={isArrival || isDeparture}
          aria-label={`${formatDateLong(date)}${full ? ": ausgebucht" : price !== null ? `, ab ${Math.round(price / 100)} Euro` : ""}`}
          data-date={date}
          className={cn(
            "relative flex h-[3.4rem] flex-col items-center justify-center gap-0.5 rounded-none text-[0.95rem] tabular-nums transition-colors",
            past && "text-stone/70",
            !past && !full && !isArrival && !isDeparture && !inRange && "hover:bg-cream",
            full && !past && "text-stone line-through decoration-stone/70",
            inRange && "bg-gold-pale text-ink",
            (isArrival || isDeparture) && "bg-gold text-ink font-semibold shadow-[inset_0_0_0_1px_rgb(141_100_23/0.5)]",
          )}
        >
          <span>{d}</span>
          {price !== null && <span className={cn("text-[0.6rem] leading-none", isArrival || isDeparture ? "text-ink/80" : "text-muted")}>{Math.round(price / 100)} €</span>}
        </button>,
      );
    }
    return (
      <div key={`${y}-${m}`} className="min-w-0">
        <p className="mb-3 text-center font-serif text-[1.35rem] text-gold-dark">
          {MONTHS[m - 1]} {y}
        </p>
        <div className="grid grid-cols-7 gap-px">
          {WEEKDAYS.map((w, i) => (
            <span key={WEEKDAYS_LONG[i]} className="pb-1 text-center text-[0.7rem] font-semibold text-muted" aria-label={WEEKDAYS_LONG[i]}>
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
    <div className={cn("relative", className)} data-testid="rate-calendar">
      <button type="button" onClick={() => shift(-1)} disabled={!canPrev} aria-label="Vorheriger Monat" className="absolute left-0 top-0 grid h-9 w-9 place-items-center text-gold-dark hover:bg-cream disabled:opacity-25">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button type="button" onClick={() => shift(1)} aria-label="Nächster Monat" className="absolute right-0 top-0 grid h-9 w-9 place-items-center text-gold-dark hover:bg-cream">
        <ChevronRight className="h-5 w-5" />
      </button>
      <div className={cn("grid gap-8 px-2", months === 2 && "md:grid-cols-2")}>
        {renderMonth(cy, cm)}
        {months === 2 && <div className="hidden md:block">{renderMonth(second.getUTCFullYear(), second.getUTCMonth() + 1)}</div>}
      </div>
    </div>
  );
}
