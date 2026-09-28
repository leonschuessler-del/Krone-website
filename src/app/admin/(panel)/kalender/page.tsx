import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { addDays, diffDays, eachDate, isLocalDate, isoWeekday, todayLocal, utcToLocal, type LocalDate } from "@/domain/time";
import { ResourceCalendar } from "@/features/admin/calendar/ResourceCalendar";
import type { CalendarBarView, CalendarDayView, CalendarSpaceView } from "@/features/admin/calendar/types";
import { BLOCK_TYPE_LABEL, WEEKDAYS } from "@/features/admin/labels";
import { PageHeader } from "@/features/admin/ui";
import { BOOKING_STATUS_LABEL } from "@/domain/booking";
import { cn } from "@/lib/cn";
import { formatDateMedium, formatDateShort, formatDateTime, formatTime } from "@/lib/format";
import { requireAdminPage } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { getCalendarData } from "@/server/services/admin-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kalender" };

const mondayOf = (d: LocalDate) => addDays(d, -(isoWeekday(d) - 1));

export default async function AdminCalendarPage({ searchParams }: { searchParams: Promise<{ from?: string; days?: string }> }) {
  await requireAdminPage("/admin/kalender");
  const sp = await searchParams;
  const now = Date.now();
  const today = todayLocal(now);
  const days = sp.days === "14" ? 14 : 7;
  const from = mondayOf(sp.from && isLocalDate(sp.from) ? sp.from : today);
  const data = await getCalendarData(await getDb(), from, days, now);

  // ---- view model (Europe/Berlin wall-clock positions) -------------------------
  const pos = (instant: number) => {
    const l = utcToLocal(instant);
    return diffDays(from, l.date) + l.minutes / 1440;
  };
  const clamp = (v: number) => Math.min(Math.max(v, 0), days);

  const dayViews: CalendarDayView[] = eachDate(from, data.to).map((date) => ({
    date,
    weekday: WEEKDAYS[isoWeekday(date) - 1]!.short,
    label: formatDateShort(date),
    isToday: date === today,
    isWeekend: isoWeekday(date) >= 6,
  }));

  const spaceName = (id: string) => data.spaces.find((s) => s.id === id)?.name ?? id;
  const bars: CalendarBarView[] = [];
  const lanesBySpace = new Map<string, number[]>(); // inquiry lanes: end position per lane
  for (const bar of [...data.bars].sort((a, b) => a.start - b.start)) {
    if (!data.spaces.some((s) => s.id === bar.spaceId)) continue;
    const rawFrom = pos(bar.start);
    const rawTo = pos(bar.end);
    const f = clamp(rawFrom);
    const t = clamp(rawTo);
    if (t <= f) continue;
    let lane = 0;
    if (bar.type === "inquiry") {
      const lanes = lanesBySpace.get(bar.spaceId) ?? [];
      lane = lanes.findIndex((end) => end <= f);
      if (lane === -1) lane = lanes.length;
      lanes[lane] = t;
      lanesBySpace.set(bar.spaceId, lanes);
    }
    const timeLabel =
      utcToLocal(bar.start).date === utcToLocal(bar.end).date || bar.end - bar.start <= 12 * 3_600_000
        ? `${formatTime(bar.start)}–${formatTime(bar.end)}`
        : `${formatDateShort(utcToLocal(bar.start).date)} ${formatTime(bar.start)} – ${formatDateShort(utcToLocal(bar.end).date)} ${formatTime(bar.end)}`;
    const primary = bar.booking ? (bar.booking.customer || bar.booking.number) : (bar.reason ?? BLOCK_TYPE_LABEL[bar.type]);
    const title = [
      `${BLOCK_TYPE_LABEL[bar.type]} · ${spaceName(bar.spaceId)}${bar.isDemo ? " · DEMO" : ""}`,
      `${formatDateTime(bar.start)} – ${formatDateTime(bar.end)} Uhr`,
      bar.booking ? `${bar.booking.number} · ${bar.booking.customer} · ${BOOKING_STATUS_LABEL[bar.booking.status]}` : null,
      bar.reason ? `Grund: ${bar.reason}` : null,
      bar.expiresAt ? `Hält bis ${formatDateTime(bar.expiresAt)} Uhr` : null,
      bar.type !== "inquiry" && bar.booking ? "(inkl. Auf-/Abbaupuffer)" : null,
    ]
      .filter(Boolean)
      .join("\n");
    bars.push({
      id: bar.id,
      spaceId: bar.spaceId,
      type: bar.type,
      from: f,
      to: t,
      clippedStart: rawFrom < 0,
      clippedEnd: rawTo > days,
      lane,
      title,
      primary,
      secondary: bar.booking ? bar.booking.number : BLOCK_TYPE_LABEL[bar.type],
      timeLabel,
      isDemo: bar.isDemo,
      manual: bar.manual,
      reason: bar.reason,
      createdBy: bar.createdBy,
      bookingId: bar.booking?.id ?? null,
      bookingNumber: bar.booking?.number ?? null,
      bookingStatus: bar.booking?.status ?? null,
      expiresLabel: bar.expiresAt ? formatDateTime(bar.expiresAt) : null,
    });
  }

  const spaces: CalendarSpaceView[] = data.spaces.map((s) => ({ ...s, inquiryLanes: lanesBySpace.get(s.id)?.length ?? 0 }));
  const nowPos = pos(now);
  const q = (f: LocalDate, d = days) => `/admin/kalender?from=${f}&days=${d}`;
  const rangeLabel = `${formatDateMedium(from)} – ${formatDateMedium(data.to)}`;

  return (
    <>
      <PageHeader
        eyebrow="Belegung"
        title="Kalender"
        description="Welcher Bereich ist wann belegt? Zeilen = Bereiche, Spalten = Tage. Alle Zeiten in Ortszeit (Europe/Berlin)."
        actions={
          <Link href="/admin/sperrzeiten" className="inline-flex h-9 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-paper hover:bg-ink-soft">
            <Plus className="h-4 w-4" /> Sperrzeit anlegen
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center overflow-hidden rounded-full border border-stone/70 bg-white">
          <Link href={q(addDays(from, -days))} className="grid h-9 w-10 place-items-center text-ink-soft hover:bg-cream" aria-label="Zurück">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link href={q(mondayOf(today))} className="border-x border-stone/60 px-4 py-1.5 text-sm font-semibold hover:bg-cream">
            Heute
          </Link>
          <Link href={q(addDays(from, days))} className="grid h-9 w-10 place-items-center text-ink-soft hover:bg-cream" aria-label="Weiter">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <p className="px-2 font-serif text-xl font-semibold lining-nums text-ink" data-testid="calendar-range">
          {rangeLabel}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <form method="get" action="/admin/kalender" className="flex items-center gap-1.5">
            <input type="hidden" name="days" value={days} />
            <label htmlFor="cal-from" className="sr-only">
              Springe zu Datum
            </label>
            <input id="cal-from" type="date" name="from" defaultValue={from} className="h-9 rounded-full border border-stone/70 bg-white px-3 text-sm" />
            <button type="submit" className="h-9 rounded-full border border-stone/70 bg-white px-3 text-sm font-semibold hover:bg-cream">
              Anzeigen
            </button>
          </form>
          <div className="flex overflow-hidden rounded-full border border-stone/70 bg-white text-sm font-semibold" role="group" aria-label="Zeitraum">
            {[7, 14].map((d) => (
              <Link key={d} href={q(from, d)} aria-current={d === days ? "true" : undefined} className={cn("px-4 py-1.5", d === days ? "bg-ink text-paper" : "hover:bg-cream")}>
                {d === 7 ? "Woche" : "2 Wochen"}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <ResourceCalendar days={dayViews} spaces={spaces} bars={bars} nowPos={nowPos >= 0 && nowPos <= days ? nowPos : null} />
    </>
  );
}
