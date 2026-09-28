import {
  coversInterval,
  intersectAll,
  mergeIntervals,
  overlaps,
  subtractIntervals,
  totalDuration,
} from "./intervals";
import {
  addDays,
  dayBounds,
  isoWeekday,
  timeToMinutes,
  utcToLocal,
  zonedToUtc,
  type LocalDate,
  type LocalTime,
} from "./time";
import type { AvailabilityBlock, AvailabilityBlockType, Interval, SpaceAvailabilityStatus, SpaceId } from "./types";

/**
 * ============================================================================
 *  AVAILABILITY ENGINE (pure, no I/O)
 * ============================================================================
 *  - Availability is ALWAYS evaluated per space + time range.
 *  - A selection of several spaces is bookable only if EVERY space is free;
 *    the common free time is the INTERSECTION of the spaces' free intervals.
 *  - A blocked space never blocks the other (free) spaces – results are
 *    reported per space so the UI can say exactly which one is unavailable.
 *  - Buffers: a request [s, e] for space S conflicts with a block B if
 *    [s - setupBuffer(S), e + cleanupBuffer(S)] overlaps B.
 *  - Expired holds (reserved blocks with expiresAt <= now) are ignored.
 *  The server uses the same functions for the final, transactional check.
 * ============================================================================
 */

export interface OpeningWindow {
  open: LocalTime;
  /** close <= open means the window ends on the following day (e.g. 09:00–02:00). */
  close: LocalTime;
}

/** ISO weekday (1 = Mon … 7 = Sun) → bookable windows */
export type WeeklyHours = Partial<Record<number, OpeningWindow[]>>;

export interface SpaceAvailabilityProfile {
  spaceId: SpaceId;
  name: string;
  weeklyHours: WeeklyHours;
  setupBufferMinutes: number;
  cleanupBufferMinutes: number;
  advanceBookingMinHours: number | null;
  advanceBookingMaxDays: number | null;
  minimumDurationMinutes: number | null;
  maximumDurationMinutes: number | null;
}

export interface AvailabilityContext {
  profiles: Record<SpaceId, SpaceAvailabilityProfile>;
  blocks: readonly AvailabilityBlock[];
  now: number;
}

const BLOCK_SEVERITY: Record<AvailabilityBlockType, number> = { booked: 3, reserved: 2, blocked: 1, maintenance: 1 };

export function blockTypeToStatus(type: AvailabilityBlockType): SpaceAvailabilityStatus {
  return type === "booked" ? "booked" : type === "reserved" ? "reserved" : "blocked";
}

export const STATUS_LABEL_DE: Record<SpaceAvailabilityStatus, string> = {
  available: "verfügbar",
  partially_available: "teilweise verfügbar",
  reserved: "reserviert",
  booked: "belegt",
  blocked: "gesperrt",
  closed: "nicht buchbar (außerhalb der Buchungszeiten)",
  unknown: "unbekannt",
};

function isBlockActive(block: AvailabilityBlock, now: number): boolean {
  return block.expiresAt === null || block.expiresAt > now;
}

export function activeBlocksFor(spaceId: SpaceId, ctx: AvailabilityContext): AvailabilityBlock[] {
  return ctx.blocks.filter((b) => b.spaceId === spaceId && isBlockActive(b, ctx.now));
}

/** Bookable windows of a space between two local dates (inclusive), clipped to those days. */
export function bookableWindows(profile: SpaceAvailabilityProfile, from: LocalDate, to: LocalDate): Interval[] {
  const out: Interval[] = [];
  // start one day earlier: overnight windows of the previous day spill into `from`
  for (let d = addDays(from, -1); d <= to; d = addDays(d, 1)) {
    for (const w of profile.weeklyHours[isoWeekday(d)] ?? []) {
      const open = timeToMinutes(w.open);
      let close = timeToMinutes(w.close);
      if (close <= open) close += 1440;
      out.push({ start: zonedToUtc(d, open), end: zonedToUtc(d, close) });
    }
  }
  const range = { start: dayBounds(from).start, end: dayBounds(to).end };
  return mergeIntervals(out)
    .map((i) => ({ start: Math.max(i.start, range.start), end: Math.min(i.end, range.end) }))
    .filter((i) => i.end > i.start);
}

