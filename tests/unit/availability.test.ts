import { describe, expect, it } from "vitest";
import {
  checkSelection,
  findAlternativeSlots,
  freeIntervals,
  getCommonAvailability,
  selectionDayStatus,
  spaceDayStatus,
  type AvailabilityContext,
  type SpaceAvailabilityProfile,
  type WeeklyHours,
} from "@/domain/availability";
import { intersectAll, subtractIntervals } from "@/domain/intervals";
import { zonedDateTimeToUtc } from "@/domain/time";
import type { AvailabilityBlock } from "@/domain/types";

const DATE = "2026-10-17"; // Saturday
const at = (time: string, date = DATE) => zonedDateTimeToUtc(date, time);
const NOW = Date.UTC(2026, 8, 1); // well before the test dates

function hours(open: string, close: string): WeeklyHours {
  return Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, [{ open, close }]]));
}

function profile(spaceId: string, weeklyHours: WeeklyHours, extra: Partial<SpaceAvailabilityProfile> = {}): SpaceAvailabilityProfile {
  return {
    spaceId,
    name: spaceId,
    weeklyHours,
    setupBufferMinutes: 0,
    cleanupBufferMinutes: 0,
    advanceBookingMinHours: null,
    advanceBookingMaxDays: null,
    minimumDurationMinutes: null,
    maximumDurationMinutes: null,
    ...extra,
  };
}

let blockId = 0;
function block(spaceId: string, start: number, end: number, type: AvailabilityBlock["type"] = "booked", extra: Partial<AvailabilityBlock> = {}): AvailabilityBlock {
  return { id: `b${++blockId}`, spaceId, start, end, type, reason: null, bookingId: null, expiresAt: null, isDemo: true, ...extra };
}

describe("interval math", () => {
  it("intersects and subtracts", () => {
    expect(intersectAll([[{ start: 0, end: 10 }], [{ start: 5, end: 20 }], [{ start: 7, end: 8 }]])).toEqual([{ start: 7, end: 8 }]);
    expect(subtractIntervals([{ start: 0, end: 10 }], [{ start: 3, end: 5 }])).toEqual([
      { start: 0, end: 3 },
      { start: 5, end: 10 },
    ]);
  });
});

describe("getCommonAvailability – Schnittmenge (Test 102)", () => {
  it("Restaurant 10–22, Bühne 12–23, Wintergarten 15–21 → gemeinsam 15:00–21:00", () => {
    const ctx: AvailabilityContext = {
      now: NOW,
      blocks: [],
      profiles: {
        restaurant: profile("restaurant", hours("10:00", "22:00")),
        stage: profile("stage", hours("12:00", "23:00")),
        "winter-garden": profile("winter-garden", hours("15:00", "21:00")),
      },
    };
    const result = getCommonAvailability(["restaurant", "stage", "winter-garden"], { from: DATE, to: DATE }, ctx);
    expect(result.common).toEqual([{ start: at("15:00"), end: at("21:00") }]);
    expect(result.perSpace.restaurant).toEqual([{ start: at("10:00"), end: at("22:00") }]);
  });

  it("derives free windows from bookings as well as from opening hours", () => {
    const ctx: AvailabilityContext = {
      now: NOW,
      profiles: {
        restaurant: profile("restaurant", hours("08:00", "24:00")),
        stage: profile("stage", hours("08:00", "24:00")),
      },
      blocks: [block("restaurant", at("08:00"), at("10:00")), block("restaurant", at("22:00"), at("24:00")), block("stage", at("08:00"), at("12:00"))],
    };
    const { common } = getCommonAvailability(["restaurant", "stage"], { from: DATE, to: DATE }, ctx);
    expect(common).toEqual([{ start: at("12:00"), end: at("22:00") }]);
  });
});

