import type { RoomTypeSeed } from "@/content/hotel";
import type { AvailabilityType, ReservationPayload } from "@/domain/booking-engine";
import type { PaymentChoice } from "@/content/rates";

/** A room type as the engine shows it: content + resolved pictures. */
export interface EngineRoom extends RoomTypeSeed {
  /** main photo (null → neutral placeholder) */
  photo: string | null;
  /** gallery for the lightbox */
  gallery: Array<{ src: string; alt: string }>;
}

export interface AvailabilityResponse {
  nights: number;
  issues: string[];
  types: AvailabilityType[];
}

export interface ReserveInput extends ReservationPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes: string;
  payment: PaymentChoice;
}

export type ReserveResult =
  | {
      ok: true;
      reservationNumber: string;
      total: number | null;
      lines: Array<{ roomTypeId: string; rooms: number; name: string }>;
      payment: { provider: "none" } | { provider: "demo"; status: "paid" | "guaranteed" } | { provider: "stripe"; checkoutUrl: string };
    }
  | { ok: false; message: string };

/** The engine talks to the world through this – the site uses fetch, the static preview a local stub. */
export interface EngineApi {
  availability(arrival: string, departure: string, signal?: AbortSignal): Promise<AvailabilityResponse | null>;
  reserve(input: ReserveInput): Promise<ReserveResult>;
}

export type Step = "rooms" | "cart" | "checkout" | "done";
