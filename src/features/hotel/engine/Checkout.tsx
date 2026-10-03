"use client";

import { ArrowLeft, ChevronDown, CreditCard, Loader2, Lock, Wallet, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { hotelFacts } from "@/content/hotel";
import { paymentChoices, type PaymentChoice } from "@/content/rates";
import { cartTotals, type Cart, type CartItem } from "@/domain/booking-engine";
import { cn } from "@/lib/cn";
import { PriceDetails } from "./PriceDetails";
import type { EngineRoom } from "./types";
import { Pill, TextField, plural } from "./ui";

export interface CheckoutForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes: string;
  payment: PaymentChoice;
}

export interface CheckoutProps {
  cart: Cart;
  rooms: EngineRoom[];
  paymentProvider: "demo" | "stripe" | "none";
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onAddRoom: () => void;
  onUpdateItem: (id: string, patch: Partial<CartItem>) => void;
  onSubmit: (form: CheckoutForm) => void;
  /** external links of the site (preview rewrites them) */
  links: { agb: string; datenschutz: string };
}

const PAY_ICON: Record<PaymentChoice, typeof Wallet> = { hotel: Wallet, online: CreditCard, guarantee: ShieldCheck };

/**
 * "Kasse": contact data, per-room guest names and wishes, payment choice,
 * house rules and the confirmation checkbox – price details at the side.
 */
