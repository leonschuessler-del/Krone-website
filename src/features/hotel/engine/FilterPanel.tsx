"use client";

import { X } from "lucide-react";
import { ratePlans } from "@/content/rates";
import { activeFilterCount, emptyFilters, OCCUPANCY_OPTIONS, roomFacets, toggleIn, type RoomFilters, type SortMode, type ViewMode } from "@/domain/booking-engine";
import { formatMoney } from "@/lib/format";
import { CheckRow, Pill, RadioRow, TextAction } from "./ui";

export interface FilterPanelProps {
  draft: RoomFilters;
  onDraft: (f: RoomFilters) => void;
  onApply: () => void;
  onClose: () => void;
  matching: number;
}

function Group({ title, children, onClear, clearable }: { title: string; children: React.ReactNode; onClear: () => void; clearable: boolean }) {
  return (
    <section className="py-6">
      <h4 className="font-serif text-lg text-gold-dark">{title}</h4>
      <div className="mt-3">{children}</div>
      <TextAction className="mt-3" onClick={onClear} disabled={!clearable}>
        Löschen
      </TextAction>
    </section>
  );
}

/**
 * Full-width filter panel under the controls – display mode, sorting,
 * occupancy, features, beds, rate, room categories and a price range.
 */
export function FilterPanel({ draft, onDraft, onApply, onClose, matching }: FilterPanelProps) {
  const facets = roomFacets();
  const set = (patch: Partial<RoomFilters>) => onDraft({ ...draft, ...patch });
  const min = draft.priceMin ?? facets.price.min;
  const max = draft.priceMax ?? facets.price.max;
  return (
    <div className="border border-sand bg-white px-5 py-5 shadow-[var(--shadow-soft)] md:px-8" role="region" aria-label="Filter" data-testid="filter-panel">
      <div className="flex items-start justify-between">
        <h3 className="font-serif text-2xl text-ink">Filter</h3>
        <button type="button" onClick={onClose} aria-label="Filter schließen" className="grid h-9 w-9 place-items-center border border-sand text-muted hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-x-10 md:grid-cols-2 md:divide-x md:divide-sand [&>*:nth-child(even)]:md:pl-10">
        <section className="py-6">
          <h4 className="font-serif text-lg text-gold-dark">Anzeige</h4>
          <div className="mt-3">
            {(["rooms", "rates"] as ViewMode[]).map((v) => (
              <RadioRow key={v} name="view" checked={draft.view === v} onChange={() => set({ view: v })}>
                {v === "rooms" ? "Anzeige nach Zimmertyp" : "Anzeige nach Tarif"}
              </RadioRow>
            ))}
          </div>
        </section>
        <section className="py-6">
          <h4 className="font-serif text-lg text-gold-dark">Sortieren nach</h4>
          <div className="mt-3">
            {([
              ["recommended", "Empfohlen"],
              ["price-asc", "Niedrigster Preis"],
              ["price-desc", "Höchster Preis"],
            ] as Array<[SortMode, string]>).map(([k, label]) => (
              <RadioRow key={k} name="sort" checked={draft.sort === k} onChange={() => set({ sort: k })}>
                {label}
              </RadioRow>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-x-10 border-t border-sand md:grid-cols-2 md:divide-x md:divide-sand [&>*:nth-child(even)]:md:pl-10">
        <Group title="Belegung" onClear={() => set({ occupancy: [] })} clearable={draft.occupancy.length > 0}>
          {OCCUPANCY_OPTIONS.map((o) => (
            <CheckRow key={o.id} checked={draft.occupancy.includes(o.id)} onChange={() => set({ occupancy: toggleIn(draft.occupancy, o.id) })}>
              {o.label}
            </CheckRow>
          ))}
        </Group>
        <Group title="Ausstattung" onClear={() => set({ features: [] })} clearable={draft.features.length > 0}>
          <div className="grid sm:grid-cols-2">
            {facets.features.map((f) => (
              <CheckRow key={f} checked={draft.features.includes(f)} onChange={() => set({ features: toggleIn(draft.features, f) })}>
                {f}
              </CheckRow>
            ))}
          </div>
        </Group>
      </div>

      <div className="grid gap-x-10 border-t border-sand md:grid-cols-2 md:divide-x md:divide-sand [&>*:nth-child(even)]:md:pl-10">
        <Group title="Betten" onClear={() => set({ beds: [] })} clearable={draft.beds.length > 0}>
          {facets.beds.map((b) => (
            <CheckRow key={b.id} checked={draft.beds.includes(b.id)} onChange={() => set({ beds: toggleIn(draft.beds, b.id) })}>
              {b.label}
            </CheckRow>
          ))}
        </Group>
        <Group title="Tarif" onClear={() => set({ rates: [] })} clearable={draft.rates.length > 0}>
          {ratePlans.map((r) => (
            <CheckRow key={r.id} checked={draft.rates.includes(r.id)} onChange={() => set({ rates: toggleIn(draft.rates, r.id) })}>
              {r.name}
            </CheckRow>
          ))}
        </Group>
      </div>

      <div className="grid gap-x-10 border-t border-sand md:grid-cols-2 md:divide-x md:divide-sand [&>*:nth-child(even)]:md:pl-10">
        <Group title="Zimmerkategorien" onClear={() => set({ categories: [] })} clearable={draft.categories.length > 0}>
          {facets.categories.map((c) => (
            <CheckRow key={c.id} checked={draft.categories.includes(c.id)} onChange={() => set({ categories: toggleIn(draft.categories, c.id) })} testId={`filter-cat-${c.id}`}>
              {c.label}
            </CheckRow>
          ))}
        </Group>
        <section className="py-6">
          <h4 className="font-serif text-lg text-gold-dark">Preis (pro Nacht)</h4>
          <div className="mt-4 px-1">
            <div className="relative h-6">
              <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-sand" />
              <div className="absolute top-1/2 h-1 -translate-y-1/2 bg-gold-dark" style={{ left: `${((min - facets.price.min) / Math.max(1, facets.price.max - facets.price.min)) * 100}%`, right: `${100 - ((max - facets.price.min) / Math.max(1, facets.price.max - facets.price.min)) * 100}%` }} />
              <input type="range" aria-label="Preis von" min={facets.price.min} max={facets.price.max} step={100} value={min} onChange={(e) => set({ priceMin: Math.min(Number(e.target.value), max) })} className="range-thumb absolute inset-0 h-6 w-full appearance-none bg-transparent" />
              <input type="range" aria-label="Preis bis" min={facets.price.min} max={facets.price.max} step={100} value={max} onChange={(e) => set({ priceMax: Math.max(Number(e.target.value), min) })} className="range-thumb absolute inset-0 h-6 w-full appearance-none bg-transparent" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="border border-stone bg-white px-3 py-2">
                <span className="block text-[0.62rem] uppercase tracking-[0.18em] text-muted">Preisspanne von</span>
                <span className="font-serif text-lg tabular-nums">{formatMoney(min)}</span>
              </label>
              <label className="border border-stone bg-white px-3 py-2">
                <span className="block text-[0.62rem] uppercase tracking-[0.18em] text-muted">Preisspanne bis</span>
                <span className="font-serif text-lg tabular-nums">{formatMoney(max)}</span>
              </label>
            </div>
            <TextAction className="mt-3" onClick={() => set({ priceMin: null, priceMax: null })} disabled={draft.priceMin === null && draft.priceMax === null}>
              Zurücksetzen
            </TextAction>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-4 border-t border-sand pt-5">
        <p className="mr-auto text-sm text-ink-soft" aria-live="polite">
          <strong className="text-ink">{matching}</strong> passende {matching === 1 ? "Zimmer" : "Zimmer"}
          {activeFilterCount(draft) > 0 && (
            <>
              {" · "}
              <TextAction onClick={() => onDraft({ ...emptyFilters(), view: draft.view, sort: draft.sort })}>Alle Filter löschen</TextAction>
            </>
          )}
        </p>
        <Pill variant="primary" size="lg" onClick={onApply} data-testid="filter-apply">
          Anwenden
        </Pill>
      </div>
    </div>
  );
}
