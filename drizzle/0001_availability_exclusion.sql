-- ============================================================================
-- Double-booking protection (race-condition safe)
-- ----------------------------------------------------------------------------
-- No two ACTIVE availability blocks of the SAME space may overlap in time.
-- This is enforced by PostgreSQL itself (GiST exclusion constraint), so even
-- two perfectly simultaneous checkouts cannot both succeed: the second
-- INSERT fails with SQLSTATE 23P01 (exclusion_violation) and its whole
-- transaction (booking + items + blocks) is rolled back.
--
-- Ranges are half-open [start, end): a block ending at 18:00 and another one
-- starting at 18:00 do not conflict.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "availability_blocks"
  ADD CONSTRAINT "availability_blocks_valid_range" CHECK ("end_at" > "start_at");
--> statement-breakpoint
ALTER TABLE "availability_blocks"
  ADD CONSTRAINT "availability_blocks_no_overlap"
  EXCLUDE USING gist (
    "space_id" WITH =,
    tstzrange("start_at", "end_at", '[)') WITH &&
  ) WHERE ("active");
--> statement-breakpoint
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_valid_range" CHECK ("end_at" > "start_at");
