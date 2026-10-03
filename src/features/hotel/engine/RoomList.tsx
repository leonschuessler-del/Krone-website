"use client";

import { SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { ratePlans } from "@/content/rates";
import { activeFilterCount, canAddRoom, filterRooms, roomsInCart, type AvailabilityType, type Cart, type RoomFilters, type SortMode, type ViewMode } from "@/domain/booking-engine";
import { cn } from "@/lib/cn";
import { FilterPanel } from "./FilterPanel";
import { RoomCard } from "./RoomCard";
import type { EngineRoom } from "./types";
import { Dropdown, MenuItem, plural } from "./ui";

const SORT_LABEL: Record<SortMode, string> = { recommended: "Empfohlen", "price-asc": "Niedrigster Preis", "price-desc": "Höchster Preis" };
const VIEW_LABEL: Record<ViewMode, string> = { rooms: "Zimmer", rates: "Tarife" };

export interface RoomListProps {
  rooms: EngineRoom[];
  types: AvailabilityType[] | null;
  loading: boolean;
  nights: number;
  stayReady: boolean;
  cart: Cart | null;
  filters: RoomFilters;
  onFilters: (f: RoomFilters) => void;
  onAdd: (roomTypeId: string, rateId: string) => void;
  title: string;
  highlightId?: string | null;
}

/** "Ein Zimmer wählen": controls (view · sort · filter) and the room cards. */
export function RoomList({ rooms, types, loading, nights, stayReady, cart, filters, onFilters, onAdd, title, highlightId }: RoomListProps) {
  const [menu, setMenu] = useState<"view" | "sort" | "filter" | null>(null);
  const [draft, setDraft] = useState<RoomFilters>(filters);
  const openFilter = () => {
    setDraft(filters);
    setMenu("filter");
  };
  useEffect(() => {
    if (menu !== "view" && menu !== "sort") return;
    const close = () => setMenu(null);
    const t = setTimeout(() => document.addEventListener("click", close, { once: true }), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("click", close);
    };
  }, [menu]);

  const visible = filterRooms(rooms, filters) as EngineRoom[];
  const matchingDraft = filterRooms(rooms, draft).length;
  const active = activeFilterCount(filters);

  const card = (room: EngineRoom, rateOnly?: string) => {
    const live = types?.find((t) => t.id === room.id);
    return (
      <RoomCard
        key={`${room.id}-${rateOnly ?? "all"}`}
        room={room}
        live={live}
        nights={nights}
        stayReady={stayReady}
        canAdd={stayReady ? canAddRoom(cart, room.id, types) : { ok: false, reason: "Bitte zuerst An- und Abreise wählen." }}
        inCart={cart ? roomsInCart(cart, room.id) : 0}
        onAdd={(rateId) => onAdd(room.id, rateId)}
        highlighted={highlightId === room.id}
        rateOnly={rateOnly}
      />
    );
  };

  return (
    <section aria-labelledby="rooms-title" data-testid="room-list">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="rooms-title" className="font-serif text-[2rem] text-ink md:text-[2.4rem]">
          {title}
        </h2>
        <p className="text-sm text-muted" aria-live="polite">
          {loading ? "Verfügbarkeit wird geprüft …" : `${plural(visible.length, "Zimmertyp", "Zimmertypen")}${active ? ` · ${active} ${active === 1 ? "Filter aktiv" : "Filter aktiv"}` : ""}`}
        </p>
      </div>

      <div className="relative z-20 mt-5 flex flex-wrap gap-3" onClick={(e) => e.stopPropagation()}>
        <Dropdown label="Gesehen von" value={VIEW_LABEL[filters.view]} open={menu === "view"} onToggle={() => setMenu(menu === "view" ? null : "view")} testId="ctl-view">
          {(["rooms", "rates"] as ViewMode[]).map((v) => (
            <MenuItem key={v} active={filters.view === v} onClick={() => { onFilters({ ...filters, view: v }); setMenu(null); }}>
              {VIEW_LABEL[v]}
            </MenuItem>
          ))}
        </Dropdown>
        <Dropdown label="Sortieren nach" value={SORT_LABEL[filters.sort]} open={menu === "sort"} onToggle={() => setMenu(menu === "sort" ? null : "sort")} testId="ctl-sort">
          {(Object.keys(SORT_LABEL) as SortMode[]).map((k) => (
            <MenuItem key={k} active={filters.sort === k} onClick={() => { onFilters({ ...filters, sort: k }); setMenu(null); }}>
              {SORT_LABEL[k]}
            </MenuItem>
          ))}
        </Dropdown>
        <button
          type="button"
          onClick={() => (menu === "filter" ? setMenu(null) : openFilter())}
          aria-expanded={menu === "filter"}
          data-testid="ctl-filter"
          className={cn("flex h-11 items-center gap-2 border bg-white px-4 text-sm transition-colors hover:border-ink/40", menu === "filter" ? "border-ink" : "border-sand", active ? "text-ink" : "text-ink-soft")}
        >
          <SlidersHorizontal className="h-4 w-4 text-gold-dark" aria-hidden /> Filter{active ? ` (${active})` : ""}
        </button>
      </div>

      {menu === "filter" && (
        <div className="relative z-10 mt-3">
          <FilterPanel draft={draft} onDraft={setDraft} matching={matchingDraft} onClose={() => { setDraft(filters); setMenu(null); }} onApply={() => { onFilters(draft); setMenu(null); }} />
        </div>
      )}

      <div className="mt-6 space-y-5">
        {!visible.length && (
          <div className="border border-sand bg-white p-8 text-center text-ink-soft">
            Kein Zimmer passt zu diesen Filtern.{" "}
            <button type="button" onClick={() => onFilters({ ...filters, occupancy: [], features: [], beds: [], rates: [], categories: [], priceMin: null, priceMax: null })} className="font-semibold text-gold-dark underline underline-offset-4">
              Filter zurücksetzen
            </button>
          </div>
        )}
        {filters.view === "rooms"
          ? visible.map((room) => card(room))
          : ratePlans
              .filter((r) => !filters.rates.length || filters.rates.includes(r.id))
              .map((plan) => (
                <div key={plan.id} className="space-y-5">
                  <h3 className="border-b border-sand pb-2 font-serif text-2xl text-gold-dark">{plan.name}</h3>
                  {visible.map((room) => card(room, plan.id))}
                </div>
              ))}
      </div>
    </section>
  );
}
