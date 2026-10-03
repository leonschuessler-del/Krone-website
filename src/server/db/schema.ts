import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { WeeklyHours } from "@/domain/availability";
import type { BundleAdjustment } from "@/domain/pricing";
import type { Point } from "@/domain/types";

/**
 * Database schema (PostgreSQL). Conventions:
 *  - money: integer cents; NULL = unknown (never 0 for unknown)
 *  - timestamps: timestamptz (UTC instants); local dates as `date`
 *  - public references use human-readable numbers (KR-2026-XXXXX) plus a
 *    random access token – never raw database ids.
 *
 * Double-booking protection: see migration `0001_availability_exclusion.sql`
 * (btree_gist EXCLUDE constraint on availability_blocks).
 */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

// ---------------------------------------------------------------------------
// Spaces
// ---------------------------------------------------------------------------
export const spaces = pgTable("spaces", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  type: text("type").$type<"indoor" | "outdoor" | "hotel" | "service">().notNull(),
  level: text("level").notNull().default("ground-floor"),
  shortDescription: text("short_description"),
  longDescription: text("long_description"),
  areaSqm: integer("area_sqm"),
  capacityStanding: integer("capacity_standing"),
  capacitySeated: integer("capacity_seated"),
  usageOptions: jsonb("usage_options").$type<string[]>().notNull().default([]),
  rules: jsonb("rules").$type<string[]>().notNull().default([]),
  color: text("color").notNull(),
  basePrice: integer("base_price"),
  priceModel: text("price_model").$type<"hourly" | "daily" | "flat" | "on_request">(),
  deposit: integer("deposit"),
  cleaningFee: integer("cleaning_fee"),
  minimumDurationMinutes: integer("minimum_duration_minutes"),
  maximumDurationMinutes: integer("maximum_duration_minutes"),
  advanceBookingMinHours: integer("advance_booking_min_hours"),
  advanceBookingMaxDays: integer("advance_booking_max_days"),
  setupBufferMinutes: integer("setup_buffer_minutes"),
  cleanupBufferMinutes: integer("cleanup_buffer_minutes"),
  availableForStandaloneRental: boolean("available_for_standalone_rental").notNull().default(true),
  includedInFullVenue: boolean("included_in_full_venue").notNull().default(true),
  requires: jsonb("requires").$type<string[]>().notNull().default([]),
  incompatibleWith: jsonb("incompatible_with").$type<string[]>().notNull().default([]),
  bookingMode: text("booking_mode").$type<"inquiry" | "instant" | "both">().notNull().default("both"),
  bookable: boolean("bookable").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  needsVerification: jsonb("needs_verification").$type<string[]>().notNull().default([]),
  mediaFolder: text("media_folder").notNull(),
  /** Per-space bookable hours; NULL = use venue default (settings.bookableHours) */
  weeklyHours: jsonb("weekly_hours").$type<WeeklyHours>(),
  /** Map editor overrides; NULL = use src/config/floorplan.ts */
  polygonOverride: jsonb("polygon_override").$type<Point[]>(),
  labelPositionOverride: jsonb("label_position_override").$type<{ x: number; y: number }>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const spaceFeatures = pgTable(
  "space_features",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: text("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    confirmed: boolean("confirmed").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("space_features_space_idx").on(t.spaceId)],
);

export const spaceMedia = pgTable(
  "space_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: text("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"image" | "video">().notNull(),
    src: text("src").notNull(),
    alt: text("alt").notNull(),
    posterSrc: text("poster_src"),
    isReal: boolean("is_real").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("space_media_space_idx").on(t.spaceId)],
);

// ---------------------------------------------------------------------------
// Customers & bookings
// ---------------------------------------------------------------------------
export interface BillingAddress {
  name: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
}

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    company: text("company"),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    street: text("street").notNull(),
    houseNumber: text("house_number").notNull(),
    postalCode: text("postal_code").notNull(),
    city: text("city").notNull(),
    country: text("country").notNull(),
    billingAddress: jsonb("billing_address").$type<BillingAddress>(),
    createdAt: createdAt(),
  },
  (t) => [index("customers_email_idx").on(t.email)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingNumber: text("booking_number").notNull().unique(),
    /** Original inquiry number when an inquiry was converted into a booking. */
    inquiryNumber: text("inquiry_number"),
    kind: text("kind").$type<"booking" | "inquiry">().notNull(),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    status: text("status").$type<"draft" | "inquiry" | "pending" | "reserved" | "confirmed" | "cancelled" | "completed">().notNull(),
    paymentStatus: text("payment_status")
      .$type<"unpaid" | "pending" | "deposit_required" | "deposit_paid" | "paid" | "partially_refunded" | "refunded" | "failed">()
      .notNull()
      .default("unpaid"),
    rentalMode: text("rental_mode").$type<"hourly" | "daily">().notNull(),
    startAt: ts("start_at").notNull(),
    endAt: ts("end_at").notNull(),
    eventType: text("event_type"),
    guestCount: integer("guest_count"),
    notes: text("notes"),
    subtotal: integer("subtotal"),
    discountTotal: integer("discount_total").notNull().default(0),
    cleaningFee: integer("cleaning_fee"),
    extrasTotal: integer("extras_total"),
    deposit: integer("deposit"),
    total: integer("total"),
    dueNow: integer("due_now"),
    currency: text("currency").notNull().default("EUR"),
    handoverAt: ts("handover_at"),
    returnAt: ts("return_at"),
    /** sha256 of the random access token sent to the customer */
    accessTokenHash: text("access_token_hash").notNull(),
    quoteSnapshot: jsonb("quote_snapshot"),
    acceptedTerms: jsonb("accepted_terms").$type<Record<string, string>>(),
    isDemo: boolean("is_demo").notNull().default(false),
    adminNotes: text("admin_notes"),
    reviewedAt: ts("reviewed_at"),
    cancelledAt: ts("cancelled_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("bookings_status_idx").on(t.status), index("bookings_start_idx").on(t.startAt)],
);

export const bookingItems = pgTable(
  "booking_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    spaceId: text("space_id").notNull().references(() => spaces.id),
    startAt: ts("start_at").notNull(),
    endAt: ts("end_at").notNull(),
    priceModel: text("price_model"),
    unitPrice: integer("unit_price"),
    quantity: integer("quantity").notNull().default(1),
    subtotal: integer("subtotal"),
  },
  (t) => [index("booking_items_booking_idx").on(t.bookingId)],
);

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------
export const availabilityBlocks = pgTable(
  "availability_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: text("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
    /** Effective blocked range including setup/cleanup buffers */
    startAt: ts("start_at").notNull(),
    endAt: ts("end_at").notNull(),
    type: text("type").$type<"reserved" | "booked" | "blocked" | "maintenance">().notNull(),
    reason: text("reason"),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
    /** Temporary holds expire (checkout holds). NULL = permanent */
    expiresAt: ts("expires_at"),
    /** Inactive blocks are ignored by the exclusion constraint (cancelled / expired / released) */
    active: boolean("active").notNull().default(true),
    isDemo: boolean("is_demo").notNull().default(false),
    createdBy: text("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("availability_blocks_space_time_idx").on(t.spaceId, t.startAt, t.endAt)],
);

// ---------------------------------------------------------------------------
// Pricing & extras
// ---------------------------------------------------------------------------
export const pricingRules = pgTable("pricing_rules", {
  id: text("id").primaryKey(),
  spaceId: text("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  priceModel: text("price_model").$type<"hourly" | "daily" | "flat">().notNull(),
  amount: integer("amount").notNull(),
  weekdays: jsonb("weekdays").$type<number[]>(),
  validFrom: date("valid_from", { mode: "string" }),
  validTo: date("valid_to", { mode: "string" }),
  minDurationMinutes: integer("min_duration_minutes"),
  priority: integer("priority").notNull().default(0),
  active: boolean("active").notNull().default(true),
  isDemo: boolean("is_demo").notNull().default(false),
});

export const bundlePricingRules = pgTable("bundle_pricing_rules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  spaceIds: jsonb("space_ids").$type<string[]>().notNull(),
  matchMode: text("match_mode").$type<"exact" | "subset">().notNull().default("exact"),
  adjustment: jsonb("adjustment").$type<BundleAdjustment>(),
  bookingMode: text("booking_mode").$type<"inquiry" | "instant" | "both">(),
  isFullVenue: boolean("is_full_venue").notNull().default(false),
  priority: integer("priority").notNull().default(0),
  active: boolean("active").notNull().default(true),
  isDemo: boolean("is_demo").notNull().default(false),
});

export const extras = pgTable("extras", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("service"),
  priceModel: text("price_model").$type<"flat" | "per_hour" | "per_day" | "per_person" | "per_unit" | "on_request">().notNull(),
  unitPrice: integer("unit_price"),
  maxQuantity: integer("max_quantity").notNull().default(1),
  /** Only confirmed extras are offered in production (DEMO_MODE=false). */
  confirmed: boolean("confirmed").notNull().default(false),
  active: boolean("active").notNull().default(true),
  isDemo: boolean("is_demo").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const bookingExtras = pgTable("booking_extras", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  extraId: text("extra_id").notNull().references(() => extras.id),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unit_price"),
  subtotal: integer("subtotal"),
});

// ---------------------------------------------------------------------------
// Handover, payments, settings
// ---------------------------------------------------------------------------
export const handoverSlots = pgTable("handover_slots", {
  id: text("id").primaryKey(),
  kind: text("kind").$type<"handover" | "return">().notNull(),
  /** ISO weekdays; NULL = every day */
  weekdays: jsonb("weekdays").$type<number[]>(),
  time: text("time").notNull(),
  label: text("label"),
  active: boolean("active").notNull().default(true),
  isDemo: boolean("is_demo").notNull().default(false),
});

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    provider: text("provider").$type<"demo" | "stripe" | "manual">().notNull(),
    /** rent: rental amount; down_payment: Anzahlung; security_deposit: Kaution (not revenue) */
    kind: text("kind").$type<"rent" | "down_payment" | "security_deposit">().notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("EUR"),
    status: text("status").$type<"pending" | "succeeded" | "failed" | "cancelled" | "refunded" | "partially_refunded">().notNull(),
    providerRef: text("provider_ref"),
    checkoutUrl: text("checkout_url"),
    raw: jsonb("raw"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("payments_booking_idx").on(t.bookingId), uniqueIndex("payments_provider_ref_idx").on(t.provider, t.providerRef)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------------------
// Admin, e-mail, contact, audit
// ---------------------------------------------------------------------------
export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<"owner" | "staff">().notNull().default("owner"),
  lastLoginAt: ts("last_login_at"),
  createdAt: createdAt(),
});

