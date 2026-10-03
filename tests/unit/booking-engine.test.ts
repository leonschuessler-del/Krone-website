import { describe, expect, it } from "vitest";
import {
  averagePerNight,
  bestNightlyPrice,
  canAddRoom,
  cartToReservation,
  cartTotals,
  cheapestStayTotal,
  emptyFilters,
  filterRooms,
  houseFullNights,
  newCartItem,
  roomFacets,
  searchFromParams,
  searchToParams,
  type AvailabilityType,
  type Cart,
} from "@/domain/booking-engine";
import { engineRoomTypes } from "@/domain/booking-engine";
import { cancellationFee } from "@/domain/hotel";
import { isLocalDate } from "@/domain/time";

const live = (over: Partial<Record<string, Partial<AvailabilityType>>> = {}): AvailabilityType[] =>
  engineRoomTypes.map((t) => ({ id: t.id, free: 2, totalRooms: 2, pricePerNight: t.basePricePerNight, fullNights: [], ...over[t.id] }));

describe("calendar prices", () => {
  it("shows the cheapest room with a free night", () => {
    expect(bestNightlyPrice("2026-11-02", live())).toBe(6800); // Einzelzimmer
    const singlesFull = live({ single: { fullNights: ["2026-11-02"] } });
    expect(bestNightlyPrice("2026-11-02", singlesFull)).toBe(7400); // Doppelzimmer zur Einzelnutzung
  });
  it("marks a night only when every type is full", () => {
    const some = live({ single: { fullNights: ["2026-11-02"] } });
    expect(houseFullNights(some).size).toBe(0);
    const all = live({ single: { fullNights: ["2026-11-02"] }, double: { fullNights: ["2026-11-02"] }, "double-single": { fullNights: ["2026-11-02"] }, apartment: { fullNights: ["2026-11-02"] } });
    expect([...houseFullNights(all)]).toEqual(["2026-11-02"]);
  });
  it("sums the cheapest stay over all nights", () => {
    expect(cheapestStayTotal("2026-11-02", "2026-11-05", live())).toEqual({ total: 3 * 6800, nights: 3 });
    const singleTaken = live({ single: { free: 0 } });
    expect(cheapestStayTotal("2026-11-02", "2026-11-05", singleTaken)?.total).toBe(3 * 7400);
    expect(cheapestStayTotal("2026-11-05", "2026-11-05", live())).toBeNull();
  });
});

describe("cart", () => {
  const cart: Cart = {
    arrival: "2026-11-02",
    departure: "2026-11-05",
    items: [newCartItem("double", { adults: 2, children: 0 }, "flex", "a"), { ...newCartItem("single", { adults: 1, children: 0 }, "flex", "b"), extras: { dog: 1 } }],
  };
  it("prices every room and its extras, never with a discount", () => {
    const t = cartTotals(cart);
    expect(t.nights).toBe(3);
    expect(t.rooms).toBe(2);
    expect(t.guests).toBe(3);
    expect(t.lines[0]!.total).toBe(3 * 10000);
    expect(t.lines[1]!.extrasTotal).toBe(3 * 1500);
    expect(t.total).toBe(3 * 10000 + 3 * 6800 + 3 * 1500);
    expect(averagePerNight(t)).toBe(Math.round(t.total! / 3));
  });
  it("is on request as soon as the apartment is inside", () => {
    const t = cartTotals({ ...cart, items: [...cart.items, newCartItem("apartment", { adults: 4, children: 1 }, "flex", "c")] });
    expect(t.total).toBeNull();
    expect(t.onRequest).toBe(true);
  });
  it("folds rooms into one line per type for the API", () => {
    const two = { ...cart, items: [...cart.items, newCartItem("double", { adults: 2, children: 0 }, "flex", "c")] };
    const r = cartToReservation(two);
    expect(r.items).toEqual([{ roomTypeId: "double", rooms: 2 }, { roomTypeId: "single", rooms: 1 }]);
    expect(r.guests).toBe(5);
    expect(r.extras).toEqual([{ id: "dog", quantity: 1 }]);
    expect(r.roomNotes[1]).toContain("Zimmer 2 (Einzelzimmer)");
  });
  it("caps guests per room and adding at the free rooms of the inventory group", () => {
    const item = newCartItem("single", { adults: 3, children: 2 });
    expect(item.adults + item.children).toBe(1);
    expect(canAddRoom(cart, "double", live({ double: { free: 1 } })).ok).toBe(false);
    expect(canAddRoom(cart, "double-single", live({ "double-single": { free: 1 } })).ok).toBe(false); // shares the doubles
    expect(canAddRoom(cart, "double", live({ double: { free: 2 } })).ok).toBe(true);
    expect(canAddRoom(cart, "single", live({ single: { free: 0 } })).reason).toMatch(/ausgebucht/);
  });
});

