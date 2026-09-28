import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { availabilityBlocks, bookings } from "@/server/db/schema";

/**
 * Temporary holds ("Reservierungen auf Zeit").
 *
 * A hold is an availability block of type `reserved` with `expires_at`.
 * While active it is protected by the same exclusion constraint as real
 * bookings. Expired holds are ignored by the availability engine immediately
 * and are deactivated lazily (before every booking transaction) or by the
 * cron endpoint /api/cron/release-holds.
 */
export async function releaseExpiredHolds(db: Database, spaceIds?: string[], now = new Date()): Promise<number> {
  const where = and(
    eq(availabilityBlocks.active, true),
    isNotNull(availabilityBlocks.expiresAt),
    lt(availabilityBlocks.expiresAt, now),
    spaceIds && spaceIds.length ? inArray(availabilityBlocks.spaceId, spaceIds) : undefined,
  );
  const released = await db.update(availabilityBlocks).set({ active: false }).where(where).returning({ bookingId: availabilityBlocks.bookingId });

  // Pending (unpaid) bookings whose hold expired are cancelled.
  const bookingIds = Array.from(new Set(released.map((r) => r.bookingId).filter((id): id is string => Boolean(id))));
  if (bookingIds.length) {
    await db
      .update(bookings)
      .set({ status: "cancelled", cancelledAt: now, adminNotes: "Reservierung abgelaufen (Zahlung nicht abgeschlossen)", updatedAt: now })
      .where(and(inArray(bookings.id, bookingIds), eq(bookings.status, "pending")));
  }
  return released.length;
}
