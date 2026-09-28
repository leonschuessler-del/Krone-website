"use client";

import { ArrowDownToLine, ArrowUpFromLine, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { adminApi, describeApiError } from "../api-client";
import { weekdaysLabel } from "../labels";
import { WeekdayPicker } from "../pricing/shared";
import { Badge, Card, DemoBadge, EmptyState, Notice, hintClass, inputClass, labelClass } from "../ui";

export interface HandoverSlotRow {
  id: string;
  kind: "handover" | "return";
  time: string;
  weekdays: number[] | null;
  label: string | null;
  active: boolean;
  isDemo: boolean;
}

function SlotColumn({ kind, slots }: { kind: "handover" | "return"; slots: HandoverSlotRow[] }) {
  const router = useRouter();
  const [time, setTime] = useState(kind === "handover" ? "10:00" : "22:00");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const title = kind === "handover" ? "Übergabe" : "Rückgabe";
  const list = slots.filter((s) => s.kind === kind).sort((a, b) => a.time.localeCompare(b.time));

  async function call(key: string, url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
    setBusy(key);
    setError(null);
    const res = await adminApi(url, { method, body });
    setBusy(null);
    if (!res.ok) {
      setError(describeApiError(res));
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {kind === "handover" ? <ArrowDownToLine className="h-5 w-5 text-gold" /> : <ArrowUpFromLine className="h-5 w-5 text-gold" />}
          {title}
        </span>
      }
      description={
        kind === "handover"
          ? "Zeitpunkte, zu denen Gäste die Räume übernehmen können (am Veranstaltungstag oder am Vortag, vor Beginn)."
          : "Zeitpunkte für die Rückgabe (nach Veranstaltungsende, am selben oder am Folgetag)."
      }
      bodyClassName="p-0"
    >
      {error && <Notice tone="danger" className="m-4">{error}</Notice>}
      {list.length === 0 ? (
        <EmptyState title={`Keine ${title}zeiten`}>Ohne Zeiten wird die {title} individuell abgestimmt.</EmptyState>
      ) : (
        <ul className="divide-y divide-sand/70" data-testid={`slots-${kind}`}>
          {list.map((s) => (
            <li key={s.id} className={cn("flex flex-wrap items-center gap-3 px-5 py-3", !s.active && "opacity-60")}>
              <span className="w-20 font-serif text-2xl font-semibold lining-nums tabular-nums">{s.time}</span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-semibold">{weekdaysLabel(s.weekdays)}</span>
                {s.label && s.label !== `${s.time} Uhr` && <span className="text-xs text-muted">{s.label}</span>}
              </span>
              {s.isDemo && <DemoBadge />}
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#b8904a]"
                  checked={s.active}
                  disabled={busy !== null}
                  onChange={(e) => call(`toggle-${s.id}`, `/api/admin/handover-slots/${encodeURIComponent(s.id)}`, "PATCH", { active: e.target.checked })}
                />
                {s.active ? <Badge tone="success">aktiv</Badge> : <Badge>inaktiv</Badge>}
              </label>
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-danger-pale hover:text-danger disabled:opacity-40"
                disabled={busy !== null}
                aria-label={`${title} ${s.time} löschen`}
                title="Löschen"
                onClick={() => {
                  if (window.confirm(`${title} ${s.time} Uhr löschen?`)) void call(`del-${s.id}`, `/api/admin/handover-slots/${encodeURIComponent(s.id)}`, "DELETE");
                }}
              >
                {busy === `del-${s.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="space-y-3 border-t border-sand bg-paper/60 px-5 py-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await call("create", "/api/admin/handover-slots", "POST", {
            kind,
            time,
            weekdays: weekdays.length && weekdays.length < 7 ? weekdays : null,
            label: `${time} Uhr`,
            active: true,
          });
          if (ok) setWeekdays([]);
        }}
      >
        <p className="text-sm font-semibold">Neue {title}zeit</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={`slot-time-${kind}`} className={labelClass}>
              Uhrzeit
            </label>
            <input id={`slot-time-${kind}`} type="time" step={900} className={cn(inputClass, "w-32")} value={time} onChange={(e) => setTime(e.target.value)} required />
          </div>
          <div>
            <p className={labelClass}>Wochentage</p>
            <WeekdayPicker idPrefix={`slot-wd-${kind}`} value={weekdays} onChange={setWeekdays} />
          </div>
          <Button type="submit" size="sm" disabled={busy !== null} className="h-[2.6rem]">
            {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Hinzufügen
          </Button>
        </div>
        <p className={hintClass}>Keine Wochentage gewählt = jeden Tag.</p>
      </form>
    </Card>
  );
}

export function HandoverManager({ slots }: { slots: HandoverSlotRow[] }) {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <SlotColumn kind="handover" slots={slots} />
      <SlotColumn kind="return" slots={slots} />
    </div>
  );
}