describe("filters", () => {
  it("sorts by price with 'on request' last and recommended by content order", () => {
    const asc = filterRooms(engineRoomTypes, { ...emptyFilters(), sort: "price-asc" }).map((t) => t.id);
    expect(asc).toEqual(["single", "double-single", "double", "apartment"]);
    const desc = filterRooms(engineRoomTypes, { ...emptyFilters(), sort: "price-desc" }).map((t) => t.id);
    expect(desc[0]).toBe("double");
    expect(desc.at(-1)).toBe("apartment");
    expect(filterRooms(engineRoomTypes, emptyFilters()).map((t) => t.id)).toEqual(["double", "double-single", "single", "apartment"]);
  });
  it("filters by occupancy, beds, features, category and price", () => {
    const f = emptyFilters();
    expect(filterRooms(engineRoomTypes, { ...f, occupancy: ["3+"] }).map((t) => t.id)).toEqual(["apartment"]);
    expect(filterRooms(engineRoomTypes, { ...f, beds: ["single"] }).map((t) => t.id)).toEqual(["single"]);
    expect(filterRooms(engineRoomTypes, { ...f, features: ["Ausgestattete Küche"] }).map((t) => t.id)).toEqual(["apartment"]);
    expect(filterRooms(engineRoomTypes, { ...f, categories: ["double"] }).map((t) => t.id)).toEqual(["double"]);
    expect(filterRooms(engineRoomTypes, { ...f, priceMin: 7000, priceMax: 9000 }).map((t) => t.id)).toEqual(["double-single", "apartment"]);
  });
  it("builds facets from the content", () => {
    const facets = roomFacets();
    expect(facets.price).toEqual({ min: 6800, max: 10000 });
    expect(facets.beds.map((b) => b.id)).toEqual(["double", "single", "multi"]);
    expect(facets.categories).toHaveLength(4);
  });
});

describe("search ↔ url", () => {
  it("round-trips and understands the old 'gaeste' parameter", () => {
    const p = searchToParams({ arrival: "2026-11-02", departure: "2026-11-05", guests: { adults: 2, children: 1 }, code: "FIRMA" });
    expect(p.toString()).toBe("anreise=2026-11-02&abreise=2026-11-05&erwachsene=2&kinder=1&code=FIRMA");
    const s = searchFromParams(p, isLocalDate, { adults: 2 });
    expect(s).toEqual({ arrival: "2026-11-02", departure: "2026-11-05", guests: { adults: 2, children: 1 }, code: "FIRMA" });
    expect(searchFromParams(new URLSearchParams("gaeste=3&anreise=nope"), isLocalDate, { adults: 2 }).guests.adults).toBe(3);
  });
});

describe("cancellation fee", () => {
  it("is free until two days before arrival, 80 % inside, 100 % for a no-show", () => {
    expect(cancellationFee(30000, "2026-11-10", "2026-11-08")).toEqual({ percent: 0, amount: 0 });
    expect(cancellationFee(30000, "2026-11-10", "2026-11-09")).toEqual({ percent: 80, amount: 24000 });
    expect(cancellationFee(30000, "2026-11-10", "2026-11-10")).toEqual({ percent: 80, amount: 24000 });
    expect(cancellationFee(30000, "2026-11-10", "2026-11-10", true)).toEqual({ percent: 100, amount: 30000 });
  });
});
