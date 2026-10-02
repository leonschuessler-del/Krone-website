"use client";

import { BedDouble, CalendarDays, Check, Loader2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { hotelCopy, roomTypeSeeds } from "@/content/hotel";
import { addDays, todayLocal } from "@/domain/time";
import { nightCount, validateStay } from "@/domain/hotel";
import { cn } from "@/lib/cn";
import { formatDateMedium, formatMoney } from "@/lib/format";

interface Availability {
  nights: number;
  issues: string[];
  types: Array<{ id: string; name: string; description: string; maxGuests: number; pricePerNight: number | null; total: number | null; free: number; totalRooms: number }>;
}

/**
 * Hotel booking: arrival/departure → free rooms per type with prices →
 * guest details → request. Rooms are booked individually; the operator
 * confirms (see docs/INTEGRATIONS.md for the DIRS21 channel).
 */
export function HotelBooking({ className }: { className?: string }) {
  const today = todayLocal();
  const [arrival, setArrival] = useState(addDays(today, 7));
  const [departure, setDeparture] = useState(addDays(today, 9));
  const [data, setData] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(false);
  const [typeId, setTypeId] = useState<string>("double");
  const [rooms, setRooms] = useState(1);
  const [guests, setGuests] = useState(2);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ reservationNumber: string; total: number | null } | null>(null);

  const issues = validateStay({ arrival, departure }, today);
  const nights = nightCount(arrival, departure);

  useEffect(() => {
    if (issues.length) {
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/hotel/availability?arrival=${arrival}&departure=${departure}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Availability>) : null))
      .then((d) => d && setData(d))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrival, departure]);

  const type = useMemo(() => data?.types.find((t) => t.id === typeId) ?? null, [data, typeId]);
  const seed = roomTypeSeeds.find((t) => t.id === typeId)!;
  const total = type?.total !== null && type?.total !== undefined ? type.total * rooms : null;
  const maxGuests = seed.maxGuests * rooms;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/hotel/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomTypeId: typeId, arrival, departure, rooms, guests, ...form }),
    });
    const body = (await res.json().catch(() => ({}))) as { reservationNumber?: string; total?: number | null; error?: { message?: string }; message?: string };
    setBusy(false);
    if (!res.ok) return setError(body.error?.message ?? body.message ?? "Die Anfrage konnte nicht gesendet werden.");
    setDone({ reservationNumber: body.reservationNumber ?? "", total: body.total ?? null });
  }

  if (done) {
    return (
      <div className={cn("rounded-[1.5rem] border border-sand bg-white p-7 md:p-9", className)} data-testid="hotel-done">
        <p className="eyebrow">Zimmeranfrage eingegangen</p>
        <h3 className="mt-3 font-serif text-3xl">Vielen Dank, {form.firstName}!</h3>
        <p className="mt-3 text-ink-soft">
          Ihre Reservierungsnummer: <strong className="text-ink">{done.reservationNumber}</strong>. Wir prüfen die Zimmer und bestätigen Ihnen die Reservierung persönlich per E-Mail – in der Regel innerhalb eines Tages.
        </p>
        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-cream p-3 text-sm"><dt className="text-muted">Zimmer</dt><dd className="font-semibold">{rooms} × {seed.name}</dd></div>
          <div className="rounded-xl bg-cream p-3 text-sm"><dt className="text-muted">Aufenthalt</dt><dd className="font-semibold">{formatDateMedium(arrival)} – {formatDateMedium(departure)}</dd></div>
          <div className="rounded-xl bg-cream p-3 text-sm"><dt className="text-muted">Preis inkl. Frühstück</dt><dd className="font-semibold">{formatMoney(done.total, "auf Anfrage")}</dd></div>
        </dl>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-6 lg:grid-cols-[1.4fr_1fr]", className)} data-testid="hotel-booking">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block rounded-2xl border border-sand bg-white p-4">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted"><CalendarDays className="h-3.5 w-3.5" /> Anreise</span>
            <input type="date" min={today} value={arrival} onChange={(e) => { setArrival(e.target.value); if (e.target.value >= departure) setDeparture(addDays(e.target.value, 1)); }} className="mt-2 w-full bg-transparent font-serif text-xl outline-none" data-testid="hotel-arrival" />
          </label>
          <label className="block rounded-2xl border border-sand bg-white p-4">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted"><CalendarDays className="h-3.5 w-3.5" /> Abreise</span>
            <input type="date" min={addDays(arrival, 1)} value={departure} onChange={(e) => setDeparture(e.target.value)} className="mt-2 w-full bg-transparent font-serif text-xl outline-none" data-testid="hotel-departure" />
          </label>
        </div>
        <p className="text-sm text-muted">
          {issues.includes("past") ? "Die Anreise liegt in der Vergangenheit." : issues.includes("order") ? "Die Abreise muss nach der Anreise liegen." : `${nights} ${nights === 1 ? "Nacht" : "Nächte"} · ${hotelCopy.checkIn}`}
        </p>

        <ul className="grid gap-3" aria-label="Zimmertypen">
          {roomTypeSeeds.map((t) => {
            const live = data?.types.find((x) => x.id === t.id);
            const free = live?.free ?? null;
            const soldOut = free !== null && free === 0;
            const on = typeId === t.id;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  disabled={soldOut}
                  onClick={() => { setTypeId(t.id); setRooms(1); setGuests(Math.min(guests, t.maxGuests)); }}
                  aria-pressed={on}
                  className={cn("flex w-full items-center gap-4 rounded-2xl border bg-white p-4 text-left transition-colors", on ? "border-gold ring-2 ring-gold/30" : "border-sand hover:border-ink/30", soldOut && "opacity-50")}
                  data-testid={`room-${t.id}`}
                >
                  <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", on ? "bg-gold text-anthracite" : "bg-cream text-gold-dark")}>{on ? <Check className="h-5 w-5" /> : <BedDouble className="h-5 w-5" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-xl">{t.name}</span>
                    <span className="block text-sm text-ink-soft">{t.description}</span>
                    <span className="mt-1 block text-xs text-muted">
                      {loading ? "Verfügbarkeit wird geprüft …" : free === null ? `bis ${t.maxGuests} ${t.maxGuests === 1 ? "Gast" : "Gäste"}` : soldOut ? "In diesem Zeitraum belegt" : `${free} von ${live!.totalRooms} frei · bis ${t.maxGuests} ${t.maxGuests === 1 ? "Gast" : "Gäste"}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-serif text-2xl tabular-nums">{t.basePricePerNight === null ? "auf Anfrage" : formatMoney(t.basePricePerNight)}</span>
                    {t.basePricePerNight !== null && <span className="block text-xs text-muted">pro Nacht, inkl. Frühstück</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <form onSubmit={submit} className="panel-dark flex flex-col gap-4 rounded-[1.5rem] p-6 text-paper md:p-7" data-testid="hotel-form">
        <p className="eyebrow !text-gold-light">Ihre Reservierung</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="text-paper/70">Zimmer</span>
            <select value={rooms} onChange={(e) => setRooms(Number(e.target.value))} className="mt-1 h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-paper">
              {Array.from({ length: Math.max(1, Math.min(type?.free ?? 1, 8)) }, (_, i) => i + 1).map((n) => <option key={n} value={n} className="text-ink">{n}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="flex items-center gap-1 text-paper/70"><Users className="h-3.5 w-3.5" /> Gäste</span>
            <select value={Math.min(guests, maxGuests)} onChange={(e) => setGuests(Number(e.target.value))} className="mt-1 h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-paper">
              {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => <option key={n} value={n} className="text-ink">{n}</option>)}
            </select>
          </label>
        </div>
        <div className="rounded-xl bg-white/5 p-3 text-sm">
          <div className="flex justify-between"><span className="text-paper/70">{rooms} × {seed.name}</span><span>{nights} {nights === 1 ? "Nacht" : "Nächte"}</span></div>
          <div className="mt-1 flex items-baseline justify-between"><span className="text-paper/70">Gesamt inkl. Frühstück</span><span className="font-serif text-2xl tabular-nums" data-testid="hotel-total">{formatMoney(total, "auf Anfrage")}</span></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input required placeholder="Vorname" autoComplete="given-name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="h-11 rounded-xl border border-white/15 bg-white/5 px-3 placeholder:text-paper/40" />
          <input required placeholder="Nachname" autoComplete="family-name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="h-11 rounded-xl border border-white/15 bg-white/5 px-3 placeholder:text-paper/40" />
        </div>
        <input required type="email" placeholder="E-Mail" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11 rounded-xl border border-white/15 bg-white/5 px-3 placeholder:text-paper/40" />
        <input type="tel" placeholder="Telefon (optional)" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-11 rounded-xl border border-white/15 bg-white/5 px-3 placeholder:text-paper/40" />
        <textarea rows={2} placeholder="Wünsche (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 placeholder:text-paper/40" />
        {error && <p className="rounded-xl bg-danger/20 px-3 py-2 text-sm text-[#f0a79c]" role="alert">{error}</p>}
        <Button type="submit" variant="gold" disabled={busy || issues.length > 0 || (type !== null && type.free === 0)} data-testid="hotel-submit">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Zimmer anfragen
        </Button>
        <p className="text-xs text-paper/55">Unverbindliche Anfrage – wir bestätigen persönlich. Bezahlt wird vor Ort. Mit dem Absenden akzeptieren Sie unsere Datenschutzerklärung.</p>
      </form>
    </div>
  );
}
