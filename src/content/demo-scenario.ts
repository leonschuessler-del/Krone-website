import { addDays, isoWeekday, todayLocal, type LocalDate } from "@/domain/time";

/**
 * DEMO / SEED ONLY – dates of the demo availability scenario, relative to
 * "today". Pure function so tests (unit, integration, E2E) can compute the
 * same dates as the seed.
 */
export interface DemoScenario {
  /** Saturday ≥ 14 days ahead: Wintergarten fully booked (test case 59/103). */
  winterGardenBookedDate: LocalDate;
  /** Following Sunday: Bühne blocked for maintenance 14:00–20:00. */
  stageMaintenanceDate: LocalDate;
  /** Friday ≥ 21 days ahead: Restaurant booked 18:00–23:00 (partially available). */
  restaurantEveningDate: LocalDate;
  /** Monday ≥ 35 days ahead: Biergarten blocked for 5 days. */
  beerGardenClosedFrom: LocalDate;
  /** Wednesday ≥ 10 days ahead: Alte Wirtschaft reserved 12:00–22:00. */
  oldTavernReservedDate: LocalDate;
}

function nextWeekday(from: LocalDate, weekday: number): LocalDate {
  let d = from;
  while (isoWeekday(d) !== weekday) d = addDays(d, 1);
  return d;
}

export function getDemoScenario(today: LocalDate = todayLocal()): DemoScenario {
  const sat = nextWeekday(addDays(today, 14), 6);
  return {
    winterGardenBookedDate: sat,
    stageMaintenanceDate: addDays(sat, 1),
    restaurantEveningDate: nextWeekday(addDays(today, 21), 5),
    beerGardenClosedFrom: nextWeekday(addDays(today, 35), 1),
    oldTavernReservedDate: nextWeekday(addDays(today, 10), 3),
  };
}

export interface DemoBlockSpec {
  spaceId: string;
  date: LocalDate;
  /** minutes from local midnight of `date` (may exceed 24 h) */
  from: number;
  to: number;
  type: "booked" | "reserved" | "blocked" | "maintenance";
  reason: string;
}

/** DEMO / SEED ONLY – the availability blocks of the demo scenario. */
export function demoBlockSpecs(today: LocalDate = todayLocal()): DemoBlockSpec[] {
  const sc = getDemoScenario(today);
  return [
    { spaceId: "winter-garden", date: sc.winterGardenBookedDate, from: 0, to: 24 * 60 + 120, type: "booked", reason: "Hochzeitsfeier" },
    { spaceId: "stage", date: sc.stageMaintenanceDate, from: 14 * 60, to: 20 * 60, type: "maintenance", reason: "Wartung Bühnentechnik" },
    { spaceId: "restaurant", date: sc.restaurantEveningDate, from: 17 * 60, to: 24 * 60, type: "booked", reason: "Firmenfeier" },
    { spaceId: "old-tavern", date: sc.oldTavernReservedDate, from: 11 * 60, to: 23 * 60, type: "reserved", reason: "Reservierung in Klärung" },
    { spaceId: "beer-garden", date: sc.beerGardenClosedFrom, from: 0, to: 5 * 24 * 60, type: "blocked", reason: "Saisonpause Biergarten" },
    { spaceId: "restaurant", date: addDays(sc.winterGardenBookedDate, 7), from: 0, to: 13 * 60, type: "booked", reason: "Mittagsgesellschaft" },
    { spaceId: "side-room", date: addDays(sc.winterGardenBookedDate, 7), from: 12 * 60, to: 18 * 60, type: "booked", reason: "Geburtstag" },
    { spaceId: "kitchen", date: addDays(sc.restaurantEveningDate, 14), from: 6 * 60, to: 15 * 60, type: "maintenance", reason: "Reinigung Küchentechnik" },
  ];
}
