"use client";

import { ShoppingBag } from "lucide-react";
import { useState } from "react";
import { stayExtras } from "@/content/hotel";
import { averagePerNight, cartTotals, type Cart, type CartItem } from "@/domain/booking-engine";
import { formatMoney } from "@/lib/format";
import { PriceDetails } from "./PriceDetails";
import type { EngineRoom } from "./types";
import { Pill, Stepper, TextAction, plural } from "./ui";

const fmtDate = (d: string) => new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

export interface CartViewProps {
  cart: Cart;
  rooms: EngineRoom[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<CartItem>) => void;
  onAddRoom: () => void;
  onCheckout: () => void;
}

/** "Ihr Warenkorb: n Zimmer" – every room as a line, editable guests and extras, price details beside it. */
export function CartView({ cart, rooms, onRemove, onUpdate, onAddRoom, onCheckout }: CartViewProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const t = cartTotals(cart);
  const avg = averagePerNight(t);
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]" data-testid="cart-view">
      <div>
        <h2 className="font-serif text-[2rem] text-ink md:text-[2.4rem]">
          Ihr Warenkorb: <span className="text-gold-dark">{plural(t.rooms, "Zimmer", "Zimmer")}</span>
        </h2>
        {!t.rooms && (
          <div className="mt-6 border border-sand bg-white p-10 text-center">
            <ShoppingBag className="mx-auto h-8 w-8 text-gold-dark" aria-hidden />
            <p className="mt-3 text-ink-soft">Ihr Warenkorb ist leer.</p>
            <Pill variant="primary" className="mt-5" onClick={onAddRoom}>
              Zimmer wählen
            </Pill>
          </div>
        )}
        <ul className="mt-6 space-y-4">
          {t.lines.map((l, i) => {
            const room = rooms.find((r) => r.id === l.item.roomTypeId);
            const open = editing === l.item.id;
            return (
              <li key={l.item.id} className="border border-sand bg-white p-4 shadow-[var(--shadow-soft)] md:p-5" data-testid={`cart-item-${i}`}>
                <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
                  <div className="aspect-[4/3] overflow-hidden bg-cream sm:aspect-auto sm:h-24">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {room?.photo && <img src={room.photo} alt={l.name} className="h-full w-full object-cover" />}
                  </div>
                  <div className="text-sm">
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">Zimmer {i + 1}</p>
                    <p className="font-serif text-xl text-ink">{l.name}</p>
                    <p className="text-ink-soft">{l.rateName}</p>
                    <p className="mt-1 text-muted">
                      {fmtDate(cart.arrival)} – {fmtDate(cart.departure)} · {plural(l.nights, "Nacht", "Nächte")}
                    </p>
                    <p className="text-muted">
                      {plural(l.item.adults, "Erwachsener", "Erwachsene")}
                      {l.item.children ? `, ${plural(l.item.children, "Kind", "Kinder")}` : ""}
                      {l.extraLines.length ? ` · ${l.extraLines.map((e) => `${e.quantity} × ${e.name}`).join(", ")}` : ""}
                    </p>
                    {l.perNight !== null && <p className="text-xs text-muted">{formatMoney(l.perNight)} pro Nacht · inklusive Frühstück und MwSt.</p>}
                    <div className="mt-3 flex gap-4">
                      <TextAction onClick={() => setEditing(open ? null : l.item.id)} aria-expanded={open}>
                        {open ? "Fertig" : "Bearbeiten"}
                      </TextAction>
                      <TextAction onClick={() => onRemove(l.item.id)} data-testid={`cart-remove-${i}`}>
                        Entfernen
                      </TextAction>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-2xl tabular-nums">{l.total === null ? "auf Anfrage" : formatMoney(l.total)}</p>
                    <p className="text-xs text-muted">Inklusive Steuern</p>
                  </div>
                </div>
                {open && (
                  <div className="mt-4 grid gap-4 border-t border-sand pt-4 md:grid-cols-2" data-testid={`cart-edit-${i}`}>
                    <div className="space-y-3 text-sm">
                      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">Belegung dieses Zimmers (bis {plural(room?.maxGuests ?? 2, "Gast", "Gäste")})</p>
                      <div className="flex items-center justify-between">
                        <span>Erwachsene</span>
                        <Stepper size="sm" label="Erwachsene" value={l.item.adults} min={1} max={Math.max(1, (room?.maxGuests ?? 2) - l.item.children)} onChange={(adults) => onUpdate(l.item.id, { adults })} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Kinder</span>
                        <Stepper size="sm" label="Kinder" value={l.item.children} min={0} max={Math.max(0, (room?.maxGuests ?? 2) - l.item.adults)} onChange={(children) => onUpdate(l.item.id, { children })} />
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">Extras pro Nacht</p>
                      {stayExtras.map((e) => {
                        const q = l.item.extras[e.id] ?? 0;
                        return (
                          <div key={e.id} className="flex items-center justify-between gap-3">
                            <span>
                              {e.name} <span className="text-muted">· {e.pricePerNight === 0 ? "inklusive" : `${formatMoney(e.pricePerNight)} / Nacht`}</span>
                            </span>
                            <Stepper size="sm" label={e.name} value={q} min={0} max={e.perRoom ? 2 : 1} onChange={(n) => onUpdate(l.item.id, { extras: { ...l.item.extras, [e.id]: n } })} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {t.rooms > 0 && avg !== null && <p className="mt-4 text-xs text-muted">Im Schnitt {formatMoney(avg)} pro Nacht für alle Zimmer zusammen.</p>}
      </div>
      <PriceDetails cart={cart}>
        <Pill variant="dark" size="lg" onClick={onAddRoom} data-testid="cart-add-room">
          Zimmer hinzufügen
        </Pill>
        <Pill variant="primary" size="lg" onClick={onCheckout} disabled={!t.rooms} data-testid="cart-checkout">
          Kasse
        </Pill>
      </PriceDetails>
    </div>
  );
}
