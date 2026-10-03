"use client";

import { ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultRateId } from "@/content/rates";
import { canAddRoom, cartToReservation, cartTotals, emptyFilters, newCartItem, searchFromParams, searchToParams, type AvailabilityType, type Cart, type CartItem, type RoomFilters, type SearchState } from "@/domain/booking-engine";
import { nightCount, validateStay } from "@/domain/hotel";
import { addDays, isLocalDate, todayLocal } from "@/domain/time";
import { cn } from "@/lib/cn";
import { fetchApi } from "./api";
import { CartView } from "./CartView";
import { Checkout, type CheckoutForm } from "./Checkout";
import { Confirmation } from "./Confirmation";
import { RoomList } from "./RoomList";
import { SearchBar } from "./SearchBar";
import { loadCart, loadDone, saveCart, saveDone, type DoneInfo } from "./storage";
import type { EngineApi, EngineRoom, Step } from "./types";
import { plural } from "./ui";

export interface BookingEngineProps {
  rooms: EngineRoom[];
  /** the preview passes its own stand-in; the site uses the fetch API (default) */
  api?: EngineApi;
  paymentProvider: "demo" | "stripe" | "none";
  /** query string of the page on the server (SSR) – the browser URL wins on mount */
  initialQuery?: string;
  links: { agb: string; datenschutz: string; home: string };
  className?: string;
}

const STEP_HASH: Record<Step, string> = { rooms: "", cart: "#warenkorb", checkout: "#kasse", done: "#bestaetigt" };
const stepFromHash = (hash: string): Step => (hash === "#warenkorb" ? "cart" : hash === "#kasse" ? "checkout" : hash === "#bestaetigt" ? "done" : "rooms");

/**
 * The whole room booking as one page flow – like the booking engines of the
 * big houses: search bar with rate calendar → room list with filters →
 * (cart) → checkout → confirmation. Steps live in the URL hash so the
 * browser's Back button works; the cart survives reloads (localStorage).
 */
