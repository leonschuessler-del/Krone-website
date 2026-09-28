"use client";

import { Loader2, Trash2, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { BOOKING_STATUS_LABEL } from "@/domain/booking";
import { cn } from "@/lib/cn";
import { adminApi } from "../api-client";
import { BLOCK_TYPE_LABEL } from "../labels";
import { Badge, DataItem, DataList, DemoBadge, Notice } from "../ui";
import type { CalendarBarView, CalendarDayView, CalendarSpaceView } from "./types";

const NAME_COL = 190;
const BAR_TOP = 10;
const BAR_HEIGHT = 38;
const LANE_HEIGHT = 15;

const HATCH_GRAY = "repeating-linear-gradient(135deg, #8f8474 0 6px, #b3a999 6px 12px)";
const HATCH_MAINT = "repeating-linear-gradient(135deg, #5f574e 0 6px, #8f8474 6px 12px)";

function barStyle(bar: CalendarBarView, color: string): CSSProperties {
  switch (bar.type) {
    case "booked":
      return { background: color, color: "#fff" };
    case "reserved":
      return {
        background: `repeating-linear-gradient(135deg, ${color} 0 7px, color-mix(in oklab, ${color} 55%, white) 7px 14px)`,
        color: "#fff",
      };
    case "maintenance":
      return { background: HATCH_MAINT, color: "#fff" };
    case "blocked":
      return { background: HATCH_GRAY, color: "#fff" };
    case "inquiry":
      return { background: `color-mix(in oklab, ${color} 10%, white)`, border: `1.5px dashed ${color}`, color: "#3b332d" };
  }
}

export function ResourceCalendar({
  days,
  spaces,
  bars,
  nowPos,
}: {
  days: CalendarDayView[];
  spaces: CalendarSpaceView[];
  bars: CalendarBarView[];
  nowPos: number | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<CalendarBarView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = days.length;
  const colMin = n > 7 ? 62 : 116;
  const pct = (v: number) => `${(v / n) * 100}%`;

  async function liftBlock() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const res = await adminApi(`/api/admin/availability-blocks/${selected.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setSelected(null);
    router.refresh();
  }

  const selectedSpace = selected ? spaces.find((s) => s.id === selected.spaceId) : null;

  return (
    <>
      <div className="card-surface overflow-hidden p-0">
        <div className="overflow-x-auto" data-testid="resource-calendar">
          <div className="grid" style={{ gridTemplateColumns: `${NAME_COL}px repeat(${n}, minmax(${colMin}px, 1fr))`, minWidth: NAME_COL + n * colMin }}>
            {/* header */}
            <div className="sticky left-0 z-20 border-b border-r border-sand bg-paper px-4 py-3 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted">Bereich</div>
            {days.map((d, i) => (
              <div
                key={d.date}
                className={cn(
                  "border-b border-sand/70 px-2 py-2.5 text-center",
                  i > 0 && "border-l",
                  d.isWeekend ? "bg-cream/70" : "bg-paper",
                  d.isToday && "bg-gold-pale/70",
                )}
              >
                <p className={cn("text-[0.7rem] font-semibold uppercase tracking-[0.14em]", d.isToday ? "text-gold-dark" : "text-muted")}>{d.weekday}</p>
                <p className={cn("text-sm font-semibold tabular-nums", d.isToday ? "text-gold-dark" : "text-ink")}>
                  {d.label}
                  {d.isToday && <span className="ml-1 rounded-full bg-gold px-1.5 text-[0.62rem] uppercase text-anthracite">heute</span>}
                </p>
                {n <= 7 && (
                  <div className="mt-1 flex justify-between px-0.5 text-[0.6rem] tabular-nums text-taupe" aria-hidden>
                    <span>0</span>
                    <span>6</span>
                    <span>12</span>
                    <span>18</span>
                    <span>24</span>
                  </div>
                )}
              </div>
            ))}

            {/* rows */}
            {spaces.map((space) => {
              const rowBars = bars.filter((b) => b.spaceId === space.id);
              const height = BAR_TOP * 2 + BAR_HEIGHT + space.inquiryLanes * LANE_HEIGHT + (space.inquiryLanes ? 4 : 0);
              return (
                <div key={space.id} className="contents" data-space-row={space.id}>
                  <div className="sticky left-0 z-10 flex items-center gap-2.5 border-b border-r border-sand bg-white px-4" style={{ minHeight: height }}>
                    <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: space.color }} aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{space.name}</p>
                      <p className="text-[0.7rem] text-muted">
                        {space.code}
                        {!space.bookable && " · nicht online buchbar"}
                      </p>
                    </div>
                  </div>
                  <div className="relative border-b border-sand" style={{ gridColumn: `2 / span ${n}`, minHeight: height }}>
                    {/* day backgrounds + 6h ticks */}
                    <div className="absolute inset-0 flex" aria-hidden>
                      {days.map((d, i) => (
                        <div
                          key={d.date}
                          className={cn("h-full flex-1", i > 0 && "border-l border-sand/70", d.isWeekend && "bg-cream/45", d.isToday && "bg-gold-pale/30")}
                          style={{
                            backgroundImage:
                              "linear-gradient(to right, transparent calc(25% - 0.5px), rgb(207 197 179 / 0.35) calc(25% - 0.5px), rgb(207 197 179 / 0.35) calc(25% + 0.5px), transparent calc(25% + 0.5px), transparent calc(50% - 0.5px), rgb(207 197 179 / 0.55) calc(50% - 0.5px), rgb(207 197 179 / 0.55) calc(50% + 0.5px), transparent calc(50% + 0.5px), transparent calc(75% - 0.5px), rgb(207 197 179 / 0.35) calc(75% - 0.5px), rgb(207 197 179 / 0.35) calc(75% + 0.5px), transparent calc(75% + 0.5px))",
                          }}
                        />
                      ))}
                    </div>

                    {nowPos !== null && <div className="absolute inset-y-0 z-[5] w-0.5 bg-danger/70" style={{ left: pct(nowPos) }} title="Jetzt" aria-hidden />}

                    {rowBars.map((bar) => {
                      const isInquiry = bar.type === "inquiry";
                      const style: CSSProperties = {
                        left: `calc(${pct(bar.from)} + 1px)`,
                        width: `calc(${pct(bar.to - bar.from)} - 2px)`,
                        top: isInquiry ? BAR_TOP + BAR_HEIGHT + 4 + bar.lane * LANE_HEIGHT : BAR_TOP,
                        height: isInquiry ? LANE_HEIGHT - 3 : BAR_HEIGHT,
                        ...barStyle(bar, space.color),
                      };
                      const className = cn(
                        "absolute z-[6] flex min-w-[6px] flex-col justify-center overflow-hidden px-2 text-left leading-tight shadow-[0_1px_2px_rgb(35_30_27/0.18)] transition-[filter,box-shadow] hover:z-[7] hover:shadow-lift hover:brightness-105 focus-visible:z-[7]",
                        isInquiry ? "rounded-md px-1.5 shadow-none" : "rounded-lg",
                        bar.clippedStart && "rounded-l-none",
                        bar.clippedEnd && "rounded-r-none",
                        bar.isDemo && !isInquiry && "outline-2 -outline-offset-2 outline-dashed outline-white/70",
                      );
                      const content = isInquiry ? (
                        <span className="truncate text-[0.62rem] font-semibold">Anfrage {bar.bookingNumber}</span>
                      ) : (
                        <>
                          <span className="flex items-center gap-1 truncate text-[0.74rem] font-semibold [text-shadow:0_1px_1px_rgb(0_0_0/0.35)]">
                            {bar.type === "maintenance" && <Wrench className="h-3 w-3 shrink-0" aria-hidden />}
                            <span className="truncate">{bar.primary}</span>
                          </span>
                          <span className="truncate text-[0.66rem] opacity-90 [text-shadow:0_1px_1px_rgb(0_0_0/0.35)]">
                            {bar.timeLabel} · {bar.secondary}
                            {bar.isDemo ? " · DEMO" : ""}
                          </span>
                        </>
                      );
                      return bar.bookingId ? (
                        <Link
                          key={bar.id}
                          href={`/admin/buchungen/${bar.bookingId}`}
                          title={bar.title}
                          className={className}
                          style={style}
                          data-bar-type={bar.type}
                          data-space={bar.spaceId}
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          key={bar.id}
                          type="button"
                          title={bar.title}
                          onClick={() => {
                            setError(null);
                            setSelected(bar);
                          }}
                          className={className}
                          style={style}
                          data-bar-type={bar.type}
                          data-space={bar.spaceId}
                        >
                          {content}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-soft" aria-label="Legende">
        <li className="flex items-center gap-2">
          <span className="h-3.5 w-7 rounded bg-[#9a3340]" /> Gebucht (Farbe des Bereichs)
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3.5 w-7 rounded" style={{ background: "repeating-linear-gradient(135deg, #9a3340 0 5px, #cf99a0 5px 10px)" }} /> Reserviert / Zahlung ausstehend
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3.5 w-7 rounded" style={{ background: HATCH_GRAY }} /> Gesperrt
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3.5 w-7 rounded" style={{ background: HATCH_MAINT }} /> Wartung
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3 w-7 rounded border-[1.5px] border-dashed border-[#9a3340] bg-[#9a3340]/10" /> Offene Anfrage (blockiert nicht)
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3.5 w-7 rounded bg-[#8f8474] outline-2 -outline-offset-2 outline-dashed outline-white/80" /> Demo-Daten
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3.5 w-0.5 bg-danger/70" /> Jetzt
        </li>
      </ul>
      <p className="mt-2 text-xs text-muted">Buchungsbalken enthalten Auf- und Abbaupuffer sowie Übergabe/Rückgabe. Klick auf einen Balken öffnet die Buchung bzw. die Sperrzeit.</p>

      <Dialog
        open={selected !== null}
        onClose={() => !busy && setSelected(null)}
        title={selected ? `${BLOCK_TYPE_LABEL[selected.type]}: ${selectedSpace?.name ?? ""}` : ""}
        description={selected?.timeLabel ? `${selected.title.split("\n")[1] ?? ""}` : undefined}
        size="md"
        footer={
          selected?.manual ? (
            <div className="flex flex-wrap justify-between gap-2">
              <Link href="/admin/sperrzeiten" className="inline-flex h-9 items-center text-sm font-semibold text-gold-dark hover:underline">
                Alle Sperrzeiten
              </Link>
              <Button variant="danger" size="sm" onClick={liftBlock} disabled={busy} data-testid="lift-block">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Sperre aufheben
              </Button>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-4">
            {error && <Notice tone="danger">{error}</Notice>}
            <DataList>
              <DataItem label="Art">
                <span className="flex items-center gap-2">
                  {BLOCK_TYPE_LABEL[selected.type]} {selected.isDemo && <DemoBadge />}
                </span>
              </DataItem>
              <DataItem label="Bereich">{selectedSpace?.name}</DataItem>
              <DataItem label="Grund" wide>
                {selected.reason ?? "–"}
              </DataItem>
              {selected.bookingNumber && (
                <DataItem label="Buchung" wide>
                  {selected.bookingNumber} {selected.bookingStatus && <Badge>{BOOKING_STATUS_LABEL[selected.bookingStatus]}</Badge>}
                </DataItem>
              )}
              {selected.expiresLabel && <DataItem label="Hält bis">{selected.expiresLabel} Uhr</DataItem>}
              <DataItem label="Angelegt von">{selected.createdBy?.replace(/^admin:/, "") ?? "–"}</DataItem>
            </DataList>
          </div>
        )}
      </Dialog>
    </>
  );
}
