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
