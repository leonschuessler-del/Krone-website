import type { LocalDate } from "@/domain/time";

/**
 * Channel connection for the hotel rooms.
 *
 * `HotelChannel` is the whole surface the website needs from a channel
 * manager: ask for free rooms, create a reservation, cancel it. The website
 * keeps its own reservations either way; the channel is informed in addition.
 *
 *  - LocalChannel: nothing configured → the website is the only system.
 *  - Dirs21Channel: DIRS21 (dirs21.de). Configure DIRS21_ENDPOINT,
 *    DIRS21_HOTEL_ID, DIRS21_API_KEY and DIRS21_ROOM_MAP (our room type id →
 *    DIRS21 category code, e.g. "double=DZ,double-single=DZE,single=EZ,apartment=APP").
 *    The request/response shapes below follow DIRS21's partner interface in
 *    outline; the exact field names are confirmed against the documentation
 *    DIRS21 provides with the access data (marked TODO). A channel error never
 *    blocks a reservation on the website – it is logged and shown in the admin.
 */

export interface ChannelStay {
  roomTypeId: string;
  arrival: LocalDate;
  departure: LocalDate;
  rooms: number;
  guests: number;
}

export interface ChannelReservation extends ChannelStay {
  /** our reservation id (used as idempotency key) */
  id: string;
  reservationNumber: string;
  guest: { firstName: string; lastName: string; email: string; phone?: string | null };
  notes?: string | null;
}

export type ChannelResult = { ok: true; ref: string | null } | { ok: false; error: string };

export interface HotelChannel {
  readonly name: "local" | "dirs21";
  /** free rooms according to the channel, or null when the channel does not know */
  availability(stay: Omit<ChannelStay, "rooms" | "guests">): Promise<number | null>;
  create(reservation: ChannelReservation): Promise<ChannelResult>;
  cancel(reservationId: string, channelRef: string | null): Promise<ChannelResult>;
}

class LocalChannel implements HotelChannel {
  readonly name = "local" as const;
  async availability() {
    return null;
  }
  async create(): Promise<ChannelResult> {
    return { ok: true, ref: null };
  }
  async cancel(): Promise<ChannelResult> {
    return { ok: true, ref: null };
  }
}

interface Dirs21Config {
  endpoint: string;
  hotelId: string;
  apiKey: string;
  roomMap: Record<string, string>;
}

export function dirs21Config(): Dirs21Config | null {
  const endpoint = process.env.DIRS21_ENDPOINT?.trim();
  const hotelId = process.env.DIRS21_HOTEL_ID?.trim();
  const apiKey = process.env.DIRS21_API_KEY;
  if (!endpoint || !hotelId || !apiKey) return null;
  const roomMap: Record<string, string> = {};
  for (const pair of (process.env.DIRS21_ROOM_MAP ?? "").split(",")) {
    const [ours, theirs] = pair.split("=").map((s) => s?.trim());
    if (ours && theirs) roomMap[ours] = theirs;
  }
  return { endpoint: endpoint.replace(/\/$/, ""), hotelId, apiKey, roomMap };
}

class Dirs21Channel implements HotelChannel {
  readonly name = "dirs21" as const;
  constructor(private cfg: Dirs21Config) {}

  private async call<T>(path: string, method: "GET" | "POST" | "DELETE", body?: unknown): Promise<T> {
    const res = await fetch(`${this.cfg.endpoint}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.cfg.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`DIRS21 HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  private category(roomTypeId: string) {
    return this.cfg.roomMap[roomTypeId] ?? roomTypeId;
  }

  async availability(stay: Omit<ChannelStay, "rooms" | "guests">): Promise<number | null> {
    try {
      // TODO(DIRS21): confirm path and fields with the partner documentation
      const data = await this.call<{ available?: number }>(
        `/hotels/${this.cfg.hotelId}/availability?category=${encodeURIComponent(this.category(stay.roomTypeId))}&from=${stay.arrival}&to=${stay.departure}`,
        "GET",
      );
      return typeof data.available === "number" ? data.available : null;
    } catch {
      return null;
    }
  }

  async create(r: ChannelReservation): Promise<ChannelResult> {
    try {
      // TODO(DIRS21): confirm payload with the partner documentation
      const data = await this.call<{ id?: string }>(`/hotels/${this.cfg.hotelId}/reservations`, "POST", {
        externalId: r.id,
        reservationNumber: r.reservationNumber,
        category: this.category(r.roomTypeId),
        arrival: r.arrival,
        departure: r.departure,
        rooms: r.rooms,
        guests: r.guests,
        guest: r.guest,
        notes: r.notes ?? undefined,
      });
      return { ok: true, ref: data.id ?? null };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async cancel(reservationId: string, channelRef: string | null): Promise<ChannelResult> {
    try {
      await this.call(`/hotels/${this.cfg.hotelId}/reservations/${encodeURIComponent(channelRef ?? reservationId)}`, "DELETE");
      return { ok: true, ref: channelRef };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export function hotelChannel(): HotelChannel {
  const cfg = dirs21Config();
  return cfg ? new Dirs21Channel(cfg) : new LocalChannel();
}