export function Checkout({ cart, rooms, paymentProvider, busy, error, onBack, onAddRoom, onUpdateItem, onSubmit, links }: CheckoutProps) {
  const [form, setForm] = useState<CheckoutForm>({ firstName: "", lastName: "", email: "", phone: "", notes: "", payment: "hotel" });
  const [wishes, setWishes] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [openRoom, setOpenRoom] = useState<string | null>(null);
  const t = cartTotals(cart);
  const choices = paymentChoices.filter((c) => !c.needsProvider || paymentProvider !== "none").filter((c) => c.id !== "online" || !t.onRequest);
  const canSubmit = !busy && accepted && form.firstName.trim() && form.lastName.trim() && form.email.trim() && form.phone.trim();

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]" data-testid="checkout">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit(form);
        }}
        noValidate
      >
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} aria-label="Zurück zum Warenkorb" className="grid h-10 w-10 place-items-center text-ink hover:text-gold-dark">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h2 className="font-serif text-[2rem] text-ink md:text-[2.4rem]">Kasse</h2>
        </div>

        {/* contact */}
        <section className="border border-sand bg-white p-5 shadow-[var(--shadow-soft)] md:p-6">
          <div className="flex items-baseline justify-between">
            <h3 className="font-serif text-xl text-gold-dark">Kontaktdaten</h3>
            <span className="text-[0.65rem] text-muted">* Erforderlich</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <TextField label="Vorname" required autoComplete="given-name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} data-testid="co-first" />
            <TextField label="Nachname" required autoComplete="family-name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} data-testid="co-last" />
            <TextField label="Telefon" required type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="co-phone" />
            <TextField label="E-Mail-Adresse" required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} hint="An diese E-Mail senden wir die Bestätigung." data-testid="co-email" />
          </div>
        </section>

        {/* rooms */}
        {t.lines.length > 1 && (
          <section className="border border-sand bg-white shadow-[var(--shadow-soft)]">
            {t.lines.map((l, i) => {
              const room = rooms.find((r) => r.id === l.item.roomTypeId);
              const open = openRoom === l.item.id;
              return (
                <div key={l.item.id} className="border-b border-sand last:border-b-0">
                  <button type="button" onClick={() => setOpenRoom(open ? null : l.item.id)} aria-expanded={open} className="flex w-full items-center justify-between px-5 py-4 text-left md:px-6">
                    <span className="font-serif text-xl text-ink">
                      Zimmer {i + 1}: {room?.name ?? l.name}
                    </span>
                    <ChevronDown className={cn("h-5 w-5 text-gold-dark transition-transform", open && "rotate-180")} aria-hidden />
                  </button>
                  {open && (
                    <div className="px-5 pb-5 md:px-6">
                      <p className="text-sm text-muted">
                        {plural(l.item.adults, "Erwachsener", "Erwachsene")}
                        {l.item.children ? `, ${plural(l.item.children, "Kind", "Kinder")}` : ""} · {l.rateName}
                      </p>
                      <TextField label="Name des Gastes in diesem Zimmer (optional)" className="mt-3" value={l.item.guestName ?? ""} onChange={(e) => onUpdateItem(l.item.id, { guestName: e.target.value.slice(0, 80) })} />
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* wishes */}
        <section className="border border-sand bg-white p-5 shadow-[var(--shadow-soft)] md:p-6">
          <h3 className="font-serif text-xl text-gold-dark">Reservierungsdetails</h3>
          <button type="button" onClick={() => setWishes((w) => !w)} aria-expanded={wishes} className="mt-3 flex w-full items-center justify-between border border-stone px-4 py-3 text-left text-sm text-ink-soft">
            Spezialwünsche <ChevronDown className={cn("h-4 w-4 text-gold-dark transition-transform", wishes && "rotate-180")} aria-hidden />
          </button>
          {wishes && <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value.slice(0, 1500) })} placeholder="Späte Anreise, Allergien, ruhiges Zimmer, Zustellbett …" className="mt-2 w-full border border-stone bg-white px-3 py-2 text-sm outline-none focus:border-gold" data-testid="co-notes" />}
        </section>

        {/* payment */}
        <section className="border border-sand bg-white p-5 shadow-[var(--shadow-soft)] md:p-6" data-testid="co-payment">
          <h3 className="flex items-center gap-2 font-serif text-xl text-gold-dark">
            <Lock className="h-4 w-4" aria-hidden /> Zahlung
          </h3>
          <p className="mt-1 text-xs text-muted">Wir verwenden sichere Übertragung und speichern keine Kartendaten auf unseren Servern.</p>
          <div className="mt-4 grid gap-3">
            {choices.map((c) => {
              const Icon = PAY_ICON[c.id];
              const on = form.payment === c.id;
              return (
                <label key={c.id} className={cn("flex cursor-pointer items-start gap-3 border p-4 transition-colors", on ? "border-gold bg-gold-pale/40" : "border-sand hover:border-ink/30")}>
                  <input type="radio" name="payment" className="sr-only" checked={on} onChange={() => setForm({ ...form, payment: c.id })} data-testid={`pay-${c.id}`} />
                  <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border", on ? "border-gold-dark" : "border-stone")} aria-hidden>
                    {on && <span className="h-2.5 w-2.5 rounded-full bg-gold-dark" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-semibold text-ink">
                      <Icon className="h-4 w-4 text-gold-dark" aria-hidden /> {c.title}
                      {c.id !== "hotel" && paymentProvider === "demo" && <span className="rounded-full bg-cream px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.14em] text-muted">Demo</span>}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-soft">{c.text}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {paymentProvider === "stripe" && form.payment !== "hotel" && <p className="mt-3 text-xs text-muted">Sie werden nach dem Bestätigen zu unserem Zahlungsdienstleister Stripe weitergeleitet und kommen danach hierher zurück.</p>}
          <p className="mt-3 text-xs text-muted">Akzeptierte Karten im Haus: {hotelFacts.cards}.</p>
        </section>

        {/* policies */}
        <section className="border border-sand bg-white p-5 shadow-[var(--shadow-soft)] md:p-6">
          <h3 className="font-serif text-xl text-gold-dark">Richtlinien</h3>
          <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">Check-in</dt>
              {hotelFacts.checkIn.map((l) => <dd key={l} className="text-ink-soft">{l}</dd>)}
            </div>
            <div>
              <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">Check-out</dt>
              {hotelFacts.checkOut.map((l) => <dd key={l} className="text-ink-soft">{l}</dd>)}
            </div>
          </dl>
          <p className="mt-4 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">Stornierung</p>
          <p className="mt-1 text-sm text-ink-soft">{hotelFacts.cancellation}</p>
          <p className="mt-3 text-xs text-muted">{hotelFacts.pets}</p>
        </section>

        {/* confirm */}
        <section className="border border-sand bg-white p-5 shadow-[var(--shadow-soft)] md:p-6">
          <h3 className="font-serif text-xl text-gold-dark">Bestätigung</h3>
          <p className="mt-1 text-sm text-ink-soft">Mit dem Abschluss dieser Reservierung akzeptieren Sie unsere Buchungsbedingungen. Wir prüfen die Zimmer und bestätigen persönlich – meist innerhalb eines Tages.</p>
          <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 accent-[#8d6417]" data-testid="co-accept" />
            <span>
              * Ich akzeptiere die{" "}
              <a href={links.agb} className="font-semibold text-gold-dark underline underline-offset-4" target="_blank" rel="noreferrer">
                AGB
              </a>{" "}
              und die{" "}
              <a href={links.datenschutz} className="font-semibold text-gold-dark underline underline-offset-4" target="_blank" rel="noreferrer">
                Datenschutzbestimmungen
              </a>
              .
            </span>
          </label>
          {error && (
            <p className="mt-4 border border-danger/30 bg-danger-pale px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end">
            <Pill type="submit" variant="primary" size="lg" disabled={!canSubmit} data-testid="co-submit">
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {form.payment === "online" ? "Zahlungspflichtig buchen" : "Buchung bestätigen"}
            </Pill>
          </div>
        </section>
      </form>

      <div className="lg:sticky lg:top-28 lg:self-start">
        <PriceDetails cart={cart}>
          <Pill variant="outline" size="lg" onClick={onAddRoom}>
            Zimmer hinzufügen
          </Pill>
        </PriceDetails>
      </div>
    </div>
  );
}
