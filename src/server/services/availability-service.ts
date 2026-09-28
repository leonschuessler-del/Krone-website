import { and, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import {
  checkSelection,
  findAlternativeSlots,
  getCommonAvailability,
  selectionDayStatus,
  spaceDayStatus,
  type AvailabilityContext,
  type SpaceAvailabilityProfile,
} from "@/domain/availability";
import { describeSelectionIssue, validateSelection } from "@/domain/selection";
import { resolveSchedule, type ScheduleInput } from "@/domain/schedule";
import { addDays, dayBounds, eachDate, type LocalDate } from "@/domain/time";
import type { AvailabilityBlock, Interval } from "@/domain/types";
import type {
  AlternativeSlot,
  AvailabilityCalendarResponse,
  AvailabilityCheckResponse,
  SpaceCheckResult,
} from "@/features/availability/api-types";
import { formatDayMonth, formatTimeRange } from "@/lib/format";
import type { Database } from "@/server/db/client";
import { availabilityBlocks, type AvailabilityBlockRow, type SpaceRow } from "@/server/db/schema";
import { env } from "@/lib/env";
import { getVenueSettings } from "./settings-service";
import { listSpaceRows, rowToSpace } from "./space-service";

/**
 * availabilityService – loads spaces + blocks from the DB and runs the pure
 * availability engine. Results are display data; the booking service repeats
 * the check inside its transaction.
 */

const iso = (ms: number) => new Date(ms).toISOString();
const isoInterval = (i: Interval) => ({ start: iso(i.start), end: iso(i.end) });

export function rowToBlock(r: AvailabilityBlockRow): AvailabilityBlock {
  return {
    id: r.id,
    spaceId: r.spaceId,
    start: r.startAt.getTime(),
    end: r.endAt.getTime(),
    type: r.type,
    reason: r.reason,
    bookingId: r.bookingId,
    expiresAt: r.expiresAt ? r.expiresAt.getTime() : null,
    isDemo: r.isDemo,
  };
}

export function toProfile(row: SpaceRow, venueHours: SpaceAvailabilityProfile["weeklyHours"]): SpaceAvailabilityProfile {
  return {
    spaceId: row.id,
    name: row.name,
    weeklyHours: row.weeklyHours ?? venueHours,
    setupBufferMinutes: row.setupBufferMinutes ?? 0,
    cleanupBufferMinutes: row.cleanupBufferMinutes ?? 0,
    advanceBookingMinHours: row.advanceBookingMinHours,
    advanceBookingMaxDays: row.advanceBookingMaxDays,
    minimumDurationMinutes: row.minimumDurationMinutes,
    maximumDurationMinutes: row.maximumDurationMinutes,
  };
}

/** Loads active blocks overlapping [from, to] (with a margin for buffers). */
export async function loadBlocks(db: Database, spaceIds: string[], range: Interval, now = Date.now()): Promise<AvailabilityBlock[]> {
  if (spaceIds.length === 0) return [];
  const margin = 2 * 86_400_000;
  const rows = await db
    .select()
    .from(availabilityBlocks)
    .where(
      and(
        inArray(availabilityBlocks.spaceId, spaceIds),
        eq(availabilityBlocks.active, true),
        lt(availabilityBlocks.startAt, new Date(range.end + margin)),
        gt(availabilityBlocks.endAt, new Date(range.start - margin)),
        or(isNull(availabilityBlocks.expiresAt), gt(availabilityBlocks.expiresAt, new Date(now))),
      ),
    );
  return rows.map(rowToBlock);
}

export interface LoadedContext {
  ctx: AvailabilityContext;
  rows: SpaceRow[];
  venueHours: SpaceAvailabilityProfile["weeklyHours"];
}

export async function buildContext(db: Database, spaceIds: string[], range: Interval, now = Date.now()): Promise<LoadedContext> {
  const [allRows, settings] = await Promise.all([listSpaceRows(db), getVenueSettings(db)]);
  const rows = allRows.filter((r) => spaceIds.includes(r.id));
  const venueHours = settings.bookableHours.weeklyHours;
  const profiles: Record<string, SpaceAvailabilityProfile> = {};
  for (const r of rows) if (r.bookable) profiles[r.id] = toProfile(r, venueHours);
  const blocks = await loadBlocks(db, Object.keys(profiles), range, now);
  return { ctx: { profiles, blocks, now }, rows: allRows, venueHours };
}

export async function checkAvailability(
  db: Database,
  input: ScheduleInput & { spaceIds: string[]; alternatives?: number },
  now = Date.now(),
): Promise<AvailabilityCheckResponse> {
  const settings = await getVenueSettings(db);
  const resolved = resolveSchedule(input, settings.bookableHours.weeklyHours);
  const dates = resolved.dates;
  const rangeForLoad: Interval =
    resolved.kind === "range"
      ? { start: resolved.start, end: resolved.end }
      : { start: dayBounds(dates[0]!).start, end: dayBounds(dates[dates.length - 1]!).end };
  const extendedRange = { start: rangeForLoad.start, end: rangeForLoad.end + (input.alternatives ? 95 * 86_400_000 : 0) };
  const { ctx, rows } = await buildContext(db, input.spaceIds, extendedRange, now);
  const nameOf = (id: string) => rows.find((r) => r.id === id)?.name ?? id;
  const selectable = rows.map((r) => rowToSpace(r));
  const spaceIds = input.spaceIds.filter((id) => ctx.profiles[id]);

  const common = getCommonAvailability(spaceIds, { from: dates[0]!, to: dates[dates.length - 1]! }, ctx);
  const results: SpaceCheckResult[] = [];
  let bookingAllowed: boolean;
  let alternatives: AlternativeSlot[] = [];

  if (resolved.kind === "range") {
    const request = { start: resolved.start, end: resolved.end };
    const check = checkSelection(spaceIds, request, ctx, { enforceBookableHours: resolved.rentalMode === "hourly", enforceDuration: true });
    bookingAllowed = check.bookingAllowed;
    for (const r of check.results) {
      results.push({
        spaceId: r.spaceId,
        name: nameOf(r.spaceId),
        status: r.available ? "available" : r.status,
        available: r.available,
        freeIntervals: (common.perSpace[r.spaceId] ?? []).map(isoInterval),
        conflicts: r.conflicts.map((c) => ({ start: iso(c.start), end: iso(c.end), type: c.type })),
        reason: r.reason,
      });
    }
    if (!bookingAllowed && (input.alternatives ?? 0) > 0) {
      alternatives = findAlternativeSlots(spaceIds, request, ctx, { maxResults: input.alternatives }).map((a) => ({
        date: a.date,
        start: iso(a.start),
        end: iso(a.end),
        label: `${formatDayMonth(a.date)} · ${formatTimeRange(a.start, a.end)}`,
      }));
    }
  } else {
    const date = dates[0]!;
    const day = selectionDayStatus(spaceIds, date, ctx);
    for (const id of spaceIds) {
      const s = spaceDayStatus(id, date, ctx);
      results.push({
        spaceId: id,
        name: nameOf(id),
        status: s.status,
        available: s.free.length > 0,
        freeIntervals: s.free.map(isoInterval),
        conflicts: [],
        reason: s.free.length > 0 ? null : "An diesem Tag nicht verfügbar",
      });
    }
    bookingAllowed = day.common.length > 0;
  }

  const unavailable = results.filter((r) => !r.available);
  const issues = validateSelection(spaceIds, selectable)
    .filter((i) => i.type !== "empty")
    .map((i) => describeSelectionIssue(i, nameOf));
  const total = results.length;
  const availableCount = total - unavailable.length;
  const message =
    total === 0
      ? "Bitte wählen Sie mindestens einen Bereich."
      : availableCount === total
        ? total === 1
          ? `${results[0]!.name} ist verfügbar.`
          : "Alle ausgewählten Bereiche sind verfügbar."
        : `${availableCount} von ${total} Bereichen verfügbar.`;

  return {
    requested: {
      date: dates[0]!,
      endDate: resolved.rentalMode === "daily" ? dates[dates.length - 1]! : null,
      rentalMode: resolved.rentalMode,
      start: resolved.kind === "range" ? iso(resolved.start) : null,
      end: resolved.kind === "range" ? iso(resolved.end) : null,
      hasTimeRange: resolved.kind === "range",
    },
    bookingAllowed: bookingAllowed && issues.length === 0 && total > 0,
    spaces: results,
    availableSpaceIds: results.filter((r) => r.available).map((r) => r.spaceId),
    blockedSpaces: unavailable.map((r) => ({
      spaceId: r.spaceId,
      name: r.name,
      reason: `${r.name} ist ${resolved.kind === "range" ? "in diesem Zeitraum" : "an diesem Tag"} nicht verfügbar.`,
    })),
    commonFreeIntervals: common.common.map(isoInterval),
    summary: { total, available: availableCount, message },
    selectionIssues: issues,
    alternatives,
    demo: env.demoMode,
  };
}

export async function getAvailabilityCalendar(
  db: Database,
  input: { spaceIds: string[]; from: LocalDate; to: LocalDate },
  now = Date.now(),
): Promise<AvailabilityCalendarResponse> {
  const range = { start: dayBounds(input.from).start, end: dayBounds(input.to).end };
  const { ctx } = await buildContext(db, input.spaceIds, range, now);
  const spaceIds = input.spaceIds.filter((id) => ctx.profiles[id]);
  const days = eachDate(input.from, input.to).map((date) => {
    const s = selectionDayStatus(spaceIds, date, ctx);
    const longest = s.common.reduce((m, i) => Math.max(m, i.end - i.start), 0);
    return { date, status: s.status, perSpace: s.perSpace, commonFreeMinutes: Math.round(longest / 60_000) };
  });
  return { from: input.from, to: input.to, spaceIds, days };
}

export function clampCalendarRange(from: LocalDate, to: LocalDate): { from: LocalDate; to: LocalDate } {
  const maxTo = addDays(from, 62);
  return { from, to: to > maxTo ? maxTo : to };
}