/** Block intervals widened by the buffers of the space being requested. */
function bufferedBlockIntervals(profile: SpaceAvailabilityProfile, blocks: readonly AvailabilityBlock[]): Interval[] {
  const before = profile.cleanupBufferMinutes * 60_000;
  const after = profile.setupBufferMinutes * 60_000;
  return blocks.map((b) => ({ start: b.start - before, end: b.end + after }));
}

/** Free intervals of one space within [from, to] (local dates, inclusive). */
export function freeIntervals(profile: SpaceAvailabilityProfile, ctx: AvailabilityContext, from: LocalDate, to: LocalDate): Interval[] {
  const windows = bookableWindows(profile, from, to);
  const blocks = bufferedBlockIntervals(profile, activeBlocksFor(profile.spaceId, ctx));
  return subtractIntervals(windows, blocks);
}

/**
 * getCommonAvailability(selectedSpaceIds, dateRange)
 * → free intervals per space and their intersection (the common free time).
 */
export function getCommonAvailability(
  selectedSpaceIds: readonly SpaceId[],
  dateRange: { from: LocalDate; to: LocalDate },
  ctx: AvailabilityContext,
): { perSpace: Record<SpaceId, Interval[]>; common: Interval[] } {
  const perSpace: Record<SpaceId, Interval[]> = {};
  for (const id of selectedSpaceIds) {
    const profile = ctx.profiles[id];
    perSpace[id] = profile ? freeIntervals(profile, ctx, dateRange.from, dateRange.to) : [];
  }
  return { perSpace, common: intersectAll(selectedSpaceIds.map((id) => perSpace[id] ?? [])) };
}

export interface SpaceRequestCheck {
  spaceId: SpaceId;
  available: boolean;
  status: SpaceAvailabilityStatus;
  conflicts: AvailabilityBlock[];
  reasonCode: "ok" | "conflict" | "closed" | "too_soon" | "too_far" | "too_short" | "too_long" | "unknown_space";
  reason: string | null;
}

export interface CheckOptions {
  /** Hourly requests must lie inside bookable windows. Daily (multi-day) requests are built from windows already. */
  enforceBookableHours: boolean;
  /** Validate min/max duration per space (true for final booking checks). */
  enforceDuration?: boolean;
}

