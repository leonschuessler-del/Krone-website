-- Online payment of room reservations (Stripe prepared): status on the reservation,
-- one row per payment attempt in hotel_payments.
ALTER TABLE "hotel_reservations" ADD COLUMN IF NOT EXISTS "payment_status" text NOT NULL DEFAULT 'unpaid';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hotel_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reservation_number" text NOT NULL,
  "provider" text NOT NULL,
  "kind" text NOT NULL,
  "amount" integer NOT NULL,
  "currency" text DEFAULT 'EUR' NOT NULL,
  "status" text NOT NULL,
  "provider_ref" text,
  "intent_ref" text,
  "checkout_url" text,
  "raw" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hotel_payments_reservation_idx" ON "hotel_payments" ("reservation_number");
