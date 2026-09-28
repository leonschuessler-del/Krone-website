import type { BookingStatus } from "@/domain/types";

/** View model of the resource calendar (positions pre-computed on the server in Europe/Berlin). */

export type CalendarBarType = "reserved" | "booked" | "blocked" | "maintenance" | "inquiry";

export interface CalendarDayView {
  date: string;
  weekday: string;
  label: string;
  isToday: boolean;
  isWeekend: boolean;
}

export interface CalendarBarView {
  id: string;
  spaceId: string;
  type: CalendarBarType;
  /** position in day units from the first visible day (0 … days) */
  from: number;
  to: number;
  clippedStart: boolean;
  clippedEnd: boolean;
  lane: number;
  title: string;
  primary: string;
  secondary: string;
  timeLabel: string;
  isDemo: boolean;
  manual: boolean;
  reason: string | null;
  createdBy: string | null;
  bookingId: string | null;
  bookingNumber: string | null;
  bookingStatus: BookingStatus | null;
  expiresLabel: string | null;
}

export interface CalendarSpaceView {
  id: string;
  name: string;
  code: string;
  color: string;
  bookable: boolean;
  inquiryLanes: number;
}
