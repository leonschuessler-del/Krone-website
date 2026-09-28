"use client";

import { AlertTriangle, CheckCircle2, Copy, Loader2, Plus, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { adminApi, describeApiError } from "../api-client";
import { WEEKDAYS } from "../labels";
import { parseIntInput } from "../money";
import { Check } from "../pricing/shared";
import { Card, DemoBadge, Notice, hintClass, inputClass, labelClass } from "../ui";

type Window = { open: string; close: string };
type Week = Record<string, Window[]>;

export interface SettingsData {
  bookableHours: { weeklyHours: Partial<Record<number, Window[]>>; needsVerification: boolean; isDemo: boolean };
  paymentPolicy: {
    mode: "none" | "full" | "down_payment";
    downPaymentPercent: number | null;
    depositCollection: "with_payment" | "separately";
    depositStrategy: "sum" | "max";
    isDemo: boolean;
  };
  holds: { checkoutHoldMinutes: number; inquiryCreatesHold: boolean; inquiryHoldHours: number };
}

/** "24:00" cannot be shown in <input type=time>; 00:00 as closing time means the same (midnight, next day). */
const toInput = (t: string) => (t === "24:00" ? "00:00" : t);
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

function useSaver() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  async function save(body: unknown) {
    setBusy(true);
    setMsg(null);
    const res = await adminApi("/api/admin/settings", { method: "PATCH", body });
    setBusy(false);
    if (!res.ok) return setMsg({ tone: "danger", text: describeApiError(res) });
    setMsg({ tone: "success", text: "Gespeichert." });
    router.refresh();
  }
  return { busy, msg, save, setMsg };
}

function SaveBar({ busy, msg, onSave, testId }: { busy: boolean; msg: { tone: "success" | "danger"; text: string } | null; onSave: () => void; testId?: string }) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-sand/70 pt-4">
      {msg && (
        <span className={cn("flex items-center gap-1.5 text-sm", msg.tone === "success" ? "text-success" : "text-danger")} role="status">
          {msg.tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {msg.text}
        </span>
      )}
      <Button size="sm" onClick={onSave} disabled={busy} data-testid={testId}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Speichern
      </Button>
    </div>
  );
}

