"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { BundleAdjustment } from "@/domain/pricing";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { BOOKING_MODE_LABEL, PRICE_MODEL_LABEL } from "../labels";
import { centsToEuroInput, parseEuroInput, parseIntInput } from "../money";
import { Badge, Card, DemoBadge, EmptyState, Notice, SpaceChips, hintClass, inputClass, labelClass, tableClass, tdClass, thClass } from "../ui";
import { Check, RowActions, SpacePicker, useCrud, type SpaceOption } from "./shared";

export interface BundleRuleRow {
  id: string;
  name: string;
  spaceIds: string[];
  matchMode: "exact" | "subset";
  adjustment: BundleAdjustment | null;
  bookingMode: "inquiry" | "instant" | "both" | null;
  isFullVenue: boolean;
  priority: number;
  active: boolean;
  isDemo: boolean;
}

type AdjType = "none" | BundleAdjustment["type"];

interface FormState {
  name: string;
  spaceIds: string[];
  matchMode: "exact" | "subset";
  adjType: AdjType;
  adjValue: string;
  fixedModel: "hourly" | "daily" | "flat";
  bookingMode: "" | "inquiry" | "instant" | "both";
  isFullVenue: boolean;
  priority: string;
  active: boolean;
  isDemo: boolean;
}

function toForm(r: BundleRuleRow | null): FormState {
  const a = r?.adjustment ?? null;
  return {
    name: r?.name ?? "",
    spaceIds: r?.spaceIds ?? [],
    matchMode: r?.matchMode ?? "exact",
    adjType: a?.type ?? "percent_discount",
    adjValue: a ? (a.type === "percent_discount" ? String(a.value) : centsToEuroInput(a.value)) : "10",
    fixedModel: a?.type === "fixed_price" ? a.priceModel : "hourly",
    bookingMode: r?.bookingMode ?? "",
    isFullVenue: r?.isFullVenue ?? false,
    priority: String(r?.priority ?? 10),
    active: r?.active ?? true,
    isDemo: r?.isDemo ?? false,
  };
}

export function adjustmentLabel(a: BundleAdjustment | null): string {
  if (!a) return "kein Preisvorteil";
  if (a.type === "percent_discount") return `−${a.value} % auf die Miete`;
  if (a.type === "amount_discount") return `−${formatMoney(a.value)} Rabatt`;
  return `Festpreis ${formatMoney(a.value)} ${PRICE_MODEL_LABEL[a.priceModel]}`;
}

