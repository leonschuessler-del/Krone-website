-- A room request may contain several room types (e.g. 1 × Einzelzimmer + 2 × Doppelzimmer):
-- one row per type, all sharing the reservation number.
DROP INDEX IF EXISTS "hotel_reservations_number_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hotel_reservations_number_idx" ON "hotel_reservations" ("reservation_number");
