CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"type" text NOT NULL,
	"reason" text,
	"booking_id" uuid,
	"expires_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_extras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"extra_id" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" integer,
	"subtotal" integer
);
--> statement-breakpoint
CREATE TABLE "booking_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"space_id" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"price_model" text,
	"unit_price" integer,
	"quantity" integer DEFAULT 1 NOT NULL,
	"subtotal" integer
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_number" text NOT NULL,
	"inquiry_number" text,
	"kind" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" text NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"rental_mode" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"event_type" text,
	"guest_count" integer,
	"notes" text,
	"subtotal" integer,
	"discount_total" integer DEFAULT 0 NOT NULL,
	"cleaning_fee" integer,
	"extras_total" integer,
	"deposit" integer,
	"total" integer,
	"due_now" integer,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"handover_at" timestamp with time zone,
	"return_at" timestamp with time zone,
	"access_token_hash" text NOT NULL,
	"quote_snapshot" jsonb,
	"accepted_terms" jsonb,
	"is_demo" boolean DEFAULT false NOT NULL,
	"admin_notes" text,
	"reviewed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_booking_number_unique" UNIQUE("booking_number")
);
--> statement-breakpoint
CREATE TABLE "bundle_pricing_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"space_ids" jsonb NOT NULL,
	"match_mode" text DEFAULT 'exact' NOT NULL,
	"adjustment" jsonb,
	"booking_mode" text,
	"is_full_venue" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"company" text,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"street" text NOT NULL,
	"house_number" text NOT NULL,
	"postal_code" text NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"billing_address" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template" text NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"text" text NOT NULL,
	"status" text NOT NULL,
	"provider_id" text,
	"error" text,
	"booking_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extras" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'service' NOT NULL,
	"price_model" text NOT NULL,
	"unit_price" integer,
	"max_quantity" integer DEFAULT 1 NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handover_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"weekdays" jsonb,
	"time" text NOT NULL,
	"label" text,
	"active" boolean DEFAULT true NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hotel_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"customer_id" uuid,
	"room_type_id" text NOT NULL,
	"room_id" text,
	"arrival_date" date NOT NULL,
	"departure_date" date NOT NULL,
	"rooms" integer DEFAULT 1 NOT NULL,
	"guests" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hotel_rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"room_type_id" text NOT NULL,
	"label" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"status" text NOT NULL,
	"provider_ref" text,
	"checkout_url" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"space_id" text NOT NULL,
	"label" text NOT NULL,
	"price_model" text NOT NULL,
	"amount" integer NOT NULL,
	"weekdays" jsonb,
	"valid_from" date,
	"valid_to" date,
	"min_duration_minutes" integer,
	"priority" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"max_guests" integer,
	"base_price_per_night" integer,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" text NOT NULL,
	"label" text NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" text NOT NULL,
	"kind" text NOT NULL,
	"src" text NOT NULL,
	"alt" text NOT NULL,
	"poster_src" text,
	"is_real" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"level" text DEFAULT 'ground-floor' NOT NULL,
	"short_description" text,
	"long_description" text,
	"area_sqm" integer,
	"capacity_standing" integer,
	"capacity_seated" integer,
	"usage_options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"color" text NOT NULL,
	"base_price" integer,
	"price_model" text,
	"deposit" integer,
	"cleaning_fee" integer,
	"minimum_duration_minutes" integer,
	"maximum_duration_minutes" integer,
	"advance_booking_min_hours" integer,
	"advance_booking_max_days" integer,
	"setup_buffer_minutes" integer,
	"cleanup_buffer_minutes" integer,
	"available_for_standalone_rental" boolean DEFAULT true NOT NULL,
	"included_in_full_venue" boolean DEFAULT true NOT NULL,
	"requires" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"incompatible_with" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"booking_mode" text DEFAULT 'both' NOT NULL,
	"bookable" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"needs_verification" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"media_folder" text NOT NULL,
	"weekly_hours" jsonb,
	"polygon_override" jsonb,
	"label_position_override" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_extras" ADD CONSTRAINT "booking_extras_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_extras" ADD CONSTRAINT "booking_extras_extra_id_extras_id_fk" FOREIGN KEY ("extra_id") REFERENCES "public"."extras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_reservations" ADD CONSTRAINT "hotel_reservations_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_reservations" ADD CONSTRAINT "hotel_reservations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_reservations" ADD CONSTRAINT "hotel_reservations_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_reservations" ADD CONSTRAINT "hotel_reservations_room_id_hotel_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."hotel_rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_rooms" ADD CONSTRAINT "hotel_rooms_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_features" ADD CONSTRAINT "space_features_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_media" ADD CONSTRAINT "space_media_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_blocks_space_time_idx" ON "availability_blocks" USING btree ("space_id","start_at","end_at");--> statement-breakpoint
CREATE INDEX "booking_items_booking_idx" ON "booking_items" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_start_idx" ON "bookings" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_ref_idx" ON "payments" USING btree ("provider","provider_ref");--> statement-breakpoint
CREATE INDEX "space_features_space_idx" ON "space_features" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "space_media_space_idx" ON "space_media" USING btree ("space_id");