export function BookingEngine({ rooms, api = fetchApi, paymentProvider, initialQuery = "", links, className }: BookingEngineProps) {
  const today = todayLocal();
  const initial = useMemo(() => searchFromParams(new URLSearchParams(initialQuery), isLocalDate, { adults: 2 }), [initialQuery]);
  const [search, setSearch] = useState<SearchState>(initial);
  const [step, setStep] = useState<Step>("rooms");
  const [filters, setFilters] = useState<RoomFilters>(emptyFilters);
  const [cart, setCart] = useState<Cart | null>(null);
  const [types, setTypes] = useState<AvailabilityType[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DoneInfo | null>(null);
  const [outcome, setOutcome] = useState<"ok" | "abgebrochen" | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // --- mount: browser URL + stored cart ------------------------------------
  useEffect(() => {
    // deferred: browser state is read after the first paint (no synchronous setState in the effect)
    const init = () => {
    const params = new URLSearchParams(window.location.search);
    let s = searchFromParams(params, isLocalDate, { adults: 2 });
    const stored = loadCart();
    if (stored && stored.items.length && (!s.arrival || !s.departure)) s = { ...s, arrival: stored.arrival, departure: stored.departure };
    if (stored && stored.items.length) setCart(s.arrival && s.departure ? { ...stored, arrival: s.arrival, departure: s.departure } : stored);
    if (s.arrival && s.arrival < today) s = { ...s, arrival: null, departure: null };
    setSearch(s);
    setHighlight(params.get("zimmer"));
    const pay = params.get("zahlung");
    if (pay === "ok" || pay === "abgebrochen") setOutcome(pay);
    const hashStep = stepFromHash(window.location.hash);
    if (hashStep === "done") setDone(loadDone());
    // a checkout/cart link without rooms falls back to the room list
    setStep(hashStep !== "rooms" && hashStep !== "done" && !(stored && stored.items.length) ? "rooms" : hashStep);
    setReady(true);
    };
    const timer = setTimeout(init, 0);
    const onPop = () => {
      const st = stepFromHash(window.location.hash);
      if (st === "done") setDone(loadDone());
      setStep(st);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("popstate", onPop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- keep URL and storage in sync ----------------------------------------
  useEffect(() => {
    if (!ready) return;
    const p = searchToParams(search);
    if (highlight) p.set("zimmer", highlight);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${p.toString()}${window.location.hash}`);
  }, [search, highlight, ready]);
  useEffect(() => {
    if (ready) saveCart(cart);
  }, [cart, ready]);

  const go = useCallback((next: Step) => {
    setStep(next);
    setError(null);
    const url = `${window.location.pathname}${window.location.search}${STEP_HASH[next]}`;
    window.history.pushState(null, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // --- availability --------------------------------------------------------
  const stay = search.arrival && search.departure ? { arrival: search.arrival, departure: search.departure } : null;
  const issues = stay ? validateStay(stay, today) : [];
  const nights = stay ? nightCount(stay.arrival, stay.departure) : 0;
  useEffect(() => {
    if (!ready) return;
    const a = search.arrival ?? today;
    const d = search.departure ?? addDays(a, 1);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      api
        .availability(a, d, ctrl.signal)
        .then((res) => res && setTypes(res.types))
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 0);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.arrival, search.departure, ready]);

  // --- cart actions --------------------------------------------------------
  const onSearch = (next: SearchState) => {
    setSearch(next);
    if (next.arrival && next.departure) setCart((c) => (c ? { ...c, arrival: next.arrival!, departure: next.departure! } : c));
    if (step !== "rooms") go("rooms");
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const addRoom = (roomTypeId: string, rateId = defaultRateId) => {
    if (!stay || issues.length) return;
    const current = cart && cart.arrival === stay.arrival && cart.departure === stay.departure ? cart : { arrival: stay.arrival, departure: stay.departure, items: cart?.items ?? [] };
    const check = canAddRoom(current, roomTypeId, types);
    if (!check.ok) return;
    const item = newCartItem(roomTypeId, search.guests, rateId);
    const next = { ...current, items: [...current.items, item] };
    setCart(next);
    go("checkout");
  };
  /** "Zimmer hinzufügen": back to the list with the category filters cleared – the next room is usually a different one */
  const addAnotherRoom = () => {
    setFilters((f) => ({ ...emptyFilters(), view: f.view, sort: f.sort }));
    go("rooms");
  };
  const updateItem = (id: string, patch: Partial<CartItem>) => setCart((c) => (c ? { ...c, items: c.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) } : c));
  const removeItem = (id: string) => setCart((c) => (c ? { ...c, items: c.items.filter((i) => i.id !== id) } : c));
  const cartCount = cart?.items.length ?? 0;

  const submit = async (form: CheckoutForm) => {
    if (!cart || !cart.items.length) return;
    setBusy(true);
    setError(null);
    const payload = cartToReservation(cart);
    const notes = [form.notes, search.code ? `Code: ${search.code}` : ""].filter(Boolean).join("\n");
    const res = await api.reserve({ ...payload, firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), phone: form.phone.trim(), notes, payment: form.payment });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    const info: DoneInfo = {
      reservationNumber: res.reservationNumber,
      firstName: form.firstName.trim(),
      arrival: cart.arrival,
      departure: cart.departure,
      lines: res.lines.map((l) => ({ rooms: l.rooms, name: l.name })),
      total: res.total,
      payment: form.payment,
      paymentStatus: res.payment.provider === "demo" ? res.payment.status : res.payment.provider === "stripe" ? "pending" : "none",
    };
    saveDone(info);
    setCart(null);
    if (res.payment.provider === "stripe") {
      window.location.assign(res.payment.checkoutUrl);
      return;
    }
    setDone(info);
    setOutcome(null);
    go("done");
  };

  const totals = cart ? cartTotals(cart) : null;
  const title = cartCount ? `Zimmer ${cartCount + 1} wählen` : "Ein Zimmer wählen";

  return (
    <div className={cn("space-y-8", className)} data-booking-engine data-step={step}>
      {/* top strip: search + cart */}
      {step !== "done" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <SearchBar state={search} onChange={setSearch} onSearch={onSearch} types={types} loading={loading} autoOpen={ready && !stay && step === "rooms"} />
          <button
            type="button"
            onClick={() => go(cartCount ? "cart" : "rooms")}
            className={cn("relative inline-flex h-14 items-center gap-3 self-start border bg-white px-5 text-left shadow-[var(--shadow-soft)] transition-colors hover:border-ink/40 lg:mt-0", step === "cart" ? "border-ink" : "border-sand")}
            aria-label={`Warenkorb, ${plural(cartCount, "Zimmer", "Zimmer")}`}
            data-testid="cart-button"
          >
            <ShoppingBag className="h-5 w-5 text-gold-dark" aria-hidden />
            <span className="text-sm">
              <span className="block text-[0.62rem] uppercase tracking-[0.2em] text-muted">Warenkorb</span>
              <span className="block font-serif text-lg leading-none text-ink">{cartCount ? `${plural(cartCount, "Zimmer", "Zimmer")}${totals?.total !== null && totals ? ` · ${(totals.total! / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}` : ""}` : "leer"}</span>
            </span>
            {cartCount > 0 && <span className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-gold px-1 text-xs font-semibold text-ink">{cartCount}</span>}
          </button>
        </div>
      )}

      {step === "rooms" && (
        <div ref={listRef} className="scroll-mt-28">
          {stay && issues.includes("past") && <p className="mb-4 border border-danger/30 bg-danger-pale px-4 py-3 text-sm text-danger">Die Anreise liegt in der Vergangenheit – bitte neue Daten wählen.</p>}
          {!stay && <p className="mb-4 text-sm text-ink-soft">Wählen Sie oben An- und Abreise – die Preise im Kalender gelten pro Zimmer und Nacht, inklusive Frühstück.</p>}
          <RoomList rooms={rooms} types={types} loading={loading} nights={nights} stayReady={!!stay && !issues.length} cart={cart} filters={filters} onFilters={setFilters} onAdd={addRoom} title={title} highlightId={highlight} />
        </div>
      )}

      {step === "cart" && cart && <CartView cart={cart} rooms={rooms} onRemove={removeItem} onUpdate={updateItem} onAddRoom={addAnotherRoom} onCheckout={() => go("checkout")} />}
      {step === "cart" && !cart && <CartView cart={{ arrival: search.arrival ?? today, departure: search.departure ?? addDays(today, 1), items: [] }} rooms={rooms} onRemove={removeItem} onUpdate={updateItem} onAddRoom={addAnotherRoom} onCheckout={() => go("checkout")} />}

      {step === "checkout" &&
        (cart && cart.items.length ? (
          <Checkout cart={cart} rooms={rooms} paymentProvider={paymentProvider} busy={busy} error={error} onBack={() => go("cart")} onAddRoom={addAnotherRoom} onUpdateItem={updateItem} onSubmit={submit} links={links} />
        ) : (
          <div className="border border-sand bg-white p-8 text-center text-ink-soft">
            Ihr Warenkorb ist leer.{" "}
            <button type="button" onClick={() => go("rooms")} className="font-semibold text-gold-dark underline underline-offset-4">
              Zimmer wählen
            </button>
          </div>
        ))}

      {step === "done" && (
        <Confirmation
          info={done}
          outcome={outcome}
          homeHref={links.home}
          onNew={() => {
            setDone(null);
            setOutcome(null);
            go("rooms");
          }}
        />
      )}
    </div>
  );
}
