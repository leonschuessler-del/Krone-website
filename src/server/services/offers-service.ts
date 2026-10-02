import { spaceSeeds } from "@/content/spaces";
import { dayBounds, todayLocal, utcToLocal, addDays } from "@/domain/time";
import { datesOfIntervals, yieldOffers, type YieldOffer } from "@/domain/yield";
import type { Database } from "@/server/db/client";
import { loadBlocks } from "./availability-service";

/**
 * Offers the calendar makes by itself: looks at the next five weeks of the
 * event rooms (requests, bookings, blocks) and returns the offers of
 * domain/yield.ts for the dates that are still empty.
 */
export async function listYieldOffers(db: Database, now = Date.now()): Promise<YieldOffer[]> {
  const today = todayLocal(now);
  const eventSpaceIds = spaceSeeds.filter((s) => s.bookable && s.active && s.type !== "hotel").map((s) => s.id);
  const range = { start: dayBounds(today).start, end: dayBounds(addDays(today, 35)).end };
  const blocks = await loadBlocks(db, eventSpaceIds, range, now);
  const takenDates = datesOfIntervals(blocks, (ms) => utcToLocal(ms).date);
  return yieldOffers({ today, takenDates });
}
