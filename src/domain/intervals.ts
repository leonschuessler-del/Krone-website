import type { Interval } from "./types";

/** Half-open interval math on UTC epoch ms: [start, end). */

export function isValidInterval(i: Interval): boolean {
  return Number.isFinite(i.start) && Number.isFinite(i.end) && i.end > i.start;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Sorts and merges overlapping/adjacent intervals. */
export function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = intervals.filter(isValidInterval).map((i) => ({ ...i })).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const cur of sorted) {
    const last = out[out.length - 1];
    if (last && cur.start <= last.end) last.end = Math.max(last.end, cur.end);
    else out.push(cur);
  }
  return out;
}

/** Intersection of two interval sets. */
export function intersectIntervals(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  const A = mergeIntervals(a);
  const B = mergeIntervals(b);
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < A.length && j < B.length) {
    const x = A[i]!;
    const y = B[j]!;
    const start = Math.max(x.start, y.start);
    const end = Math.min(x.end, y.end);
    if (end > start) out.push({ start, end });
    if (x.end < y.end) i++;
    else j++;
  }
  return out;
}

/** Intersection across many interval sets (the common availability). */
export function intersectAll(sets: readonly (readonly Interval[])[]): Interval[] {
  if (sets.length === 0) return [];
  return sets.slice(1).reduce<Interval[]>((acc, s) => intersectIntervals(acc, s), mergeIntervals(sets[0]!));
}

/** a minus b */
export function subtractIntervals(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  const B = mergeIntervals(b);
  const out: Interval[] = [];
  for (const base of mergeIntervals(a)) {
    let cursor = base.start;
    for (const cut of B) {
      if (cut.end <= cursor) continue;
      if (cut.start >= base.end) break;
      if (cut.start > cursor) out.push({ start: cursor, end: Math.min(cut.start, base.end) });
      cursor = Math.max(cursor, cut.end);
      if (cursor >= base.end) break;
    }
    if (cursor < base.end) out.push({ start: cursor, end: base.end });
  }
  return out;
}

/** true if `inner` lies completely inside one interval of `set`. */
export function coversInterval(set: readonly Interval[], inner: Interval): boolean {
  return mergeIntervals(set).some((i) => i.start <= inner.start && i.end >= inner.end);
}

export function totalDuration(intervals: readonly Interval[]): number {
  return mergeIntervals(intervals).reduce((sum, i) => sum + (i.end - i.start), 0);
}

export function longestInterval(intervals: readonly Interval[]): Interval | null {
  let best: Interval | null = null;
  for (const i of mergeIntervals(intervals)) if (!best || i.end - i.start > best.end - best.start) best = i;
  return best;
}

export function clipIntervals(intervals: readonly Interval[], range: Interval): Interval[] {
  return intersectIntervals(intervals, [range]);
}
