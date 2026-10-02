-- Hotel rooms are booked individually: reservation number, price, notes, channel reference.
ALTER TABLE "hotel_reservations" ADD COLUMN IF NOT EXISTS "reservation_number" text;
--> statement-breakpoint
ALTER TABLE "hotel_reservations" ADD COLUMN IF NOT EXISTS "total_price" integer;
--> statement-breakpoint
ALTER TABLE "hotel_reservations" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "hotel_reservations" ADD COLUMN IF NOT EXISTS "channel_ref" text;
--> statement-breakpoint
ALTER TABLE "hotel_reservations" ADD COLUMN IF NOT EXISTS "decline_reason" text;
--> statement-breakpoint
ALTER TABLE "hotel_reservations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hotel_reservations_number_idx" ON "hotel_reservations" ("reservation_number");
--> statement-breakpoint
ALTER TABLE "room_types" ADD COLUMN IF NOT EXISTS "inventory_group" text;
--> statement-breakpoint
ALTER TABLE "room_types" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;
