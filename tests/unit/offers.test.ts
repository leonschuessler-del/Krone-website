import { describe, expect, it } from "vitest";
import { freeRooms, hotelNudges, stayPricing } from "@/domain/hotel";
import { dayNudge, eligibleOffer, extraDaysFee, upcomingWeekends } from "@/domain/offers";

describe("day tiers for event rooms", () => {
  it("package covers up to 3 days, then 100 € per day, 7th day free", () => {
    expect(extraDaysFee(1)).toBe(0);
    expect(extraDaysFee(3)).toBe(0);
    expect(extraDaysFee(4)).toBe(10000);
    expect(extraDaysFee(6)).toBe(30000);
    expect(extraDaysFee(7)).toBe(30000);
    expect(extraDaysFee(8)).toBe(30000);
    expect(extraDaysFee(10)).toBe(30000);
    expect(extraDaysFee(14)).toBe(60000);
  });
  it("nudges at 2, 5 and 6 days", () => {
    expect(dayNudge(2)).toMatch(/3\. Tag/);
    expect(dayNudge(5)).toMatch(/7 Tage/);
    expect(dayNudge(6)).toMatch(/7\./);
    expect(dayNudge(3)).toBeNull();
    expect(dayNudge(7)).toBeNull();
  });
});

describe("automatic offers", () => {
  const today = "2026-10-01"; // Thursday
  it("last-minute weekend inside 21 days", () => {
    expect(eligibleOffer("2026-10-09", 1, today)?.id).toBe("lastminute"); // Friday
    expect(eligibleOffer("2026-10-17", 2, today)?.id).toBe("lastminute"); // Saturday
    expect(eligibleOffer("2026-10-30", 1, today)).toBeNull(); // Friday, 29 days out
    expect(eligibleOffer("2026-10-18", 1, today)).toBeNull(); // Sunday – no offer
  });
  it("midweek for short rentals only", () => {
    expect(eligibleOffer("2026-11-10", 3, today)?.id).toBe("midweek"); // Tuesday
    expect(eligibleOffer("2026-11-10", 4, today)).toBeNull();
  });
  it("lists the Fridays of the next three weeks", () => {
    expect(upcomingWeekends(today)).toEqual(["2026-10-02", "2026-10-09", "2026-10-16"]);
  });
});

describe("hotel floor and long stays", () => {
  const stay = { arrival: "2026-11-02", departure: "2026-11-04" };
  it("multiplies nights × rooms and discounts from 4 nights", () => {
    expect(stayPricing("double", stay, 2)?.total).toBe(40000);
    const long = stayPricing("double", { arrival: "2026-11-02", departure: "2026-11-06" }, 1)!;
    expect(long.nights).toBe(4);
    expect(long.list).toBe(40000);
    expect(long.total).toBe(36000);
    expect(stayPricing("apartment", stay, 1)).toBeNull();
  });
  it("floor is cheaper than all rooms individually and blocks everything", () => {
    expect(stayPricing("floor", stay, 1)!.perNight).toBeLessThan(8 * 10000 + 2 * 6800);
    const floor = [{ roomTypeId: "floor", arrivalDate: "2026-11-03", departureDate: "2026-11-05", rooms: 1, status: "requested" as const }];
    expect(freeRooms("double", stay, floor)).toBe(0);
    expect(freeRooms("single", stay, floor)).toBe(0);
    const one = [{ roomTypeId: "single", arrivalDate: "2026-11-03", departureDate: "2026-11-04", rooms: 1, status: "requested" as const }];
    expect(freeRooms("floor", stay, one)).toBe(0);
    expect(freeRooms("floor", { arrival: "2026-11-04", departure: "2026-11-06" }, one)).toBe(1);
    expect(freeRooms("double", stay, one)).toBe(8);
  });
  it("nudges towards the floor and the 4th night", () => {
    expect(hotelNudges("double", { arrival: "2026-11-02", departure: "2026-11-05" }, 1, 2).join(" ")).toMatch(/4 Nächten/);
    expect(hotelNudges("double", stay, 4, 8).join(" ")).toMatch(/ganze Etage/);
    expect(hotelNudges("floor", stay, 1, 20)).toEqual([]);
  });
});

describe("multi-room requests", () => {
  const stay = { arrival: "2026-11-02", departure: "2026-11-04" };
  it("sums several room types and keeps the apartment on request", async () => {
    const { stayQuote, validateItems } = await import("@/domain/hotel");
    const q = stayQuote([{ roomTypeId: "single", rooms: 1 }, { roomTypeId: "double", rooms: 2 }], stay);
    expect(q.rooms).toBe(3);
    expect(q.maxGuests).toBe(5);
    expect(q.total).toBe(2 * 6800 + 2 * 2 * 10000);
    expect(stayQuote([{ roomTypeId: "double", rooms: 1 }, { roomTypeId: "apartment", rooms: 1 }], stay).total).toBeNull();
    expect(validateItems([])).toContain("empty");
    expect(validateItems([{ roomTypeId: "floor", rooms: 1 }, { roomTypeId: "double", rooms: 1 }])).toContain("floor_mix");
    expect(validateItems([{ roomTypeId: "double", rooms: 1 }, { roomTypeId: "double", rooms: 1 }])).toContain("duplicate");
    expect(validateItems([{ roomTypeId: "double", rooms: 2 }])).toEqual([]);
  });
  it("marks nights where a type is fully booked", async () => {
    const { fullyBookedNights } = await import("@/domain/hotel");
    const res = [{ roomTypeId: "single", arrivalDate: "2026-11-02", departureDate: "2026-11-04", rooms: 2, status: "confirmed" as const }];
    expect([...fullyBookedNights("single", "2026-11-01", "2026-11-06", res)]).toEqual(["2026-11-02", "2026-11-03"]);
    expect(fullyBookedNights("double", "2026-11-01", "2026-11-06", res).size).toBe(0);
  });
});
