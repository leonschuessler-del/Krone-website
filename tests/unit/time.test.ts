import { describe, expect, it } from "vitest";
import { resolveSchedule, ScheduleError } from "@/domain/schedule";
import { addDays, dayBounds, isLocalDate, isoWeekday, localRangeToInterval, utcToLocal, zonedDateTimeToUtc } from "@/domain/time";

describe("Europe/Berlin time handling", () => {
  it("converts summer time (CEST, UTC+2)", () => {
    expect(new Date(zonedDateTimeToUtc("2026-07-15", "18:00")).toISOString()).toBe("2026-07-15T16:00:00.000Z");
  });

  it("converts winter time (CET, UTC+1)", () => {
    expect(new Date(zonedDateTimeToUtc("2026-12-15", "18:00")).toISOString()).toBe("2026-12-15T17:00:00.000Z");
  });

  it("handles the autumn DST switch (25-hour day)", () => {
    const { start, end } = dayBounds("2026-10-25");
    expect((end - start) / 3_600_000).toBe(25);
    const range = localRangeToInterval("2026-10-24", "20:00", "04:00");
    expect((range.end - range.start) / 3_600_000).toBe(9); // 8 wall-clock hours + 1 repeated hour
  });

  it("handles the spring DST switch (23-hour day)", () => {
    const { start, end } = dayBounds("2026-03-29");
    expect((end - start) / 3_600_000).toBe(23);
  });

  it("round-trips instants to local wall-clock", () => {
    const t = zonedDateTimeToUtc("2026-10-17", "23:30");
    expect(utcToLocal(t)).toMatchObject({ date: "2026-10-17", time: "23:30", weekday: 6 });
  });

  it("validates dates and weekdays", () => {
    expect(isLocalDate("2026-02-29")).toBe(false);
    expect(isLocalDate("2028-02-29")).toBe(true);
    expect(isoWeekday("2026-10-18")).toBe(7);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("resolveSchedule", () => {
  const hours = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, [{ open: "09:00", close: "02:00" }]]));

  it("hourly: end before start means next day", () => {
    const r = resolveSchedule({ rentalMode: "hourly", date: "2026-10-17", startTime: "18:00", endTime: "02:00" }, hours);
    expect(r.kind).toBe("range");
    if (r.kind === "range") expect((r.end - r.start) / 3_600_000).toBe(8);
  });

  it("hourly without times = day overview", () => {
    expect(resolveSchedule({ rentalMode: "hourly", date: "2026-10-17" }, hours).kind).toBe("day");
  });

  it("daily: spans from first opening to last closing", () => {
    const r = resolveSchedule({ rentalMode: "daily", date: "2026-10-17", endDate: "2026-10-18" }, hours);
    expect(r.kind === "range" && r.dates).toEqual(["2026-10-17", "2026-10-18"]);
    if (r.kind === "range") {
      expect(utcToLocal(r.start)).toMatchObject({ date: "2026-10-17", time: "09:00" });
      expect(utcToLocal(r.end)).toMatchObject({ date: "2026-10-19", time: "02:00" });
    }
  });

  it("rejects invalid input", () => {
    expect(() => resolveSchedule({ rentalMode: "hourly", date: "2026-10-17", startTime: "18:00" }, hours)).toThrow(ScheduleError);
    expect(() => resolveSchedule({ rentalMode: "daily", date: "2026-10-17", endDate: "2026-10-10" }, hours)).toThrow(ScheduleError);
  });
});
