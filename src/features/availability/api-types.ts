import type { AvailabilityBlockType, RentalMode, SpaceAvailabilityStatus } from "@/domain/types";

/** JSON contracts of the availability API (dates as ISO strings). */

export interface IsoInterval {
  start: string;
  end: string;
}

export interface AvailabilityCheckRequest {
  spaceIds: string[];
  rentalMode: RentalMode;
  date: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  /** Include up to N alternative dates when the request is not bookable. */
  alternatives?: number;
}

export interface SpaceCheckResult {
  spaceId: string;
  name: string;
  status: SpaceAvailabilityStatus;
  /** true if the requested time range (or – without times – any part of the day) is free */
  available: boolean;
  /** Free windows on the requested day(s), within bookable hours. */
  freeIntervals: IsoInterval[];
  conflicts: Array<IsoInterval & { type: AvailabilityBlockType }>;
  reason: string | null;
}

export interface AlternativeSlot {
  date: string;
  start: string;
  end: string;
  label: string;
}

export interface AvailabilityCheckResponse {
  requested: {
    date: string;
    endDate: string | null;
    rentalMode: RentalMode;
    start: string | null;
    end: string | null;
    hasTimeRange: boolean;
  };
  bookingAllowed: boolean;
  spaces: SpaceCheckResult[];
  availableSpaceIds: string[];
  blockedSpaces: Array<{ spaceId: string; name: string; reason: string }>;
  commonFreeIntervals: IsoInterval[];
  summary: { total: number; available: number; message: string };
  selectionIssues: string[];
  alternatives: AlternativeSlot[];
  demo: boolean;
}

export interface CalendarDay {
  date: string;
  /** Status of the selection as a whole (intersection). */
  status: SpaceAvailabilityStatus;
  perSpace: Record<string, SpaceAvailabilityStatus>;
  /** Longest common free window in minutes (for the whole selection). */
  commonFreeMinutes: number;
}

export interface AvailabilityCalendarResponse {
  from: string;
  to: string;
  spaceIds: string[];
  days: CalendarDay[];
}