export const emailLog = pgTable("email_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  template: text("template").notNull(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  text: text("text").notNull(),
  status: text("status").$type<"preview" | "sent" | "failed">().notNull(),
  providerId: text("provider_id"),
  error: text("error"),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const contactMessages = pgTable("contact_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  handledAt: ts("handled_at"),
  createdAt: createdAt(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  data: jsonb("data"),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Hotel (prepared – separate booking logic from event spaces)
// ---------------------------------------------------------------------------
export const roomTypes = pgTable("room_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  maxGuests: integer("max_guests"),
  basePricePerNight: integer("base_price_per_night"),
  active: boolean("active").notNull().default(true),
  /** room types sharing one physical inventory (Doppelzimmer / zur Einzelnutzung) */
  inventoryGroup: text("inventory_group"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const hotelRooms = pgTable("hotel_rooms", {
  id: text("id").primaryKey(),
  roomTypeId: text("room_type_id").notNull().references(() => roomTypes.id),
  label: text("label").notNull(),
  active: boolean("active").notNull().default(true),
});

export const hotelReservations = pgTable("hotel_reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  customerId: uuid("customer_id").references(() => customers.id),
  roomTypeId: text("room_type_id").notNull().references(() => roomTypes.id),
  roomId: text("room_id").references(() => hotelRooms.id),
  arrivalDate: date("arrival_date", { mode: "string" }).notNull(),
  departureDate: date("departure_date", { mode: "string" }).notNull(),
  rooms: integer("rooms").notNull().default(1),
  guests: integer("guests").notNull().default(1),
  status: text("status").$type<"requested" | "confirmed" | "cancelled">().notNull().default("requested"),
  reservationNumber: text("reservation_number"),
  /** cents, null = on request */
  totalPrice: integer("total_price"),
  notes: text("notes"),
  /** id at the channel manager (DIRS21) once synced */
  channelRef: text("channel_ref"),
  declineReason: text("decline_reason"),
  /** unpaid = pay at the hotel; pending → paid/guaranteed set by the payment provider webhook */
  paymentStatus: text("payment_status").$type<"unpaid" | "pending" | "paid" | "guaranteed" | "failed" | "refunded">().notNull().default("unpaid"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Online payments of room reservations (docs/ZAHLUNG.md). One row per attempt;
 * `kind` full = the stay is paid now, guarantee = a card is stored (Stripe
 * SetupIntent) and only charged for a no-show or a late cancellation.
 */
export const hotelPayments = pgTable(
  "hotel_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reservationNumber: text("reservation_number").notNull(),
    provider: text("provider").$type<"demo" | "stripe">().notNull(),
    /** full = stay paid now, guarantee = card stored, fee = no-show / late-cancellation charge on the stored card */
    kind: text("kind").$type<"full" | "guarantee" | "fee">().notNull(),
    /** cents; 0 for a guarantee */
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("EUR"),
    status: text("status").$type<"pending" | "succeeded" | "failed" | "refunded">().notNull(),
    /** Stripe checkout session id */
    providerRef: text("provider_ref"),
    /** Stripe payment_intent / setup_intent id once known */
    intentRef: text("intent_ref"),
    checkoutUrl: text("checkout_url"),
    raw: jsonb("raw"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("hotel_payments_reservation_idx").on(t.reservationNumber)],
);

export type SpaceRow = typeof spaces.$inferSelect;
export type BookingRow = typeof bookings.$inferSelect;
export type AvailabilityBlockRow = typeof availabilityBlocks.$inferSelect;
