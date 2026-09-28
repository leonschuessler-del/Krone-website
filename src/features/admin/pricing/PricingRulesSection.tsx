"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import { formatDateShort, formatMoney } from "@/lib/format";
import { PRICE_MODEL_LABEL, weekdaysLabel } from "../labels";
import { centsToEuroInput, parseEuroInput, parseIntInput } from "../money";
import { Badge, Card, DemoBadge, EmptyState, Notice, SpaceDot, hintClass, inputClass, labelClass, tableClass, tdClass, thClass } from "../ui";
import { Check, RowActions, useCrud, WeekdayPicker, type SpaceOption } from "./shared";

export interface PricingRuleRow {
  id: string;
  spaceId: string;
  label: string;
  priceModel: "hourly" | "daily" | "flat";
  amount: number;
  weekdays: number[] | null;
  validFrom: string | null;
  validTo: string | null;
  minDurationMinutes: number | null;
  priority: number;
  active: boolean;
  isDemo: boolean;
}

interface FormState {
  spaceId: string;
  label: string;
  priceModel: "hourly" | "daily" | "flat";
  amount: string;
  weekdays: number[];
  validFrom: string;
  validTo: string;
  minDuration: string;
  priority: string;
  active: boolean;
  isDemo: boolean;
}

const toForm = (r: PricingRuleRow | null, spaces: SpaceOption[]): FormState => ({
  spaceId: r?.spaceId ?? spaces.find((s) => s.bookable)?.id ?? spaces[0]?.id ?? "",
  label: r?.label ?? "",
  priceModel: r?.priceModel ?? "hourly",
  amount: centsToEuroInput(r?.amount ?? null),
  weekdays: r?.weekdays ?? [],
  validFrom: r?.validFrom ?? "",
  validTo: r?.validTo ?? "",
  minDuration: r?.minDurationMinutes != null ? String(r.minDurationMinutes) : "",
  priority: String(r?.priority ?? 10),
  active: r?.active ?? true,
  isDemo: r?.isDemo ?? false,
});