export function checkSpaceRequest(
  spaceId: SpaceId,
  request: Interval,
  ctx: AvailabilityContext,
  options: CheckOptions,
): SpaceRequestCheck {
  const profile = ctx.profiles[spaceId];
  const base = { spaceId, conflicts: [] as AvailabilityBlock[] };
  if (!profile) return { ...base, available: false, status: "unknown", reasonCode: "unknown_space", reason: "Unbekannter Bereich" };

  // 1. conflicts with existing bookings / holds / manual blocks (incl. buffers)
  const blocks = activeBlocksFor(spaceId, ctx);
  const padded: Interval = {
    start: request.start - profile.setupBufferMinutes * 60_000,
    end: request.end + profile.cleanupBufferMinutes * 60_000,
  };
  const conflicts = blocks.filter((b) => overlaps(b, padded));
  if (conflicts.length > 0) {
    const worst = conflicts.reduce((a, b) => (BLOCK_SEVERITY[b.type] > BLOCK_SEVERITY[a.type] ? b : a));
    const status = blockTypeToStatus(worst.type);
    return { ...base, conflicts, available: false, status, reasonCode: "conflict", reason: `In diesem Zeitraum ${STATUS_LABEL_DE[status]}` };
  }

  // 2. bookable hours
  if (options.enforceBookableHours) {
    const from = utcToLocal(request.start).date;
    const to = utcToLocal(request.end - 1).date;
    const windows = bookableWindows(profile, addDays(from, -1), to);
    if (!coversInterval(windows, request)) {
      return { ...base, available: false, status: "closed", reasonCode: "closed", reason: "Außerhalb der buchbaren Zeiten" };
    }
  }

  // 3. booking horizon
  if (profile.advanceBookingMinHours !== null && request.start < ctx.now + profile.advanceBookingMinHours * 3_600_000) {
    return {
      ...base,
      available: false,
      status: "closed",
      reasonCode: "too_soon",
      reason: `Zu kurzfristig – bitte mindestens ${profile.advanceBookingMinHours} Stunden im Voraus anfragen`,
    };
  }
  if (request.start < ctx.now) {
    return { ...base, available: false, status: "closed", reasonCode: "too_soon", reason: "Der Zeitraum liegt in der Vergangenheit" };
  }
  if (profile.advanceBookingMaxDays !== null && request.start > ctx.now + profile.advanceBookingMaxDays * 86_400_000) {
    return {
      ...base,
      available: false,
      status: "closed",
      reasonCode: "too_far",
      reason: `Buchungen sind höchstens ${profile.advanceBookingMaxDays} Tage im Voraus möglich`,
    };
  }

  // 4. duration rules
  if (options.enforceDuration) {
    const minutes = (request.end - request.start) / 60_000;
    if (profile.minimumDurationMinutes !== null && minutes < profile.minimumDurationMinutes) {
      return {
        ...base,
        available: false,
        status: "available",
        reasonCode: "too_short",
        reason: `Mindestmietdauer: ${Math.round(profile.minimumDurationMinutes / 60)} Stunden`,
      };
    }
    if (profile.maximumDurationMinutes !== null && minutes > profile.maximumDurationMinutes) {
      return {
        ...base,
        available: false,
        status: "available",
        reasonCode: "too_long",
        reason: `Maximale Mietdauer: ${Math.round(profile.maximumDurationMinutes / 60)} Stunden`,
      };
    }
  }

  return { ...base, available: true, status: "available", reasonCode: "ok", reason: null };
}

export interface SelectionCheck {
  bookingAllowed: boolean;
  results: SpaceRequestCheck[];
  availableSpaceIds: SpaceId[];
  blockedSpaces: SpaceId[];
}

/** Checks a multi-space request. bookingAllowed only if every selected space is available. */
export function checkSelection(
  spaceIds: readonly SpaceId[],
  request: Interval,
  ctx: AvailabilityContext,
  options: CheckOptions,
): SelectionCheck {
  const results = spaceIds.map((id) => checkSpaceRequest(id, request, ctx, options));
  const availableSpaceIds = results.filter((r) => r.available).map((r) => r.spaceId);
  const blockedSpaces = results.filter((r) => !r.available).map((r) => r.spaceId);
  return { bookingAllowed: spaceIds.length > 0 && blockedSpaces.length === 0, results, availableSpaceIds, blockedSpaces };
}

export interface DayStatus {
  status: SpaceAvailabilityStatus;
  windows: Interval[];
  free: Interval[];
}

/** Status of one space for a whole local day (used by the calendar). */
export function spaceDayStatus(spaceId: SpaceId, date: LocalDate, ctx: AvailabilityContext): DayStatus {
  const profile = ctx.profiles[spaceId];
  if (!profile) return { status: "unknown", windows: [], free: [] };
  const windows = bookableWindows(profile, date, date);
  const dayEnd = dayBounds(date).end;
  // Only count future time as free.
  const future = windows.map((w) => ({ start: Math.max(w.start, ctx.now), end: w.end })).filter((w) => w.end > w.start && w.start < dayEnd);
  if (future.length === 0) return { status: "closed", windows, free: [] };
  const free = subtractIntervals(future, bufferedBlockIntervals(profile, activeBlocksFor(spaceId, ctx)));
  const freeMs = totalDuration(free);
  const totalMs = totalDuration(future);
  if (freeMs >= totalMs) return { status: "available", windows, free };
  if (freeMs > 0) return { status: "partially_available", windows, free };
  const covering = activeBlocksFor(spaceId, ctx).filter((b) => future.some((w) => overlaps(b, w)));
  const worst = covering.reduce<AvailabilityBlock | null>((a, b) => (!a || BLOCK_SEVERITY[b.type] > BLOCK_SEVERITY[a.type] ? b : a), null);
  return { status: worst ? blockTypeToStatus(worst.type) : "blocked", windows, free };
}