describe("checkSelection – blockierter Bereich (Tests 103/104/59)", () => {
  const ctx: AvailabilityContext = {
    now: NOW,
    profiles: {
      restaurant: profile("restaurant", hours("09:00", "02:00")),
      stage: profile("stage", hours("09:00", "02:00")),
      "winter-garden": profile("winter-garden", hours("09:00", "02:00")),
    },
    blocks: [block("winter-garden", at("00:00"), at("23:59"), "booked")],
  };
  const request = { start: at("16:00"), end: at("23:00") };

  it("Restaurant + Bühne + Wintergarten → bookingAllowed = false, blockedSpaces enthält winter-garden", () => {
    const r = checkSelection(["restaurant", "stage", "winter-garden"], request, ctx, { enforceBookableHours: true });
    expect(r.bookingAllowed).toBe(false);
    expect(r.blockedSpaces).toEqual(["winter-garden"]);
    expect(r.availableSpaceIds).toEqual(["restaurant", "stage"]);
    expect(r.results.find((x) => x.spaceId === "winter-garden")?.status).toBe("booked");
  });

  it("Restaurant + Bühne → bookingAllowed = true (ein belegter Raum blockiert die freien nicht)", () => {
    const r = checkSelection(["restaurant", "stage"], request, ctx, { enforceBookableHours: true });
    expect(r.bookingAllowed).toBe(true);
    expect(r.blockedSpaces).toEqual([]);
  });

  it("rejects requests outside bookable hours", () => {
    const r = checkSelection(["restaurant"], { start: at("05:00"), end: at("08:00") }, ctx, { enforceBookableHours: true });
    expect(r.bookingAllowed).toBe(false);
    expect(r.results[0]?.reasonCode).toBe("closed");
  });

  it("allows events crossing midnight when the window extends past midnight", () => {
    const r = checkSelection(["restaurant"], { start: at("20:00"), end: at("01:30", "2026-10-18") }, ctx, { enforceBookableHours: true });
    expect(r.bookingAllowed).toBe(true);
  });

  it("offers alternatives: same-day windows and next dates", () => {
    const alts = findAlternativeSlots(["restaurant", "stage", "winter-garden"], request, ctx, { maxResults: 3 });
    expect(alts.length).toBe(3);
    expect(alts[0]!.date).toBe("2026-10-18");
  });
});

describe("conflicts, buffers and holds", () => {
  it("half-open ranges: back-to-back events do not conflict", () => {
    const ctx: AvailabilityContext = {
      now: NOW,
      profiles: { restaurant: profile("restaurant", hours("08:00", "24:00")) },
      blocks: [block("restaurant", at("10:00"), at("14:00"))],
    };
    expect(checkSelection(["restaurant"], { start: at("14:00"), end: at("18:00") }, ctx, { enforceBookableHours: true }).bookingAllowed).toBe(true);
    expect(checkSelection(["restaurant"], { start: at("13:59"), end: at("18:00") }, ctx, { enforceBookableHours: true }).bookingAllowed).toBe(false);
  });

  it("respects setup and cleanup buffers", () => {
    const ctx: AvailabilityContext = {
      now: NOW,
      profiles: { restaurant: profile("restaurant", hours("08:00", "24:00"), { setupBufferMinutes: 60, cleanupBufferMinutes: 30 }) },
      blocks: [block("restaurant", at("10:00"), at("14:00"))],
    };
    // needs 60 min setup before 15:00 → 14:00 is fine, 14:30 start with setup from 13:30 conflicts
    expect(checkSelection(["restaurant"], { start: at("15:00"), end: at("18:00") }, ctx, { enforceBookableHours: true }).bookingAllowed).toBe(true);
    expect(checkSelection(["restaurant"], { start: at("14:30"), end: at("18:00") }, ctx, { enforceBookableHours: true }).bookingAllowed).toBe(false);
    // cleanup 30 min: event ending 09:45 would need cleaning until 10:15 → conflict
    expect(checkSelection(["restaurant"], { start: at("08:00"), end: at("09:45") }, ctx, { enforceBookableHours: true }).bookingAllowed).toBe(false);
    const free = freeIntervals(ctx.profiles.restaurant!, ctx, DATE, DATE);
    expect(free).toEqual([
      { start: at("08:00"), end: at("09:30") },
      { start: at("15:00"), end: at("24:00") },
    ]);
  });

  it("ignores expired holds", () => {
    const ctx: AvailabilityContext = {
      now: NOW,
      profiles: { restaurant: profile("restaurant", hours("08:00", "24:00")) },
      blocks: [block("restaurant", at("10:00"), at("14:00"), "reserved", { expiresAt: NOW - 1 })],
    };
    expect(checkSelection(["restaurant"], { start: at("10:00"), end: at("12:00") }, ctx, { enforceBookableHours: true }).bookingAllowed).toBe(true);
  });

  it("classifies day status per space", () => {
    const ctx: AvailabilityContext = {
      now: NOW,
      profiles: {
        restaurant: profile("restaurant", hours("10:00", "22:00")),
        stage: profile("stage", hours("10:00", "22:00")),
      },
      blocks: [block("restaurant", at("10:00"), at("22:00"), "booked"), block("stage", at("12:00"), at("14:00"), "maintenance")],
    };
    expect(spaceDayStatus("restaurant", DATE, ctx).status).toBe("booked");
    expect(spaceDayStatus("stage", DATE, ctx).status).toBe("partially_available");
    const sel = selectionDayStatus(["restaurant", "stage"], DATE, ctx);
    expect(sel.status).toBe("booked");
    expect(sel.perSpace).toEqual({ restaurant: "booked", stage: "partially_available" });
  });
});