export function PricingRulesSection({ rules, spaces }: { rules: PricingRuleRow[]; spaces: SpaceOption[] }) {
  const crud = useCrud("/api/admin/pricing-rules");
  const [editing, setEditing] = useState<PricingRuleRow | "new" | null>(null);
  const [form, setForm] = useState<FormState>(() => toForm(null, spaces));
  const [localError, setLocalError] = useState<string | null>(null);
  const space = (id: string) => spaces.find((s) => s.id === id);

  const open = (r: PricingRuleRow | null) => {
    setForm(toForm(r, spaces));
    setLocalError(null);
    crud.setError(null);
    setEditing(r ?? "new");
  };
  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setLocalError(null);
    const amount = parseEuroInput(form.amount);
    if (!amount.ok || amount.cents === null) return setLocalError(amount.ok ? "Bitte einen Betrag angeben." : amount.error);
    const minDur = parseIntInput(form.minDuration, { min: 0, max: 20160 });
    if (!minDur.ok) return setLocalError(`Mindestdauer: ${minDur.error}`);
    const prio = parseIntInput(form.priority, { min: -1000, max: 1000 });
    if (!prio.ok || prio.value === null) return setLocalError("Priorität: bitte ganze Zahl angeben.");
    if (!form.label.trim()) return setLocalError("Bitte eine Bezeichnung angeben.");
    const ok = await crud.save(editing === "new" ? null : (editing?.id ?? null), {
      spaceId: form.spaceId,
      label: form.label.trim(),
      priceModel: form.priceModel,
      amount: amount.cents,
      weekdays: form.weekdays.length && form.weekdays.length < 7 ? form.weekdays : null,
      validFrom: form.validFrom || null,
      validTo: form.validTo || null,
      minDurationMinutes: minDur.value,
      priority: prio.value,
      active: form.active,
      isDemo: form.isDemo,
    });
    if (ok) setEditing(null);
  }

  const sorted = [...rules].sort((a, b) => (space(a.spaceId)?.name ?? "").localeCompare(space(b.spaceId)?.name ?? "") || b.priority - a.priority);

  return (
    <Card
      id="preisregeln"
      title="Preisregeln"
      description="Abweichende Preise nach Wochentag, Saison oder Dauer. Bei mehreren passenden Regeln gilt die mit der höchsten Priorität; sonst der Grundpreis des Bereichs."
      actions={
        <Button size="sm" onClick={() => open(null)} data-testid="new-pricing-rule">
          <Plus className="h-4 w-4" /> Neue Regel
        </Button>
      }
      bodyClassName="p-0"
    >
      {crud.error && editing === null && <Notice tone="danger" className="m-4">{crud.error}</Notice>}
      {rules.length === 0 ? (
        <EmptyState title="Keine Preisregeln">Es gilt der Grundpreis des jeweiligen Bereichs.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className={cn(tableClass, "min-w-[860px]")}>
            <thead>
              <tr>
                <th className={thClass}>Bereich / Regel</th>
                <th className={cn(thClass, "text-right")}>Preis</th>
                <th className={thClass}>Gilt für</th>
                <th className={thClass}>Prio.</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>
                  <span className="sr-only">Aktionen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const s = space(r.spaceId);
                return (
                  <tr key={r.id} className={cn("hover:bg-cream/40", !r.active && "opacity-60")}>
                    <td className={tdClass}>
                      <span className="flex items-center gap-2 font-semibold">
                        {s && <SpaceDot color={s.color} className="ring-0" />}
                        {s?.name ?? r.spaceId}
                      </span>
                      <span className="text-xs text-muted">{r.label}</span>
                    </td>
                    <td className={cn(tdClass, "whitespace-nowrap text-right font-semibold tabular-nums")}>
                      {formatMoney(r.amount)} <span className="block text-xs font-normal text-muted">{PRICE_MODEL_LABEL[r.priceModel]}</span>
                    </td>
                    <td className={cn(tdClass, "text-xs text-ink-soft")}>
                      <span className="block">{weekdaysLabel(r.weekdays)}</span>
                      {(r.validFrom || r.validTo) && (
                        <span className="block">
                          {r.validFrom ? formatDateShort(r.validFrom) : "…"} – {r.validTo ? formatDateShort(r.validTo) : "…"}
                          {r.validFrom ? ` ${r.validFrom.slice(0, 4)}` : ""}
                        </span>
                      )}
                      {r.minDurationMinutes != null && <span className="block">ab {r.minDurationMinutes / 60} Std.</span>}
                    </td>
                    <td className={cn(tdClass, "tabular-nums")}>{r.priority}</td>
                    <td className={tdClass}>
                      <span className="flex flex-wrap gap-1">
                        {r.active ? <Badge tone="success">aktiv</Badge> : <Badge>inaktiv</Badge>}
                        {r.isDemo && <DemoBadge />}
                      </span>
                    </td>
                    <td className={cn(tdClass, "text-right")}>
                      <RowActions label={r.label} busy={crud.busy} onEdit={() => open(r)} onDelete={() => crud.remove(r.id)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => !crud.busy && setEditing(null)}
        title={editing === "new" ? "Neue Preisregel" : "Preisregel bearbeiten"}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={crud.busy}>
              Abbrechen
            </Button>
            <Button size="sm" onClick={submit} disabled={crud.busy} data-testid="save-pricing-rule">
              {crud.busy && <Loader2 className="h-4 w-4 animate-spin" />} Speichern
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {(localError || crud.error) && <Notice tone="danger" className="sm:col-span-2">{localError ?? crud.error}</Notice>}
          <div>
            <label htmlFor="pr-space" className={labelClass}>
              Bereich
            </label>
            <select id="pr-space" className={inputClass} value={form.spaceId} onChange={(e) => upd("spaceId", e.target.value)}>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pr-label" className={labelClass}>
              Bezeichnung
            </label>
            <input id="pr-label" className={inputClass} value={form.label} maxLength={120} onChange={(e) => upd("label", e.target.value)} placeholder="z. B. Wochenende" />
          </div>
          <div>
            <label htmlFor="pr-model" className={labelClass}>
              Preismodell
            </label>
            <select id="pr-model" className={inputClass} value={form.priceModel} onChange={(e) => upd("priceModel", e.target.value as FormState["priceModel"])}>
              <option value="hourly">pro Stunde</option>
              <option value="daily">pro Tag</option>
              <option value="flat">pauschal</option>
            </select>
          </div>
          <div>
            <label htmlFor="pr-amount" className={labelClass}>
              Betrag (EUR)
            </label>
            <input id="pr-amount" inputMode="decimal" className={inputClass} value={form.amount} onChange={(e) => upd("amount", e.target.value)} placeholder="z. B. 144" />
          </div>
          <div className="sm:col-span-2">
            <p className={labelClass}>Wochentage</p>
            <WeekdayPicker idPrefix="pr-wd" value={form.weekdays} onChange={(v) => upd("weekdays", v)} />
            <p className={hintClass}>Keine Auswahl = alle Tage.</p>
          </div>
          <div>
            <label htmlFor="pr-from" className={labelClass}>
              Gültig ab (optional)
            </label>
            <input id="pr-from" type="date" className={inputClass} value={form.validFrom} onChange={(e) => upd("validFrom", e.target.value)} />
          </div>
          <div>
            <label htmlFor="pr-to" className={labelClass}>
              Gültig bis (optional)
            </label>
            <input id="pr-to" type="date" className={inputClass} value={form.validTo} min={form.validFrom || undefined} onChange={(e) => upd("validTo", e.target.value)} />
          </div>
          <div>
            <label htmlFor="pr-min" className={labelClass}>
              Mindestdauer in Minuten (optional)
            </label>
            <input id="pr-min" inputMode="numeric" className={inputClass} value={form.minDuration} onChange={(e) => upd("minDuration", e.target.value)} placeholder="z. B. 480" />
          </div>
          <div>
            <label htmlFor="pr-prio" className={labelClass}>
              Priorität
            </label>
            <input id="pr-prio" inputMode="numeric" className={inputClass} value={form.priority} onChange={(e) => upd("priority", e.target.value)} />
            <p className={hintClass}>Höhere Zahl gewinnt bei Überschneidungen.</p>
          </div>
          <Check label="Aktiv" checked={form.active} onChange={(v) => upd("active", v)} />
          <Check label="Demo-Wert" hint="Kennzeichnet Beispielpreise" checked={form.isDemo} onChange={(v) => upd("isDemo", v)} />
        </div>
      </Dialog>
    </Card>
  );
}
