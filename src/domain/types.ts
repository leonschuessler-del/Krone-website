/**
 * Core domain types – shared by server, client and tests.
 * Business logic lives in `src/domain/*` (pure functions, no I/O) and
 * `src/server/services/*` (I/O). UI components never contain business rules.
 *
 * Money is always stored in integer cents. `null` always means "unknown /
 * not yet provided" – never use 0 for unknown values.
 */

export type SpaceId = string;

export type SpaceType = "indoor" | "outdoor" | "hotel" | "service";
export type LevelId = "ground-floor" | "first-floor" | "outdoor" | "site";
export type BookingMode = "inquiry" | "instant" | "both";
export type PriceModel = "hourly" | "daily" | "flat" | "on_request";

/** Normalised polygon point in the map's viewBox coordinate system. */
export type Point = readonly [x: number, y: number];

export interface MediaAsset {
  src: string;
  alt: string;
  /** true = real, verified photo/video of Zur Krone. false = placeholder / demo. */
  isReal: boolean;
  width?: number;
  height?: number;
  poster?: string;
}

export interface Space {
  id: SpaceId;
  slug: string;
  code: string;
  name: string;
  type: SpaceType;
  level: LevelId;
  shortDescription: string | null;
  longDescription: string | null;
  areaSqm: number | null;
  capacityStanding: number | null;
  capacitySeated: number | null;
  features: string[];
  usageOptions: string[];
  rules: string[];
  images: MediaAsset[];
  videos: MediaAsset[];
  color: string;
  /** Base price in cents. null = unknown ("Preis folgt"). */
  basePrice: number | null;
  priceModel: PriceModel | null;
  /** Deposit (Kaution) in cents. null = unknown. */
  deposit: number | null;
  /** Cleaning fee in cents. null = unknown. */
  cleaningFee: number | null;
  minimumDurationMinutes: number | null;
  maximumDurationMinutes: number | null;
  advanceBookingMinHours: number | null;
  advanceBookingMaxDays: number | null;
  setupBufferMinutes: number | null;
  cleanupBufferMinutes: number | null;
  availableForStandaloneRental: boolean;
  includedInFullVenue: boolean;
  /** Space ids that must be booked together with this space. */
  requires: SpaceId[];
  /** Space ids that cannot be booked together with this space. */
  incompatibleWith: SpaceId[];
  bookingMode: BookingMode;
  /** false = shown as information only (e.g. hotel before room logic exists). */
  bookable: boolean;
  sortOrder: number;
  active: boolean;
  /** Field names whose values still need confirmation by the operator. */
  needsVerification: string[];
}

export type AvailabilityBlockType = "reserved" | "booked" | "blocked" | "maintenance";

export interface AvailabilityBlock {
  id: string;
  spaceId: SpaceId;
  /** Effective blocked range (UTC epoch ms), including buffers where applicable. */
  start: number;
  end: number;
  type: AvailabilityBlockType;
  reason: string | null;
  bookingId: string | null;
  /** Holds expire automatically (epoch ms). null = no expiry. */
  expiresAt: number | null;
  isDemo: boolean;
}

/** Status shown to users per space and time range. */
export type SpaceAvailabilityStatus =
  | "available"
  | "partially_available"
  | "reserved"
  | "booked"
  | "blocked"
  | "closed"
  | "unknown";

export type BookingStatus =
  | "draft"
  | "inquiry"
  | "pending"
  | "reserved"
  | "confirmed"
  | "cancelled"
  | "completed";

export type PaymentStatus =
  | "unpaid"
  | "pending"
  | "deposit_required"
  | "deposit_paid"
  | "paid"
  | "partially_refunded"
  | "refunded"
  | "failed";

export type BookingKind = "booking" | "inquiry";

export type RentalMode = "hourly" | "daily";

export interface Interval {
  /** UTC epoch milliseconds, inclusive */
  start: number;
  /** UTC epoch milliseconds, exclusive */
  end: number;
}
