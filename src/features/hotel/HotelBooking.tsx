"use client";

import { BedDouble, CalendarDays, Loader2, Minus, Plus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FLOOR_ROOMS_SUM, hotelCopy, LONG_STAY_NIGHTS, LONG_STAY_PERCENT, roomInventory, roomTypeSeeds } from "@/content/hotel";
import { nightCount, stayNudges, stayQuote, validateItems, validateStay, type StayItem } from "@/domain/hotel";
import { addDays, todayLocal, type LocalDate } from "@/domain/time";
import { cn } from "@/lib/cn";
import { formatDateMedium, formatMoney } from "@/lib/format";
import { StayCalendar } from "./StayCalendar";

interface Availability {
  nights: number;
  issues: string[];
  types: Array<{ id: string; name: string; description: string; maxGuests: number; pricePerNight: number | null; total: number | null; free: number; totalRooms: number; fullNights: string[] }>;
}

const emptyItems = (): Record<string, number> => Object.fromEntries(roomTypeSeeds.map((t) => [t.id, 0]));

/**
 * Hotel booking like on the big portals: arrival and departure in a calendar,
 * then how many rooms of each type (1 × Einzelzimmer + 2 × Doppelzimmer …),
 * guests, contact → request. The operator confirms (docs/INTEGRATIONS.md).
 */
