import type { EngineApi, ReserveResult } from "./types";

/** Live API of the website (src/app/api/hotel). */
export const fetchApi: EngineApi = {
  async availability(arrival, departure, signal) {
    const res = await fetch(`/api/hotel/availability?arrival=${arrival}&departure=${departure}`, { signal });
    if (!res.ok) return null;
    return res.json();
  },
  async reserve(input): Promise<ReserveResult> {
    const { roomNotes, ...rest } = input;
    const notes = [input.notes, ...roomNotes].filter(Boolean).join("\n");
    const res = await fetch("/api/hotel/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rest, notes }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      reservationNumber?: string;
      total?: number | null;
      lines?: Array<{ roomTypeId: string; rooms: number; name: string }>;
      payment?: ReserveResult extends { ok: true; payment: infer P } ? P : never;
      error?: { message?: string };
      message?: string;
    };
    if (!res.ok) return { ok: false, message: body.error?.message ?? body.message ?? "Die Reservierung konnte nicht gesendet werden." };
    return { ok: true, reservationNumber: body.reservationNumber ?? "", total: body.total ?? null, lines: body.lines ?? [], payment: body.payment ?? { provider: "none" } };
  },
};
