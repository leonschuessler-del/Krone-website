"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { EXTRA_PRICE_MODEL_LABEL } from "../labels";
import { centsToEuroInput, parseEuroInput, parseIntInput } from "../money";
import { Badge, Card, DemoBadge, EmptyState, Notice, hintClass, inputClass, labelClass, tableClass, tdClass, thClass } from "../ui";
import { Check, RowActions, useCrud } from "./shared";

export interface ExtraRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  priceModel: "flat" | "per_hour" | "per_day" | "per_person" | "per_unit" | "on_request";
  unitPrice: number | null;
  maxQuantity: number;
  confirmed: boolean;
  active: boolean;
  isDemo: boolean;
  sortOrder: number;
}

interface FormState {
  name: string;
  description: string;
  category: string;
  priceModel: ExtraRow["priceModel"];
  unitPrice: string;
  maxQuantity: string;
  sortOrder: string;
  confirmed: boolean;
  active: boolean;
  isDemo: boolean;
}

const toForm = (r: ExtraRow | null, nextSort: number): FormState => ({
  name: r?.name ?? "",
  description: r?.description ?? "",
  category: r?.category ?? "service",
  priceModel: r?.priceModel ?? "flat",
  unitPrice: centsToEuroInput(r?.unitPrice ?? null),
  maxQuantity: String(r?.maxQuantity ?? 1),
  sortOrder: String(r?.sortOrder ?? nextSort),
  confirmed: r?.confirmed ?? false,
  active: r?.active ?? true,
  isDemo: r?.isDemo ?? false,
});

const CATEGORIES = ["service", "technik", "raum", "zeit", "hotel"];

