"use client";

import { CalendarDays, ChevronDown, Tag, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { hotelCopy } from "@/content/hotel";
import { bestNightlyPrice, cheapestStayTotal, houseFullNights, totalGuests, type AvailabilityType, type SearchState } from "@/domain/booking-engine";
import { nightCount, validateStay } from "@/domain/hotel";
import { todayLocal, type LocalDate } from "@/domain/time";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { RateCalendar } from "./RateCalendar";
import { FieldBox, Pill, Stepper, plural } from "./ui";

const fmt = (d: LocalDate | null) => (d ? new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`)) : "Datum wählen");

export interface SearchBarProps {
  state: SearchState;
  onChange: (next: SearchState) => void;
  /** the guest confirmed dates/guests → load rooms */
  onSearch: (next: SearchState) => void;
  types: AvailabilityType[] | null;
  loading?: boolean;
  /** open the calendar right away (deep link without dates) */
  autoOpen?: boolean;
  className?: string;
}

type Panel = "guests" | "dates" | "code" | null;

/**
 * The search bar of the booking engine: Gäste | Anreise | Abreise, a line for
 * special codes, and – when a field is tapped – the guests popover or the
 * two-month rate calendar with "Ab x € gesamt für n Nächte" + SUCHEN.
 */
export function SearchBar({ state, onChange, onSearch, types, loading, autoOpen, className }: SearchBarProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const [draft, setDraft] = useState<{ arrival: LocalDate | null; departure: LocalDate | null }>({ arrival: state.arrival, departure: state.departure });
  const [guestsDraft, setGuestsDraft] = useState(state.guests);
  const [code, setCode] = useState(state.code);
  const rootRef = useRef<HTMLDivElement>(null);
  const today = todayLocal();

  /** opening a panel copies the committed state into its draft */
  const openPanel = (next: Panel) => {
    if (next === "dates") setDraft({ arrival: state.arrival, departure: state.departure });
    if (next === "guests") setGuestsDraft(state.guests);
    if (next === "code") setCode(state.code);
    setPanel(next);
  };

  // deep link without dates: open the calendar once the engine is ready (deferred, not synchronous)
  useEffect(() => {
    if (!autoOpen) return;
    const t = setTimeout(() => {
      setDraft({ arrival: state.arrival, departure: state.departure });
      setPanel("dates");
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  // click outside closes the popovers
  useEffect(() => {
    if (!panel) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setPanel(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanel(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [panel]);

  const fullNights = houseFullNights(types);
  const stayDraft = draft.arrival && draft.departure ? { arrival: draft.arrival, departure: draft.departure } : null;
  const issues = stayDraft ? validateStay(stayDraft, today) : [];
  const nights = stayDraft ? nightCount(stayDraft.arrival, stayDraft.departure) : 0;
  const cheapest = stayDraft && !issues.length ? cheapestStayTotal(stayDraft.arrival, stayDraft.departure, types) : null;

  const applyDates = () => {
    const next = { ...state, arrival: draft.arrival, departure: draft.departure, guests: guestsDraft, code };
    onChange(next);
    setPanel(null);
    if (next.arrival && next.departure) onSearch(next);
  };
  const applyGuests = () => {
    const next = { ...state, guests: guestsDraft };
    onChange(next);
    setPanel(null);
    if (next.arrival && next.departure) onSearch(next);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)} data-testid="engine-search">
      <div className="border border-sand bg-white shadow-[var(--shadow-soft)]">
        <div className="grid grid-cols-1 divide-y divide-sand md:grid-cols-[1.1fr_1fr_1fr] md:divide-x md:divide-y-0">
          <FieldBox icon={<UserRound className="h-5 w-5" />} label="Gäste" value={`${plural(state.guests.adults, "Erwachsener", "Erwachsene")}, ${plural(state.guests.children, "Kind", "Kinder")}`} active={panel === "guests"} onClick={() => (panel === "guests" ? setPanel(null) : openPanel("guests"))} testId="field-guests" />
          <FieldBox icon={<CalendarDays className="h-5 w-5" />} label="Anreise" value={fmt(state.arrival)} active={panel === "dates" && (!draft.arrival || !!draft.departure)} onClick={() => (panel === "dates" ? setPanel(null) : openPanel("dates"))} testId="field-arrival" />
          <FieldBox icon={<CalendarDays className="h-5 w-5" />} label="Abreise" value={fmt(state.departure)} active={panel === "dates" && !!draft.arrival && !draft.departure} onClick={() => (panel === "dates" ? setPanel(null) : openPanel("dates"))} testId="field-departure" />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-sand px-4 py-2">
          <p className="hidden text-xs text-muted sm:block">{hotelCopy.checkIn}</p>
          <button type="button" onClick={() => (panel === "code" ? setPanel(null) : openPanel("code"))} className="ml-auto inline-flex items-center gap-1.5 text-[0.78rem] text-gold-dark hover:text-ink" aria-expanded={panel === "code"}>
            <Tag className="h-3.5 w-3.5" aria-hidden /> Besondere Codes oder Preise
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", panel === "code" && "rotate-180")} aria-hidden />
          </button>
        </div>

        {panel === "code" && (
          <div className="flex flex-col gap-3 border-t border-sand bg-cream/60 px-4 py-4 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm">
              <span className="block text-[0.62rem] font-medium uppercase tracking-[0.2em] text-muted">Firmen-, Gruppen- oder Aktionscode</span>
              <input value={code} onChange={(e) => setCode(e.target.value.slice(0, 40))} placeholder="z. B. FIRMA2026" className="mt-1 h-11 w-full border border-stone bg-white px-3 text-sm outline-none focus:border-gold" data-testid="field-code" />
            </label>
            <Pill variant="outline" size="md" onClick={() => { onChange({ ...state, code }); setPanel(null); }}>
              Übernehmen
            </Pill>
            <p className="text-xs text-muted sm:max-w-[16rem]">Der Code wird mit Ihrer Reservierung übermittelt und bei der Bestätigung berücksichtigt.</p>
          </div>
        )}

        {panel === "dates" && (
          <div className="border-t border-sand px-4 pb-5 pt-5 md:px-6" data-testid="dates-panel">
            <p className="mb-4 text-center text-xs text-muted">Wir zeigen den besten verfügbaren Preis pro Zimmer und Nacht in EUR, inklusive Frühstück – für {plural(totalGuests(guestsDraft), "Gast", "Gäste")}.</p>
            <RateCalendar arrival={draft.arrival} departure={draft.departure} onChange={setDraft} priceFor={(night) => bestNightlyPrice(night, types)} fullNights={fullNights} />
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted">
              <span className="inline-flex items-center gap-2"><span className="inline-block h-3 w-3 bg-gold" aria-hidden /> An-/Abreise</span>
              <span className="inline-flex items-center gap-2"><span className="inline-block h-3 w-3 bg-gold-pale" aria-hidden /> Ihre Nächte</span>
              <span className="inline-flex items-center gap-2"><span className="inline-block h-3 w-3 border border-stone line-through" aria-hidden /> Ausgebucht</span>
            </div>
            <div className="mt-6 flex flex-col items-stretch gap-4 border-t border-sand pt-5 sm:flex-row sm:items-center sm:justify-end">
              <div className="text-right sm:mr-auto sm:text-left" aria-live="polite" data-testid="dates-summary">
                {cheapest ? (
                  <>
                    <p className="font-serif text-xl text-ink">Ab {formatMoney(cheapest.total)} gesamt für {plural(cheapest.nights, "Nacht", "Nächte")}</p>
                    <p className="text-xs text-muted">Inklusive Frühstück und Mehrwertsteuer · günstigstes freies Zimmer</p>
                  </>
                ) : stayDraft && !issues.length ? (
                  <p className="text-sm text-muted">{plural(nights, "Nacht", "Nächte")} · Preis nach Zimmerwahl</p>
                ) : issues.includes("too_long") ? (
                  <p className="text-sm text-danger">Aufenthalte über 21 Nächte bitte persönlich anfragen.</p>
                ) : (
                  <p className="text-sm text-muted">{!draft.arrival ? "Wählen Sie den Anreisetag." : "Wählen Sie jetzt den Abreisetag."}</p>
                )}
              </div>
              <Pill variant="ghost" onClick={() => { setDraft({ arrival: state.arrival, departure: state.departure }); setPanel(null); }}>
                Abbrechen
              </Pill>
              <Pill variant="primary" size="lg" onClick={applyDates} disabled={!stayDraft || issues.length > 0 || loading} data-testid="search-submit">
                Suchen
              </Pill>
            </div>
          </div>
        )}
      </div>

      {panel === "guests" && (
        <div className="absolute left-0 top-[calc(100%-2.6rem)] z-30 w-[min(22rem,100%)] border border-sand bg-white p-5 shadow-[var(--shadow-lift)] md:top-[4.6rem]" role="dialog" aria-label="Gäste" data-testid="guests-popover">
          <div className="flex items-center justify-between">
            <p className="font-serif text-xl text-gold-dark">Gäste</p>
            <button type="button" onClick={() => setPanel(null)} aria-label="Schließen" className="grid h-8 w-8 place-items-center text-muted hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 divide-y divide-sand border border-sand">
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <span>
                <span className="block text-sm text-ink">Erwachsene</span>
                <span className="block text-xs text-muted">ab 18 Jahren</span>
              </span>
              <Stepper label="Erwachsene" value={guestsDraft.adults} min={1} max={22} onChange={(adults) => setGuestsDraft({ ...guestsDraft, adults })} />
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <span>
                <span className="block text-sm text-ink">Kinder</span>
                <span className="block text-xs text-muted">0–17 Jahre</span>
              </span>
              <Stepper label="Kinder" value={guestsDraft.children} min={0} max={10} onChange={(children) => setGuestsDraft({ ...guestsDraft, children })} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Pill variant="primary" onClick={applyGuests} data-testid="guests-done">
              Erledigt
            </Pill>
          </div>
        </div>
      )}
    </div>
  );
}
