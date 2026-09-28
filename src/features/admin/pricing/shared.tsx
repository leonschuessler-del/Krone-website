"use client";

import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { adminApi, describeApiError } from "../api-client";
import { WEEKDAYS } from "../labels";

export interface SpaceOption {
  id: string;
  name: string;
  code: string;
  color: string;
  bookable: boolean;
  active: boolean;
}

export function WeekdayPicker({ value, onChange, idPrefix }: { value: number[]; onChange: (v: number[]) => void; idPrefix: string }) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Wochentage">
      {WEEKDAYS.map((d) => {
        const on = value.includes(d.n);
        return (
          <label
            key={d.n}
            className={cn(
              "grid h-9 w-10 cursor-pointer select-none place-items-center rounded-lg border text-sm font-semibold transition-colors",
              on ? "border-ink bg-ink text-paper" : "border-stone/80 bg-white text-ink-soft hover:border-ink/40",
            )}
            title={d.long}
          >
            <input
              id={`${idPrefix}-${d.n}`}
              type="checkbox"
              className="sr-only"
              checked={on}
              onChange={() => onChange(on ? value.filter((x) => x !== d.n) : [...value, d.n].sort((a, b) => a - b))}
            />
            {d.short}
          </label>
        );
      })}
    </div>
  );
}

export function SpacePicker({ spaces, value, onChange }: { spaces: SpaceOption[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {spaces.map((s) => {
        const on = value.includes(s.id);
        return (
          <label
            key={s.id}
            className={cn(
              "inline-flex cursor-pointer select-none items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold transition-colors",
              on ? "border-ink bg-ink text-paper" : "border-stone/80 bg-white text-ink-soft hover:border-ink/40",
            )}
          >
            <input type="checkbox" className="sr-only" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== s.id) : [...value, s.id])} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.name}
          </label>
        );
      })}
    </div>
  );
}

export function Check({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-sand bg-paper px-3 py-2">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#b8904a]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm">
        <span className="font-semibold">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Save/delete helper for the CRUD dialogs. */
export function useCrud(basePath: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(id: string | null, body: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    const res = await adminApi(id ? `${basePath}/${encodeURIComponent(id)}` : basePath, { method: id ? "PATCH" : "POST", body });
    setBusy(false);
    if (!res.ok) {
      setError(describeApiError(res));
      return false;
    }
    router.refresh();
    return true;
  }

  async function remove(id: string): Promise<{ ok: boolean; data?: unknown }> {
    setBusy(true);
    setError(null);
    const res = await adminApi(`${basePath}/${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return { ok: false };
    }
    router.refresh();
    return { ok: true, data: res.data };
  }

  return { busy, error, setError, save, remove };
}

export function RowActions({ onEdit, onDelete, busy, label }: { onEdit: () => void; onDelete: () => void; busy: boolean; label: string }) {
  const [confirm, setConfirm] = useState(false);
  if (confirm) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Button size="sm" variant="ghost" className="h-8 px-2.5" onClick={() => setConfirm(false)} disabled={busy}>
          Nein
        </Button>
        <Button
          size="sm"
          variant="danger"
          className="h-8 px-2.5"
          disabled={busy}
          onClick={() => {
            onDelete();
            setConfirm(false);
          }}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Löschen
        </Button>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={onEdit} className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-cream hover:text-ink" aria-label={`${label} bearbeiten`} title="Bearbeiten">
        <Pencil className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => setConfirm(true)} className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-danger-pale hover:text-danger" aria-label={`${label} löschen`} title="Löschen">
        <Trash2 className="h-4 w-4" />
      </button>
    </span>
  );
}