export function ExtrasSection({ extras }: { extras: ExtraRow[] }) {
  const crud = useCrud("/api/admin/extras");
  const [editing, setEditing] = useState<ExtraRow | "new" | null>(null);
  const nextSort = (extras.reduce((m, e) => Math.max(m, e.sortOrder), 0) || 0) + 10;
  const [form, setForm] = useState<FormState>(() => toForm(null, nextSort));
  const [localError, setLocalError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const open = (r: ExtraRow | null) => {
    setForm(toForm(r, nextSort));
    setLocalError(null);
    crud.setError(null);
    setEditing(r ?? "new");
  };

  async function submit() {
    setLocalError(null);
    if (!form.name.trim()) return setLocalError("Bitte einen Namen angeben.");
    const price = parseEuroInput(form.unitPrice);
    if (!price.ok) return setLocalError(price.error);
    const max = parseIntInput(form.maxQuantity, { min: 1, max: 1000 });
    if (!max.ok || max.value === null) return setLocalError("Maximale Menge: mindestens 1.");
    const sort = parseIntInput(form.sortOrder, { min: 0, max: 100000 });
    if (!sort.ok || sort.value === null) return setLocalError("Sortierung: bitte Zahl angeben.");
    const ok = await crud.save(editing === "new" ? null : (editing?.id ?? null), {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || "service",
      priceModel: form.priceModel,
      unitPrice: form.priceModel === "on_request" ? null : price.cents,
      maxQuantity: max.value,
      confirmed: form.confirmed,
      active: form.active,
      sortOrder: sort.value,
      isDemo: form.isDemo,
    });
    if (ok) setEditing(null);
  }

  async function remove(r: ExtraRow) {
    setInfo(null);
    const res = await crud.remove(r.id);
    const data = res.data as { deactivated?: boolean } | undefined;
    if (res.ok && data?.deactivated) setInfo(`„${r.name}“ wird in Buchungen verwendet und wurde deshalb deaktiviert statt gelöscht.`);
  }

  return (
    <Card
      id="extras"
      title="Zusatzleistungen (Extras)"
      description="Nur Extras mit „wird angeboten“ erscheinen im Live-Betrieb auf der Website. Im Demo-Modus werden alle aktiven Extras gezeigt (als Demo gekennzeichnet)."
      actions={
        <Button size="sm" onClick={() => open(null)}>
          <Plus className="h-4 w-4" /> Neues Extra
        </Button>
      }
      bodyClassName="p-0"
    >
      {crud.error && editing === null && <Notice tone="danger" className="m-4">{crud.error}</Notice>}
      {info && <Notice tone="info" className="m-4">{info}</Notice>}
      {extras.length === 0 ? (
        <EmptyState title="Keine Zusatzleistungen" />
      ) : (
        <div className="overflow-x-auto">
          <table className={cn(tableClass, "min-w-[860px]")}>
            <thead>
              <tr>
                <th className={thClass}>Leistung</th>
                <th className={cn(thClass, "text-right")}>Preis</th>
                <th className={thClass}>Max.</th>
                <th className={thClass}>Angebot</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>
                  <span className="sr-only">Aktionen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {extras.map((e) => (
                <tr key={e.id} className={cn("hover:bg-cream/40", !e.active && "opacity-60")}>
                  <td className={cn(tdClass, "max-w-[360px]")}>
                    <span className="font-semibold">{e.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {e.category}
                      {e.description ? ` · ${e.description}` : ""}
                    </span>
                  </td>
                  <td className={cn(tdClass, "whitespace-nowrap text-right font-semibold tabular-nums")}>
                    {e.priceModel === "on_request" ? "auf Anfrage" : formatMoney(e.unitPrice)}
                    <span className="block text-xs font-normal text-muted">{EXTRA_PRICE_MODEL_LABEL[e.priceModel]}</span>
                  </td>
                  <td className={cn(tdClass, "tabular-nums")}>{e.maxQuantity}</td>
                  <td className={tdClass}>{e.confirmed ? <Badge tone="success">wird angeboten</Badge> : <Badge tone="warning">nicht bestätigt</Badge>}</td>
                  <td className={tdClass}>
                    <span className="flex flex-wrap gap-1">
                      {e.active ? <Badge tone="success">aktiv</Badge> : <Badge>inaktiv</Badge>}
                      {e.isDemo && <DemoBadge />}
                    </span>
                  </td>
                  <td className={cn(tdClass, "text-right")}>
                    <RowActions label={e.name} busy={crud.busy} onEdit={() => open(e)} onDelete={() => remove(e)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => !crud.busy && setEditing(null)}
        title={editing === "new" ? "Neue Zusatzleistung" : "Zusatzleistung bearbeiten"}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={crud.busy}>
              Abbrechen
            </Button>
            <Button size="sm" onClick={submit} disabled={crud.busy}>
              {crud.busy && <Loader2 className="h-4 w-4 animate-spin" />} Speichern
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {(localError || crud.error) && <Notice tone="danger" className="sm:col-span-2">{localError ?? crud.error}</Notice>}
          <div className="sm:col-span-2">
            <label htmlFor="ex-name" className={labelClass}>
              Name
            </label>
            <input id="ex-name" className={inputClass} value={form.name} maxLength={160} onChange={(e) => upd("name", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="ex-desc" className={labelClass}>
              Beschreibung
            </label>
            <textarea id="ex-desc" rows={2} className={cn(inputClass, "resize-y")} value={form.description} maxLength={1000} onChange={(e) => upd("description", e.target.value)} />
          </div>
          <div>
            <label htmlFor="ex-model" className={labelClass}>
              Preismodell
            </label>
            <select id="ex-model" className={inputClass} value={form.priceModel} onChange={(e) => upd("priceModel", e.target.value as FormState["priceModel"])}>
              {Object.entries(EXTRA_PRICE_MODEL_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ex-price" className={labelClass}>
              Preis (EUR)
            </label>
            <input
              id="ex-price"
              inputMode="decimal"
              className={inputClass}
              value={form.priceModel === "on_request" ? "" : form.unitPrice}
              disabled={form.priceModel === "on_request"}
              onChange={(e) => upd("unitPrice", e.target.value)}
              placeholder="leer = Preis folgt"
            />
          </div>
          <div>
            <label htmlFor="ex-cat" className={labelClass}>
              Kategorie
            </label>
            <input id="ex-cat" list="ex-cats" className={inputClass} value={form.category} maxLength={40} onChange={(e) => upd("category", e.target.value)} />
            <datalist id="ex-cats">
              {CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="ex-max" className={labelClass}>
                Max. Menge
              </label>
              <input id="ex-max" inputMode="numeric" className={inputClass} value={form.maxQuantity} onChange={(e) => upd("maxQuantity", e.target.value)} />
            </div>
            <div>
              <label htmlFor="ex-sort" className={labelClass}>
                Sortierung
              </label>
              <input id="ex-sort" inputMode="numeric" className={inputClass} value={form.sortOrder} onChange={(e) => upd("sortOrder", e.target.value)} />
            </div>
          </div>
          <div className="sm:col-span-2 grid gap-2 sm:grid-cols-3">
            <Check label="Wird angeboten" hint="tatsächlich im Angebot (bestätigt)" checked={form.confirmed} onChange={(v) => upd("confirmed", v)} />
            <Check label="Aktiv" checked={form.active} onChange={(v) => upd("active", v)} />
            <Check label="Demo-Wert" hint="Beispielpreis" checked={form.isDemo} onChange={(v) => upd("isDemo", v)} />
          </div>
          <p className={cn(hintClass, "sm:col-span-2")}>Ein leerer Preis wird auf der Website als „Preis folgt“ angezeigt.</p>
        </div>
      </Dialog>
    </Card>
  );
}
