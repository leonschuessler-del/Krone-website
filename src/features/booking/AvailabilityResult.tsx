"use client";

import { AlertCircle, CalendarSearch, CheckCircle2, Loader2, RefreshCw, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import type { AvailabilityCheckResponse } from "@/features/availability/api-types";
import type { AsyncState } from "@/features/availability/use-availability-check";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { utcToLocal } from "@/domain/time";

interface Props {
  result: AsyncState<AvailabilityCheckResponse> & { retry: () => void };
  onRemoveSpace?: (id: string) => void;
  onPickAlternative?: (alt: { date: string; startTime: string; endTime: string }) => void;
  onChooseOtherDate?: () => void;
  tone?: "light" | "dark";
  className?: string;
}

/**
 * Shows the availability of the current selection:
 * "2 von 3 Bereichen verfügbar" + exactly which space is blocked + actions.
 */
export function AvailabilityResult({ result, onRemoveSpace, onPickAlternative, onChooseOtherDate, tone = "light", className }: Props) {
  const [showAlternatives, setShowAlternatives] = useState(false);
  const dark = tone === "dark";
  const data = result.data;

  if (result.state === "idle") return null;
  if (result.state === "error" && !data) {
    return (
      <div role="alert" className={cn("rounded-xl border p-3 text-sm", dark ? "border-white/10 bg-white/5" : "border-danger/20 bg-danger-pale", className)}>
        <p className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-4 w-4 shrink-0 text-danger" /> Die Verfügbarkeit konnte gerade nicht geladen werden.
        </p>
        <button type="button" onClick={result.retry} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4">
          <RefreshCw className="h-3.5 w-3.5" /> Erneut versuchen
        </button>
      </div>
    );
  }
  if (!data) {
    return (
      <p className={cn("flex items-center gap-2 text-sm", dark ? "text-paper/70" : "text-muted", className)}>
        <Loader2 className="h-4 w-4 animate-spin" /> Verfügbarkeit wird geprüft …
      </p>
    );
  }

  const allOk = data.bookingAllowed;
  const hasRange = data.requested.hasTimeRange;
  return (
    <div
      className={cn("space-y-2.5 text-sm", result.state === "loading" && "opacity-70", className)}
      aria-live="polite"
      data-testid="availability-result"
      data-booking-allowed={allOk}
    >
      <p className={cn("flex items-start gap-2 font-semibold", allOk ? (dark ? "text-[#a9cf9f]" : "text-success") : dark ? "text-[#f0b3a8]" : "text-danger")}>
        {allOk ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
        <span data-testid="availability-summary">{data.summary.message}</span>
      </p>

      {allOk && data.commonFreeIntervals.length > 0 && !hasRange && (
        <p className={dark ? "text-paper/75" : "text-ink-soft"}>
          {data.spaces.length > 1 ? "Gemeinsame freie Zeit: " : "Freie Zeit: "}
          {data.commonFreeIntervals.map((i) => `${formatTime(Date.parse(i.start))}–${formatTime(Date.parse(i.end))} Uhr`).join(", ")}
        </p>
      )}

      {data.blockedSpaces.length > 0 && (
        <ul className="space-y-1.5">
          {data.blockedSpaces.map((b) => (
            <li
              key={b.spaceId}
              className={cn("flex items-center justify-between gap-2 rounded-lg px-3 py-2", dark ? "bg-white/6" : "bg-danger-pale/70")}
              data-testid="blocked-space"
            >
              <span>{b.reason}</span>
              {onRemoveSpace && (
                <button
                  type="button"
                  onClick={() => onRemoveSpace(b.spaceId)}
                  className={cn("inline-flex shrink-0 items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline", dark ? "text-gold-light" : "text-ink")}
                >
                  <Trash2 className="h-3.5 w-3.5" /> {b.name} entfernen
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {data.selectionIssues.map((issue) => (
        <p key={issue} className={dark ? "text-gold-light" : "text-warning"}>
          {issue}
        </p>
      ))}

      {!allOk && (
        <div className="flex flex-wrap gap-2 pt-1">
          {hasRange && data.alternatives.length > 0 && onPickAlternative && (
            <button
              type="button"
              onClick={() => setShowAlternatives((v) => !v)}
              aria-expanded={showAlternatives}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
                dark ? "border-white/20 hover:border-gold-light" : "border-ink/20 hover:border-ink/50",
              )}
            >
              <CalendarSearch className="h-3.5 w-3.5" /> Alternative Zeiten anzeigen
            </button>
          )}
          {onChooseOtherDate && (
            <button
              type="button"
              onClick={onChooseOtherDate}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
                dark ? "border-white/20 hover:border-gold-light" : "border-ink/20 hover:border-ink/50",
              )}
            >
              Anderen Termin wählen
            </button>
          )}
        </div>
      )}

      {showAlternatives && onPickAlternative && (
        <ul className="space-y-1" data-testid="alternatives">
          <li className={cn("text-xs uppercase tracking-wider", dark ? "text-paper/50" : "text-muted")}>Nächste gemeinsame freie Termine</li>
          {data.alternatives.map((a) => (
            <li key={a.start}>
              <button
                type="button"
                onClick={() =>
                  onPickAlternative({ date: a.date, startTime: utcToLocal(Date.parse(a.start)).time, endTime: utcToLocal(Date.parse(a.end)).time })
                }
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-left font-semibold transition-colors",
                  dark ? "border-white/10 hover:border-gold-light hover:bg-white/5" : "border-sand hover:border-gold hover:bg-gold-pale/40",
                )}
              >
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