/** Combined day status for a selection: intersection semantics. */
export function selectionDayStatus(
  spaceIds: readonly SpaceId[],
  date: LocalDate,
  ctx: AvailabilityContext,
): { status: SpaceAvailabilityStatus; perSpace: Record<SpaceId, SpaceAvailabilityStatus>; common: Interval[] } {
  const perSpace: Record<SpaceId, SpaceAvailabilityStatus> = {};
  const frees: Interval[][] = [];
  for (const id of spaceIds) {
    const s = spaceDayStatus(id, date, ctx);
    perSpace[id] = s.status;
    frees.push(s.free);
  }
  const common = intersectAll(frees);
  const statuses = Object.values(perSpace);
  let status: SpaceAvailabilityStatus;
  if (statuses.length === 0) status = "unknown";
  else if (statuses.every((s) => s === "closed")) status = "closed";
  else if (statuses.every((s) => s === "available")) status = "available";
  else if (common.length > 0) status = "partially_available";
  else if (statuses.includes("booked")) status = "booked";
  else if (statuses.includes("reserved")) status = "reserved";
  else if (statuses.includes("closed")) status = "closed";
  else status = "blocked";
  return { status, perSpace, common };
}

export interface AlternativeSlotResult {
  date: LocalDate;
  start: number;
  end: number;
  kind: "same_day" | "other_day";
}

/**
 * Suggests alternatives when a selection is not bookable:
 *  1. other free windows on the same day long enough for the requested duration
 *  2. the next days where the same local time range is free for ALL spaces
 */
export function findAlternativeSlots(
  spaceIds: readonly SpaceId[],
  request: Interval,
  ctx: AvailabilityContext,
  options: { maxResults?: number; searchDays?: number; includeSameDay?: boolean } = {},
): AlternativeSlotResult[] {
  const { maxResults = 3, searchDays = 90, includeSameDay = true } = options;
  const duration = request.end - request.start;
  const local = utcToLocal(request.start);
  const out: AlternativeSlotResult[] = [];

  if (includeSameDay) {
    const { common } = getCommonAvailability(spaceIds, { from: local.date, to: local.date }, ctx);
    for (const w of common) {
      if (w.end - w.start >= duration && w.start >= ctx.now) {
        const slot = { start: w.start, end: w.start + duration };
        if (checkSelection(spaceIds, slot, ctx, { enforceBookableHours: true }).bookingAllowed) {
          out.push({ date: local.date, ...slot, kind: "same_day" });
          if (out.length >= Math.min(2, maxResults)) break;
        }
      }
    }
  }

  const startMinutes = local.minutes;
  const durationMinutes = duration / 60_000;
  for (let offset = 1; offset <= searchDays && out.length < maxResults; offset++) {
    const date = addDays(local.date, offset);
    const slot = { start: zonedToUtc(date, startMinutes), end: zonedToUtc(date, startMinutes + durationMinutes) };
    if (checkSelection(spaceIds, slot, ctx, { enforceBookableHours: true }).bookingAllowed) {
      out.push({ date, ...slot, kind: "other_day" });
    }
  }
  return out.slice(0, maxResults);
}

/** Next dates where the selection has a common free window of at least `minMinutes`. */
export function findNextCommonDates(
  spaceIds: readonly SpaceId[],
  fromDate: LocalDate,
  ctx: AvailabilityContext,
  options: { minMinutes?: number; maxResults?: number; searchDays?: number } = {},
): Array<{ date: LocalDate; common: Interval[] }> {
  const { minMinutes = 120, maxResults = 3, searchDays = 90 } = options;
  const out: Array<{ date: LocalDate; common: Interval[] }> = [];
  for (let i = 0; i <= searchDays && out.length < maxResults; i++) {
    const date = addDays(fromDate, i);
    const { common } = selectionDayStatus(spaceIds, date, ctx);
    const usable = common.filter((w) => w.end - w.start >= minMinutes * 60_000);
    if (usable.length) out.push({ date, common: usable });
  }
  return out;
}