function BookableHoursCard({ initial }: { initial: SettingsData["bookableHours"] }) {
  const [week, setWeek] = useState<Week>(() =>
    Object.fromEntries(WEEKDAYS.map((d) => [String(d.n), (initial.weeklyHours[d.n] ?? []).map((w) => ({ open: toInput(w.open), close: toInput(w.close) }))])),
  );
  const [needsVerification, setNeedsVerification] = useState(initial.needsVerification);
  const [isDemo, setIsDemo] = useState(initial.isDemo);
  const s = useSaver();

  const updateDay = (day: string, windows: Window[]) => setWeek((w) => ({ ...w, [day]: windows }));

  function onSave() {
    for (const [day, windows] of Object.entries(week)) {
      for (const w of windows) {
        if (!/^\d{2}:\d{2}$/.test(w.open) || !/^\d{2}:\d{2}$/.test(w.close)) {
          return s.setMsg({ tone: "danger", text: `${WEEKDAYS[Number(day) - 1]!.long}: bitte Uhrzeiten vollständig angeben.` });
        }
      }
    }
    void s.save({ bookableHours: { weeklyHours: week, needsVerification, isDemo } });
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          Buchungszeiten {initial.isDemo && <DemoBadge />}
        </span>
      }
      description="Zeitfenster pro Wochentag, in denen Bereiche gebucht werden können (Standard für alle Bereiche)."
    >
      <div className="divide-y divide-sand/70" data-testid="weekly-hours">
        {WEEKDAYS.map((d) => {
          const key = String(d.n);
          const windows = week[key] ?? [];
          return (
            <div key={d.n} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
              <p className="w-28 shrink-0 pt-2 text-sm font-semibold">{d.long}</p>
              <div className="flex-1 space-y-2">
                {windows.length === 0 && <p className="pt-2 text-sm text-muted">geschlossen – nicht buchbar</p>}
                {windows.map((w, i) => {
                  const overnight = toMinutes(w.close) <= toMinutes(w.open);
                  return (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        aria-label={`${d.long} von`}
                        className={cn(inputClass, "w-32")}
                        value={w.open}
                        onChange={(e) => updateDay(key, windows.map((x, k) => (k === i ? { ...x, open: e.target.value } : x)))}
                      />
                      <span className="text-muted">bis</span>
                      <input
                        type="time"
                        aria-label={`${d.long} bis`}
                        className={cn(inputClass, "w-32")}
                        value={w.close}
                        onChange={(e) => updateDay(key, windows.map((x, k) => (k === i ? { ...x, close: e.target.value } : x)))}
                      />
                      {overnight && <span className="rounded-full bg-cream px-2 py-0.5 text-xs font-semibold text-ink-soft">{w.close === "00:00" ? "bis Mitternacht" : "bis Folgetag"}</span>}
                      <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-danger-pale hover:text-danger" onClick={() => updateDay(key, windows.filter((_, k) => k !== i))} aria-label="Zeitfenster entfernen">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-gold-dark hover:bg-cream disabled:opacity-40"
                  onClick={() => updateDay(key, [...windows, { open: "10:00", close: "22:00" }])}
                  disabled={windows.length >= 4}
                >
                  <Plus className="h-3.5 w-3.5" /> Fenster
                </button>
                {d.n === 1 && (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-soft hover:bg-cream"
                    onClick={() => setWeek(Object.fromEntries(WEEKDAYS.map((x) => [String(x.n), windows.map((w) => ({ ...w }))])))}
                    title="Montag auf alle Tage übertragen"
                  >
                    <Copy className="h-3.5 w-3.5" /> für alle
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className={hintClass}>Endzeit vor oder gleich der Startzeit bedeutet: bis zum Folgetag (z. B. 09:00 bis 02:00). 00:00 als Ende = Mitternacht.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Check label="Noch zu bestätigen" hint="Zeiten sind Platzhalter und noch nicht final" checked={needsVerification} onChange={setNeedsVerification} />
        <Check label="Demo-Werte" hint="Beispielzeiten für den Demo-Modus" checked={isDemo} onChange={setIsDemo} />
      </div>
      <SaveBar busy={s.busy} msg={s.msg} onSave={onSave} testId="save-hours" />
    </Card>
  );
}

function PaymentCard({ initial }: { initial: SettingsData["paymentPolicy"] }) {
  const [p, setP] = useState(initial);
  const [percent, setPercent] = useState(initial.downPaymentPercent != null ? String(initial.downPaymentPercent) : "30");
  const s = useSaver();

  function onSave() {
    let downPaymentPercent: number | null = null;
    if (p.mode === "down_payment") {
      const r = parseIntInput(percent, { min: 1, max: 100 });
      if (!r.ok || r.value === null) return s.setMsg({ tone: "danger", text: "Anzahlung: bitte Prozentsatz zwischen 1 und 100 angeben." });
      downPaymentPercent = r.value;
    }
    void s.save({ paymentPolicy: { ...p, downPaymentPercent } });
  }

  const radio = (value: SettingsData["paymentPolicy"]["mode"], label: string, hint: string): ReactNode => (
    <label key={value} className={cn("cursor-pointer rounded-xl border px-3 py-2.5 text-sm", p.mode === value ? "border-gold bg-gold-pale/50 ring-1 ring-gold/40" : "border-stone/70 bg-white")}>
      <input type="radio" name="payment-mode" className="sr-only" checked={p.mode === value} onChange={() => setP({ ...p, mode: value })} />
      <span className="font-semibold">{label}</span>
      <span className="block text-xs text-muted">{hint}</span>
    </label>
  );

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          Zahlung {initial.isDemo && <DemoBadge />}
        </span>
      }
      description="Wann und wie viel bei einer Online-Buchung bezahlt wird."
    >
      <div className="grid gap-2 md:grid-cols-3">
        {radio("none", "Keine Online-Zahlung", "Nur unverbindliche Anfragen")}
        {radio("full", "Vollständig", "Mietsumme wird bei Buchung bezahlt")}
        {radio("down_payment", "Anzahlung", "Prozentsatz bei Buchung, Rest später")}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {p.mode === "down_payment" && (
          <div>
            <label htmlFor="pp-percent" className={labelClass}>
              Anzahlung (%)
            </label>
            <input id="pp-percent" inputMode="numeric" className={inputClass} value={percent} onChange={(e) => setPercent(e.target.value)} />
          </div>
        )}
        <div>
          <label htmlFor="pp-deposit" className={labelClass}>
            Kaution wird erhoben
          </label>
          <select id="pp-deposit" className={inputClass} value={p.depositCollection} onChange={(e) => setP({ ...p, depositCollection: e.target.value as typeof p.depositCollection })}>
            <option value="separately">separat (z. B. bei Übergabe)</option>
            <option value="with_payment">mit der Online-Zahlung</option>
          </select>
        </div>
        <div>
          <label htmlFor="pp-strategy" className={labelClass}>
            Kaution bei mehreren Bereichen
          </label>
          <select id="pp-strategy" className={inputClass} value={p.depositStrategy} onChange={(e) => setP({ ...p, depositStrategy: e.target.value as typeof p.depositStrategy })}>
            <option value="sum">Summe der Kautionen</option>
            <option value="max">höchste Einzelkaution</option>
          </select>
        </div>
      </div>
      <div className="mt-4 max-w-sm">
        <Check label="Demo-Werte" checked={p.isDemo} onChange={(v) => setP({ ...p, isDemo: v })} />
      </div>
      <SaveBar busy={s.busy} msg={s.msg} onSave={onSave} testId="save-payment" />
    </Card>
  );
}

function HoldsCard({ initial }: { initial: SettingsData["holds"] }) {
  const [checkout, setCheckout] = useState(String(initial.checkoutHoldMinutes));
  const [inquiryCreatesHold, setInquiryCreatesHold] = useState(initial.inquiryCreatesHold);
  const [inquiryHours, setInquiryHours] = useState(String(initial.inquiryHoldHours));
  const s = useSaver();

  function onSave() {
    const c = parseIntInput(checkout, { min: 5, max: 1440 });
    if (!c.ok || c.value === null) return s.setMsg({ tone: "danger", text: "Reservierung beim Bezahlen: 5 bis 1440 Minuten." });
    const h = parseIntInput(inquiryHours, { min: 1, max: 1440 });
    if (!h.ok || h.value === null) return s.setMsg({ tone: "danger", text: "Reservierung bei Anfragen: 1 bis 1440 Stunden." });
    void s.save({ holds: { checkoutHoldMinutes: c.value, inquiryCreatesHold, inquiryHoldHours: h.value } });
  }

  return (
    <Card title="Vorläufige Reservierungen" description="Wie lange Bereiche während des Bezahlens bzw. nach einer Anfrage vorgemerkt werden.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="h-checkout" className={labelClass}>
            Reservierung während der Zahlung (Minuten)
          </label>
          <input id="h-checkout" inputMode="numeric" className={inputClass} value={checkout} onChange={(e) => setCheckout(e.target.value)} />
          <p className={hintClass}>Danach wird eine unbezahlte Buchung automatisch freigegeben.</p>
        </div>
        <div>
          <label htmlFor="h-inquiry" className={labelClass}>
            Reservierung nach Anfrage (Stunden)
          </label>
          <input id="h-inquiry" inputMode="numeric" className={inputClass} value={inquiryHours} onChange={(e) => setInquiryHours(e.target.value)} disabled={!inquiryCreatesHold} />
        </div>
        <div className="sm:col-span-2">
          <Check label="Anfragen reservieren die Bereiche vorläufig" hint="Sonst blockieren Anfragen nichts, bis Sie sie bestätigen oder reservieren." checked={inquiryCreatesHold} onChange={setInquiryCreatesHold} />
        </div>
      </div>
      <SaveBar busy={s.busy} msg={s.msg} onSave={onSave} testId="save-holds" />
    </Card>
  );
}

export function SettingsForm({ settings, demoMode }: { settings: SettingsData; demoMode: boolean }) {
  return (
    <div className="space-y-6">
      {settings.bookableHours.needsVerification && (
        <Notice tone="warning">Die Buchungszeiten sind als „noch zu bestätigen“ markiert – bitte vor dem Live-Betrieb prüfen.</Notice>
      )}
      {demoMode && <Notice tone="info">DEMO-Modus: Zahlungen werden nur simuliert, unabhängig von diesen Einstellungen.</Notice>}
      <BookableHoursCard initial={settings.bookableHours} />
      <div className="grid items-start gap-6 2xl:grid-cols-2">
        <PaymentCard initial={settings.paymentPolicy} />
        <HoldsCard initial={settings.holds} />
      </div>
    </div>
  );
}