export function BundleRulesSection({ bundles, spaces }: { bundles: BundleRuleRow[]; spaces: SpaceOption[] }) {
  const crud = useCrud("/api/admin/bundle-rules");
  const [editing, setEditing] = useState<BundleRuleRow | "new" | null>(null);
  const [form, setForm] = useState<FormState>(() => toForm(null));
  const [localError, setLocalError] = useState<string | null>(null);
  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const open = (r: BundleRuleRow | null) => {
    setForm(toForm(r));
    setLocalError(null);
    crud.setError(null);
    setEditing(r ?? "new");
  };
  const chips = (ids: string[]) =>
    ids.map((id) => {
      const s = spaces.find((x) => x.id === id);
      return { spaceId: id, name: s?.name ?? id, code: s?.code ?? id, color: s?.color ?? "#999" };
    });

  async function submit() {
    setLocalError(null);
    if (!form.name.trim()) return setLocalError("Bitte einen Namen angeben.");
    if (form.spaceIds.length < 2) return setLocalError("Bitte mindestens zwei Bereiche auswählen.");
    let adjustment: BundleAdjustment | null = null;
    if (form.adjType === "percent_discount") {
      const v = Number(form.adjValue.replace(",", "."));
      if (!Number.isFinite(v) || v < 0 || v > 100) return setLocalError("Rabatt in Prozent zwischen 0 und 100 angeben.");
      adjustment = { type: "percent_discount", value: v };
    } else if (form.adjType === "amount_discount" || form.adjType === "fixed_price") {
      const r = parseEuroInput(form.adjValue);
      if (!r.ok || r.cents === null) return setLocalError(r.ok ? "Bitte einen Betrag angeben." : r.error);
      adjustment = form.adjType === "amount_discount" ? { type: "amount_discount", value: r.cents } : { type: "fixed_price", priceModel: form.fixedModel, value: r.cents };
    }
    const prio = parseIntInput(form.priority, { min: -1000, max: 1000 });
    if (!prio.ok || prio.value === null) return setLocalError("Priorität: bitte ganze Zahl angeben.");
    const ok = await crud.save(editing === "new" ? null : (editing?.id ?? null), {
      name: form.name.trim(),
      spaceIds: form.spaceIds,
      matchMode: form.matchMode,
      adjustment,
      bookingMode: form.bookingMode || null,
      isFullVenue: form.isFullVenue,
      priority: prio.value,
      active: form.active,
      isDemo: form.isDemo,
    });
    if (ok) setEditing(null);
  }

  return (
    <Card
      id="kombipreise"
      title="Kombi-Preise"
      description="Preisvorteile oder Festpreise, wenn bestimmte Bereiche zusammen gebucht werden. Optional mit abweichender Buchungsart (z. B. Gesamtlocation nur auf Anfrage)."
      actions={
        <Button size="sm" onClick={() => open(null)}>
          <Plus className="h-4 w-4" /> Neuer Kombi-Preis
        </Button>
      }
      bodyClassName="p-0"
    >
      {crud.error && editing === null && <Notice tone="danger" className="m-4">{crud.error}</Notice>}
      {bundles.length === 0 ? (
        <EmptyState title="Keine Kombi-Preise" />
      ) : (
        <div className="overflow-x-auto">
          <table className={cn(tableClass, "min-w-[860px]")}>
            <thead>
              <tr>
                <th className={thClass}>Name</th>
                <th className={thClass}>Bereiche</th>
                <th className={thClass}>Preisvorteil</th>
                <th className={thClass}>Buchungsart</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>
                  <span className="sr-only">Aktionen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {bundles.map((b) => (
                <tr key={b.id} className={cn("hover:bg-cream/40", !b.active && "opacity-60")}>
                  <td className={tdClass}>
                    <span className="font-semibold">{b.name}</span>
                    <span className="block text-xs text-muted">
                      {b.matchMode === "exact" ? "genau diese Auswahl" : "Auswahl enthält diese Bereiche"} · Prio. {b.priority}
                    </span>
                  </td>
                  <td className={cn(tdClass, "max-w-[300px]")}>
                    <SpaceChips spaces={chips(b.spaceIds)} compact={b.spaceIds.length > 4} />
                  </td>
                  <td className={cn(tdClass, "text-sm")}>{adjustmentLabel(b.adjustment)}</td>
                  <td className={cn(tdClass, "text-sm")}>
                    {b.bookingMode ? BOOKING_MODE_LABEL[b.bookingMode] : <span className="text-muted">wie Bereiche</span>}
                    {b.isFullVenue && <span className="block text-xs text-gold-dark">Gesamtlocation</span>}
                  </td>
                  <td className={tdClass}>
                    <span className="flex flex-wrap gap-1">
                      {b.active ? <Badge tone="success">aktiv</Badge> : <Badge>inaktiv</Badge>}
                      {b.isDemo && <DemoBadge />}
                    </span>
                  </td>
                  <td className={cn(tdClass, "text-right")}>
                    <RowActions label={b.name} busy={crud.busy} onEdit={() => open(b)} onDelete={() => crud.remove(b.id)} />
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
        title={editing === "new" ? "Neuer Kombi-Preis" : "Kombi-Preis bearbeiten"}
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
            <label htmlFor="bu-name" className={labelClass}>
              Name
            </label>
            <input id="bu-name" className={inputClass} value={form.name} maxLength={160} onChange={(e) => upd("name", e.target.value)} placeholder="z. B. Sommerfest-Paket" />
          </div>
          <div className="sm:col-span-2">
            <p className={labelClass}>Bereiche</p>
            <SpacePicker spaces={spaces} value={form.spaceIds} onChange={(v) => upd("spaceIds", v)} />
          </div>
          <div className="sm:col-span-2">
            <p className={labelClass}>Gilt, wenn die Auswahl …</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["exact", "genau diese Bereiche umfasst"],
                  ["subset", "diese Bereiche (mindestens) enthält"],
                ] as const
              ).map(([v, l]) => (
                <label key={v} className={cn("cursor-pointer rounded-xl border px-3 py-2 text-sm", form.matchMode === v ? "border-gold bg-gold-pale/50" : "border-stone/70 bg-white")}>
                  <input type="radio" className="sr-only" checked={form.matchMode === v} onChange={() => upd("matchMode", v)} />
                  {l}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="bu-adj" className={labelClass}>
              Preisvorteil
            </label>
            <select id="bu-adj" className={inputClass} value={form.adjType} onChange={(e) => upd("adjType", e.target.value as AdjType)}>
              <option value="percent_discount">Rabatt in %</option>
              <option value="amount_discount">Rabatt in EUR</option>
              <option value="fixed_price">Festpreis</option>
              <option value="none">kein Preisvorteil</option>
            </select>
          </div>
          {form.adjType !== "none" && (
            <div className={cn(form.adjType === "fixed_price" && "grid grid-cols-2 gap-2")}>
              <div>
                <label htmlFor="bu-val" className={labelClass}>
                  {form.adjType === "percent_discount" ? "Prozent" : "Betrag (EUR)"}
                </label>
                <input id="bu-val" inputMode="decimal" className={inputClass} value={form.adjValue} onChange={(e) => upd("adjValue", e.target.value)} />
              </div>
              {form.adjType === "fixed_price" && (
                <div>
                  <label htmlFor="bu-fixed" className={labelClass}>
                    Modell
                  </label>
                  <select id="bu-fixed" className={inputClass} value={form.fixedModel} onChange={(e) => upd("fixedModel", e.target.value as FormState["fixedModel"])}>
                    <option value="hourly">pro Stunde</option>
                    <option value="daily">pro Tag</option>
                    <option value="flat">pauschal</option>
                  </select>
                </div>
              )}
            </div>
          )}
          <div>
            <label htmlFor="bu-mode" className={labelClass}>
              Buchungsart für diese Kombination
            </label>
            <select id="bu-mode" className={inputClass} value={form.bookingMode} onChange={(e) => upd("bookingMode", e.target.value as FormState["bookingMode"])}>
              <option value="">wie bei den Bereichen</option>
              <option value="inquiry">Nur Anfrage</option>
              <option value="instant">Nur Sofortbuchung</option>
              <option value="both">Anfrage & Sofortbuchung</option>
            </select>
          </div>
          <div>
            <label htmlFor="bu-prio" className={labelClass}>
              Priorität
            </label>
            <input id="bu-prio" inputMode="numeric" className={inputClass} value={form.priority} onChange={(e) => upd("priority", e.target.value)} />
            <p className={hintClass}>Bei mehreren passenden Kombis gilt die höchste.</p>
          </div>
          <Check label="Gesamtlocation" hint="Kennzeichnet das Paket „Gesamte Location“" checked={form.isFullVenue} onChange={(v) => upd("isFullVenue", v)} />
          <Check label="Aktiv" checked={form.active} onChange={(v) => upd("active", v)} />
          <Check label="Demo-Wert" hint="Kennzeichnet Beispielpreise" checked={form.isDemo} onChange={(v) => upd("isDemo", v)} />
        </div>
      </Dialog>
    </Card>
  );
}