export function HotelBooking({ className }: { className?: string }) {
  const today = todayLocal();
  const [arrival, setArrival] = useState<LocalDate | null>(addDays(today, 7));
  const [departure, setDeparture] = useState<LocalDate | null>(addDays(today, 9));
  const [data, setData] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>(() => ({ ...emptyItems(), double: 1 }));
  const [guests, setGuests] = useState(2);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ reservationNumber: string; total: number | null; lines: Array<{ rooms: number; name: string }> } | null>(null);

  const stay = arrival && departure ? { arrival, departure } : null;
  const issues = stay ? validateStay(stay, today) : [];
  const nights = stay ? nightCount(stay.arrival, stay.departure) : 0;

  useEffect(() => {
    const a = arrival ?? today;
    const d = departure ?? addDays(a, 1);
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/hotel/availability?arrival=${a}&departure=${d}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Availability>) : null))
      .then((x) => x && setData(x))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrival, departure]);

  /** nights where no room of any type is free – struck through in the calendar */
  const fullNights = useMemo(() => {
    if (!data) return new Set<string>();
    const sets = data.types.filter((t) => t.id !== "floor").map((t) => new Set(t.fullNights));
    const first = sets[0] ?? new Set<string>();
    return new Set([...first].filter((n) => sets.every((s) => s.has(n))));
  }, [data]);

  const items: StayItem[] = roomTypeSeeds.map((t) => ({ roomTypeId: t.id, rooms: counts[t.id] ?? 0 })).filter((i) => i.rooms > 0);
  const itemIssues = validateItems(items);
  const quote = stay ? stayQuote(items, stay) : null;
  const maxGuests = Math.max(1, quote?.maxGuests ?? 1);
  const nudges = stay && !issues.length && items.length ? stayNudges(items, stay, guests) : [];
  const shortfall = quote ? items.filter((i) => (data?.types.find((t) => t.id === i.roomTypeId)?.free ?? 99) < i.rooms) : [];

  function setCount(id: string, n: number) {
    const type = roomTypeSeeds.find((t) => t.id === id)!;
    const live = data?.types.find((t) => t.id === id);
    const max = Math.min(roomInventory[type.inventoryGroup] ?? 1, live?.free ?? 8);
    const next = Math.max(0, Math.min(n, max));
    setCounts((c) => {
      const out = { ...c, [id]: next };
      // the whole floor contains every room – it never mixes with single rooms
      if (id === "floor" && next > 0) for (const t of roomTypeSeeds) if (t.id !== "floor") out[t.id] = 0;
      if (id !== "floor" && next > 0) out.floor = 0;
      return out;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stay) return setError("Bitte wählen Sie An- und Abreise im Kalender.");
    if (!items.length) return setError("Bitte wählen Sie mindestens ein Zimmer.");
    setBusy(true);
    setError(null);
    const res = await fetch("/api/hotel/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, arrival: stay.arrival, departure: stay.departure, guests: Math.min(guests, maxGuests), ...form }),
    });
    const body = (await res.json().catch(() => ({}))) as { reservationNumber?: string; total?: number | null; lines?: Array<{ rooms: number; name: string }>; error?: { message?: string }; message?: string };
    setBusy(false);
    if (!res.ok) return setError(body.error?.message ?? body.message ?? "Die Anfrage konnte nicht gesendet werden.");
    setDone({ reservationNumber: body.reservationNumber ?? "", total: body.total ?? null, lines: body.lines ?? [] });
  }

  if (done && stay) {
    return (
      <div className={cn("rounded-[1.5rem] border border-sand bg-white p-7 md:p-9", className)} data-testid="hotel-done">
        <p className="eyebrow">Zimmeranfrage eingegangen</p>
        <h3 className="mt-3 font-serif text-3xl">Vielen Dank, {form.firstName}!</h3>
        <p className="mt-3 text-ink-soft">
          Ihre Reservierungsnummer: <strong className="text-ink">{done.reservationNumber}</strong>. Wir prüfen die Zimmer und bestätigen Ihnen die Reservierung persönlich per E-Mail – in der Regel innerhalb eines Tages.
        </p>
        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-cream p-3 text-sm"><dt className="text-muted">Zimmer</dt><dd className="font-semibold">{done.lines.map((l) => `${l.rooms} × ${l.name}`).join(", ")}</dd></div>
          <div className="rounded-xl bg-cream p-3 text-sm"><dt className="text-muted">Aufenthalt</dt><dd className="font-semibold">{formatDateMedium(stay.arrival)} – {formatDateMedium(stay.departure)} · {nights} {nights === 1 ? "Nacht" : "Nächte"}</dd></div>
          <div className="rounded-xl bg-cream p-3 text-sm"><dt className="text-muted">Preis inkl. Frühstück</dt><dd className="font-semibold">{formatMoney(done.total, "auf Anfrage")}</dd></div>
        </dl>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-6 lg:grid-cols-[1.4fr_1fr]", className)} data-testid="hotel-booking">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2" data-testid="hotel-dates">
          <div className={cn("rounded-2xl border bg-white p-4", arrival && !departure ? "border-sand" : "border-gold")}>
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted"><CalendarDays className="h-3.5 w-3.5" /> Anreise</span>
            <p className="mt-2 font-serif text-xl" data-testid="hotel-arrival">{arrival ? formatDateMedium(arrival) : "–"}</p>
          </div>
          <div className={cn("rounded-2xl border bg-white p-4", arrival && !departure ? "border-gold" : "border-sand")}>
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted"><CalendarDays className="h-3.5 w-3.5" /> Abreise</span>
            <p className="mt-2 font-serif text-xl" data-testid="hotel-departure">{departure ? formatDateMedium(departure) : "–"}</p>
          </div>
        </div>
        <StayCalendar arrival={arrival} departure={departure} fullNights={fullNights} onChange={(n) => { setArrival(n.arrival); setDeparture(n.departure); }} />
        <p className="text-sm text-muted">
          {!stay ? "Tippen Sie im Kalender zuerst auf die Anreise, dann auf die Abreise." : issues.includes("past") ? "Die Anreise liegt in der Vergangenheit." : `${nights} ${nights === 1 ? "Nacht" : "Nächte"} · ${hotelCopy.checkIn}`}
        </p>

        <ul className="grid gap-3" aria-label="Zimmer wählen">
          {roomTypeSeeds.map((t) => {
            const live = data?.types.find((x) => x.id === t.id);
            const free = live?.free ?? null;
            const soldOut = free !== null && free === 0;
            const n = counts[t.id] ?? 0;
            const max = Math.min(roomInventory[t.inventoryGroup] ?? 1, free ?? 8);
            return (
              <li key={t.id} className={cn("flex items-center gap-4 rounded-2xl border bg-white p-4", n > 0 ? "border-gold ring-2 ring-gold/30" : "border-sand", soldOut && "opacity-50")} data-testid={`room-${t.id}`}>
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", n > 0 ? "bg-gold text-anthracite" : "bg-cream text-gold-dark")}><BedDouble className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-xl">{t.name}</span>
                  <span className="block text-sm text-ink-soft">{t.description}</span>
                  <span className="mt-1 block text-xs text-muted">
                    {loading && !live ? "Verfügbarkeit wird geprüft …" : free === null ? `bis ${t.maxGuests} ${t.maxGuests === 1 ? "Gast" : "Gäste"}` : soldOut ? "In diesem Zeitraum belegt" : `${free} von ${live!.totalRooms} frei · bis ${t.maxGuests} ${t.maxGuests === 1 ? "Gast" : "Gäste"}${t.id === "floor" ? "" : " pro Zimmer"}`}
                  </span>
                  <span className="mt-1 block text-sm">
                    <span className="font-serif text-lg tabular-nums">{t.basePricePerNight === null ? "auf Anfrage" : formatMoney(t.basePricePerNight)}</span>
                    {t.basePricePerNight !== null && <span className="text-xs text-muted"> pro Nacht, inkl. Frühstück</span>}
                    {t.id === "floor" && <span className="ml-2 inline-block rounded-full bg-gold/15 px-2 py-0.5 text-[0.65rem] font-semibold text-gold-dark">statt {formatMoney(FLOOR_ROOMS_SUM)} einzeln + Apartment</span>}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2" role="group" aria-label={`${t.name}: Anzahl`}>
                  <button type="button" onClick={() => setCount(t.id, n - 1)} disabled={n === 0} aria-label={`${t.name} entfernen`} className="grid h-9 w-9 place-items-center rounded-full border border-sand disabled:opacity-30" data-testid={`minus-${t.id}`}>
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-5 text-center font-serif text-xl tabular-nums" data-testid={`count-${t.id}`}>{n}</span>
                  <button type="button" onClick={() => setCount(t.id, n + 1)} disabled={soldOut || n >= max} aria-label={`${t.name} hinzufügen`} className="grid h-9 w-9 place-items-center rounded-full bg-anthracite text-paper disabled:opacity-30" data-testid={`plus-${t.id}`}>
                    <Plus className="h-4 w-4" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <form onSubmit={submit} className="panel-dark flex flex-col gap-4 rounded-[1.5rem] p-6 text-paper md:p-7" data-testid="hotel-form">
        <p className="eyebrow !text-gold-light">Ihre Reservierung</p>
        <label className="text-sm">
          <span className="flex items-center gap-1 text-paper/70"><Users className="h-3.5 w-3.5" /> Gäste</span>
          <select value={Math.min(guests, maxGuests)} onChange={(e) => setGuests(Number(e.target.value))} className="mt-1 h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-paper" data-testid="hotel-guests">
            {Array.from({ length: maxGuests }, (_, i) => i + 1).map((g) => <option key={g} value={g} className="text-ink">{g}</option>)}
          </select>
        </label>
        <div className="rounded-xl bg-white/5 p-3 text-sm" data-testid="hotel-summary">
          <div className="flex justify-between text-paper/70"><span>{stay ? `${formatDateMedium(stay.arrival)} – ${formatDateMedium(stay.departure)}` : "Zeitraum wählen"}</span><span>{nights} {nights === 1 ? "Nacht" : "Nächte"}</span></div>
          {quote?.lines.map((l) => (
            <div key={l.roomTypeId} className="mt-1 flex justify-between"><span>{l.rooms} × {l.name}</span><span className="tabular-nums">{l.pricing ? formatMoney(l.pricing.list) : "auf Anfrage"}</span></div>
          ))}
          {!items.length && <p className="mt-1 text-paper/60">Noch kein Zimmer gewählt.</p>}
          {quote && quote.discount > 0 && (
            <div className="mt-1 flex justify-between text-[#a9cf9f]"><span>Langzeit-Vorteil ab {LONG_STAY_NIGHTS} Nächten</span><span className="tabular-nums">−{quote.discountPercent} % · −{formatMoney(quote.discount)}</span></div>
          )}
          <div className="mt-2 flex items-baseline justify-between border-t border-white/10 pt-2"><span className="text-paper/70">Gesamt inkl. Frühstück</span><span className="font-serif text-2xl tabular-nums" data-testid="hotel-total">{formatMoney(quote?.total ?? null, items.length ? "auf Anfrage" : "–")}</span></div>
          {quote && quote.discount === 0 && nights > 0 && nights < LONG_STAY_NIGHTS && <p className="mt-1 text-xs text-paper/50">Ab {LONG_STAY_NIGHTS} Nächten {LONG_STAY_PERCENT} % günstiger.</p>}
        </div>
        {nudges.map((n) => (
          <p key={n} className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold-light" data-testid="hotel-nudge">
            {n}
          </p>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <input required placeholder="Vorname" autoComplete="given-name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="h-11 rounded-xl border border-white/15 bg-white/5 px-3 placeholder:text-paper/40" />
          <input required placeholder="Nachname" autoComplete="family-name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="h-11 rounded-xl border border-white/15 bg-white/5 px-3 placeholder:text-paper/40" />
        </div>
        <input required type="email" placeholder="E-Mail" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11 rounded-xl border border-white/15 bg-white/5 px-3 placeholder:text-paper/40" />
        <input type="tel" placeholder="Telefon (optional)" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-11 rounded-xl border border-white/15 bg-white/5 px-3 placeholder:text-paper/40" />
        <textarea rows={2} placeholder="Wünsche (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 placeholder:text-paper/40" />
        {error && <p className="rounded-xl bg-danger/20 px-3 py-2 text-sm text-[#f0a79c]" role="alert">{error}</p>}
        <Button type="submit" variant="gold" disabled={busy || !stay || issues.length > 0 || !items.length || itemIssues.length > 0 || shortfall.length > 0} data-testid="hotel-submit">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {items.length > 1 ? `${quote?.rooms ?? 0} Zimmer anfragen` : "Zimmer anfragen"}
        </Button>
        <p className="text-xs text-paper/55">Unverbindliche Anfrage – wir bestätigen persönlich. Bezahlt wird vor Ort. Mit dem Absenden akzeptieren Sie unsere Datenschutzerklärung.</p>
      </form>
    </div>
  );
}
