"use client";

import { AlertTriangle, CheckCircle2, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { localRangeToInterval, zonedDateTimeToUtc } from "@/domain/time";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { adminApi, describeApiError } from "../api-client";
import { Card, Notice, hintClass, inputClass, labelClass } from "../ui";

interface SpaceOption {
  id: string;
  name: string;
  code: string;
  color: string;
  bookable: boolean;
}

export function BlockForm({ spaces, today }: { spaces: SpaceOption[]; today: string }) {
  const router = useRouter();
  const [spaceIds, setSpaceIds] = useState<string[]>([]);
  const [date, setDate] = useState(today);
  const [multiDay, setMultiDay] = useState(false);
  const [endDate, setEndDate] = useState(today);
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [type, setType] = useState<"blocked" | "maintenance">("blocked");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const effStart = allDay ? "00:00" : startTime;
  const effEnd = allDay ? "24:00" : endTime;

  const preview = useMemo(() => {
    try {
      if (!date) return null;
      const range =
        multiDay && endDate && endDate !== date
          ? { start: zonedDateTimeToUtc(date, effStart), end: zonedDateTimeToUtc(endDate, effEnd) }
          : localRangeToInterval(date, effStart, effEnd);
      if (range.end <= range.start) return { error: "Das Ende liegt vor dem Beginn." };
      return { text: `${formatDateTime(range.start)} Uhr – ${formatDateTime(range.end)} Uhr` };
    } catch {
      return null;
    }
  }, [date, endDate, multiDay, effStart, effEnd]);

  const toggle = (id: string) => setSpaceIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (spaceIds.length === 0) return setMessage({ tone: "danger", text: "Bitte mindestens einen Bereich auswählen." });
    if (!reason.trim()) return setMessage({ tone: "danger", text: "Bitte einen Grund angeben." });
    if (preview && "error" in preview) return setMessage({ tone: "danger", text: preview.error ?? "Ungültiger Zeitraum." });
    setBusy(true);
    const res = await adminApi<{ created: number }>("/api/admin/availability-blocks", {
      method: "POST",
      body: {
        spaceIds,
        date,
        endDate: multiDay && endDate !== date ? endDate : null,
        startTime: effStart,
        endTime: effEnd,
        type,
        reason: reason.trim(),
      },
    });
    setBusy(false);
    if (!res.ok) return setMessage({ tone: "danger", text: describeApiError(res) });
    setMessage({ tone: "success", text: `${res.data.created} Sperrzeit${res.data.created === 1 ? "" : "en"} angelegt.` });
    setReason("");
    setSpaceIds([]);
    router.refresh();
  }

  return (
    <Card title="Neue Sperrzeit" description="Pro ausgewähltem Bereich wird eine Sperre angelegt.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate data-testid="block-form">
        <fieldset>
          <div className="mb-1.5 flex items-center justify-between">
            <legend className={labelClass}>Bereiche</legend>
            <button
              type="button"
              className="text-xs font-semibold text-gold-dark hover:underline"
              onClick={() => setSpaceIds(spaceIds.length === spaces.length ? [] : spaces.map((s) => s.id))}
            >
              {spaceIds.length === spaces.length ? "Keine" : "Alle"} auswählen
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {spaces.map((s) => {
              const on = spaceIds.includes(s.id);
              return (
                <label
                  key={s.id}
                  className={cn(
                    "inline-flex cursor-pointer select-none items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                    on ? "border-ink bg-ink text-paper" : "border-stone/80 bg-white text-ink-soft hover:border-ink/40",
                  )}
                >
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(s.id)} value={s.id} name="spaceIds" />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
                  {s.name}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="block-date" className={labelClass}>
              {multiDay ? "Von (Datum)" : "Datum"}
            </label>
            <input
              id="block-date"
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                if (endDate < e.target.value) setEndDate(e.target.value);
              }}
              required
            />
          </div>
          {multiDay && (
            <div>
              <label htmlFor="block-end-date" className={labelClass}>
                Bis (Datum)
              </label>
              <input id="block-end-date" type="date" className={inputClass} min={date} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-[#b8904a]" checked={multiDay} onChange={(e) => setMultiDay(e.target.checked)} />
            Mehrere Tage
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-[#b8904a]" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            Ganztägig
          </label>
        </div>

        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="block-start" className={labelClass}>
                Beginn
              </label>
              <input id="block-start" type="time" step={900} className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label htmlFor="block-end" className={labelClass}>
                Ende
              </label>
              <input id="block-end" type="time" step={900} className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            {!multiDay && <p className={cn(hintClass, "col-span-2 mt-0")}>Ende vor Beginn = bis zum Folgetag (z. B. 18:00–02:00).</p>}
          </div>
        )}

        <fieldset>
          <legend className={labelClass}>Art</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["blocked", "Gesperrt", "z. B. Eigenveranstaltung, Betriebsruhe"],
                ["maintenance", "Wartung", "Reinigung, Reparatur, Technik"],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={cn(
                  "cursor-pointer rounded-xl border px-3 py-2 text-sm transition-colors",
                  type === value ? "border-gold bg-gold-pale/50 ring-1 ring-gold/40" : "border-stone/70 bg-white hover:border-ink/30",
                )}
              >
                <input type="radio" name="type" value={value} className="sr-only" checked={type === value} onChange={() => setType(value)} />
                <span className="font-semibold">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="block-reason" className={labelClass}>
            Grund (intern)
          </label>
          <input
            id="block-reason"
            className={inputClass}
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            placeholder="z. B. Weihnachtsfeier des Hauses"
            required
          />
        </div>

        {preview && (
          <p className={cn("rounded-lg px-3 py-2 text-sm", "error" in preview ? "bg-danger-pale text-danger" : "bg-cream text-ink-soft")}>
            {"error" in preview ? preview.error : <>Zeitraum: <strong>{preview.text}</strong></>}
          </p>
        )}

        {message && (
          <Notice tone={message.tone} className="flex items-start gap-2">
            {message.tone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span data-testid="block-message">{message.text}</span>
          </Notice>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          Sperrzeit anlegen
        </Button>
      </form>
    </Card>
  );
}
