"use client";

import { AlertTriangle, CheckCircle2, CircleAlert, Loader2, Plus, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { adminApi, describeApiError } from "../api-client";
import { BOOKING_MODE_LABEL, FIELD_LABEL, fieldLabel, PRICE_MODEL_LABEL } from "../labels";
import { ListEditor } from "../ListEditor";
import { centsToEuroInput, parseEuroInput, parseIntInput } from "../money";
import { Card, Notice, hintClass, inputClass, labelClass } from "../ui";

export interface SpaceEditorData {
  id: string;
  slug: string;
  code: string;
  name: string;
  color: string;
  shortDescription: string | null;
  longDescription: string | null;
  areaSqm: number | null;
  capacitySeated: number | null;
  capacityStanding: number | null;
  basePrice: number | null;
  priceModel: "hourly" | "daily" | "flat" | "on_request" | null;
  deposit: number | null;
  cleaningFee: number | null;
  minimumDurationMinutes: number | null;
  maximumDurationMinutes: number | null;
  setupBufferMinutes: number | null;
  cleanupBufferMinutes: number | null;
  advanceBookingMinHours: number | null;
  advanceBookingMaxDays: number | null;
  bookingMode: "inquiry" | "instant" | "both";
  availableForStandaloneRental: boolean;
  includedInFullVenue: boolean;
  bookable: boolean;
  active: boolean;
  usageOptions: string[];
  rules: string[];
  needsVerification: string[];
  features: string[];
}

const INT_FIELDS = {
  areaSqm: { label: "Fläche (m²)", max: 100000 },
  capacitySeated: { label: "Kapazität sitzend", max: 10000 },
  capacityStanding: { label: "Kapazität stehend", max: 10000 },
  minimumDurationMinutes: { label: "Mindestdauer (Minuten)", max: 10080 },
  maximumDurationMinutes: { label: "Höchstdauer (Minuten)", max: 20160 },
  setupBufferMinutes: { label: "Aufbaupuffer (Minuten)", max: 1440 },
  cleanupBufferMinutes: { label: "Abbaupuffer (Minuten)", max: 1440 },
  advanceBookingMinHours: { label: "Vorlauf mind. (Stunden)", max: 8760 },
  advanceBookingMaxDays: { label: "Buchbar bis max. (Tage im Voraus)", max: 1825 },
} as const;
type IntField = keyof typeof INT_FIELDS;

const MONEY_FIELDS = {
  basePrice: "Grundpreis (EUR)",
  deposit: "Kaution (EUR)",
  cleaningFee: "Endreinigung (EUR)",
} as const;
type MoneyField = keyof typeof MONEY_FIELDS;

type TextState = Record<IntField | MoneyField, string>;

function initialText(d: SpaceEditorData): TextState {
  const t = {} as TextState;
  for (const k of Object.keys(INT_FIELDS) as IntField[]) t[k] = d[k] === null ? "" : String(d[k]);
  for (const k of Object.keys(MONEY_FIELDS) as MoneyField[]) t[k] = centsToEuroInput(d[k]);
  return t;
}

const VERIFIABLE = Object.keys(FIELD_LABEL);

export function SpaceEditor({ initial }: { initial: SpaceEditorData }) {
  const router = useRouter();
  const [d, setD] = useState<SpaceEditorData>(initial);
  const [text, setText] = useState<TextState>(() => initialText(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [addVerify, setAddVerify] = useState("");

  const set = <K extends keyof SpaceEditorData>(key: K, value: SpaceEditorData[K]) => setD((cur) => ({ ...cur, [key]: value }));
  const setT = (key: keyof TextState, value: string) => setText((cur) => ({ ...cur, [key]: value }));

  const dirty = useMemo(() => JSON.stringify(d) !== JSON.stringify(initial) || JSON.stringify(text) !== JSON.stringify(initialText(initial)), [d, text, initial]);

  const pending = (key: string) =>
    d.needsVerification.includes(key) ? (
      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-warning-pale px-1.5 py-px text-[0.65rem] font-semibold uppercase tracking-wide text-warning" title="Noch zu bestätigen">
        <CircleAlert className="h-3 w-3" /> offen
      </span>
    ) : null;

  const field = (key: string, label: string, control: ReactNode, hint?: ReactNode, verifyKey = key) => (
    <div>
      <label htmlFor={`f-${key}`} className={cn(labelClass, "flex items-center")}>
        {label}
        {pending(verifyKey)}
      </label>
      {control}
      {errors[key] ? <p className="field-error">{errors[key]}</p> : hint ? <p className={hintClass}>{hint}</p> : null}
    </div>
  );

  const intInput = (key: IntField, hint?: ReactNode) =>
    field(
      key,
      INT_FIELDS[key].label,
      <input
        id={`f-${key}`}
        inputMode="numeric"
        className={inputClass}
        value={text[key]}
        aria-invalid={Boolean(errors[key])}
        onChange={(e) => setT(key, e.target.value)}
        placeholder="unbekannt"
      />,
      hint,
    );

  const moneyInput = (key: MoneyField, hint?: ReactNode) =>
    field(
      key,
      MONEY_FIELDS[key],
      <div className="relative">
        <input
          id={`f-${key}`}
          inputMode="decimal"
          className={cn(inputClass, "pr-8")}
          value={text[key]}
          aria-invalid={Boolean(errors[key])}
          onChange={(e) => setT(key, e.target.value)}
          placeholder="unbekannt"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">€</span>
      </div>,
      hint,
    );

  const minutesHint = (key: IntField) => {
    const v = Number(text[key]);
    return text[key].trim() && Number.isFinite(v) && v > 0 ? `= ${formatDuration(v)}` : "leer = keine Vorgabe";
  };

  async function save() {
    setMessage(null);
    const errs: Record<string, string> = {};
    const patch: Record<string, unknown> = {
      name: d.name.trim(),
      color: d.color,
      shortDescription: d.shortDescription?.trim() || null,
      longDescription: d.longDescription?.trim() || null,
      priceModel: d.priceModel,
      bookingMode: d.bookingMode,
      availableForStandaloneRental: d.availableForStandaloneRental,
      includedInFullVenue: d.includedInFullVenue,
      bookable: d.bookable,
      active: d.active,
      features: d.features.map((x) => x.trim()).filter(Boolean),
      usageOptions: d.usageOptions.map((x) => x.trim()).filter(Boolean),
      rules: d.rules.map((x) => x.trim()).filter(Boolean),
      needsVerification: d.needsVerification,
    };
    if (!patch.name) errs.name = "Bitte einen Namen angeben";
    if (!/^#[0-9a-fA-F]{6}$/.test(d.color)) errs.color = "Farbe im Format #RRGGBB";
    for (const k of Object.keys(INT_FIELDS) as IntField[]) {
      const r = parseIntInput(text[k], { min: 0, max: INT_FIELDS[k].max });
      if (r.ok) patch[k] = r.value;
      else errs[k] = r.error;
    }
    for (const k of Object.keys(MONEY_FIELDS) as MoneyField[]) {
      const r = parseEuroInput(text[k]);
      if (r.ok) patch[k] = r.cents;
      else errs[k] = r.error;
    }
    const min = patch.minimumDurationMinutes as number | null | undefined;
    const max = patch.maximumDurationMinutes as number | null | undefined;
    if (typeof min === "number" && typeof max === "number" && max < min) errs.maximumDurationMinutes = "Kleiner als die Mindestdauer";
    setErrors(errs);
    if (Object.keys(errs).length) {
      setMessage({ tone: "danger", text: "Bitte prüfen Sie die markierten Felder." });
      return;
    }
    setBusy(true);
    const res = await adminApi(`/api/admin/spaces/${d.id}`, { method: "PATCH", body: patch });
    setBusy(false);
    if (!res.ok) {
      if (res.details && typeof res.details === "object") setErrors(res.details as Record<string, string>);
      setMessage({ tone: "danger", text: describeApiError(res) });
      return;
    }
    setMessage({ tone: "success", text: "Gespeichert. Die Website verwendet ab sofort die neuen Angaben." });
    router.refresh();
  }

  const unverifiedOptions = VERIFIABLE.filter((k) => !d.needsVerification.includes(k));

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        <Card title="Grunddaten">
          <div className="grid gap-4 md:grid-cols-[1fr_200px]">
            {field("name", "Name", <input id="f-name" className={inputClass} value={d.name} maxLength={80} onChange={(e) => set("name", e.target.value)} aria-invalid={Boolean(errors.name)} />)}
            {field(
              "color",
              "Farbe (Karte & Kalender)",
              <div className="flex gap-2">
                <input type="color" aria-label="Farbe wählen" className="h-[2.6rem] w-12 shrink-0 cursor-pointer rounded-lg border border-stone bg-white p-1" value={/^#[0-9a-fA-F]{6}$/.test(d.color) ? d.color : "#000000"} onChange={(e) => set("color", e.target.value)} />
                <input id="f-color" className={cn(inputClass, "font-mono")} value={d.color} maxLength={7} onChange={(e) => set("color", e.target.value)} aria-invalid={Boolean(errors.color)} />
              </div>,
            )}
          </div>
          <div className="mt-4 space-y-4">
            {field(
              "shortDescription",
              "Kurzbeschreibung",
              <textarea id="f-shortDescription" rows={2} maxLength={400} className={cn(inputClass, "resize-y")} value={d.shortDescription ?? ""} onChange={(e) => set("shortDescription", e.target.value)} />,
              "Ein bis zwei Sätze für Karten und Übersichten.",
            )}
            {field(
              "longDescription",
              "Beschreibung",
              <textarea id="f-longDescription" rows={6} maxLength={6000} className={cn(inputClass, "resize-y")} value={d.longDescription ?? ""} onChange={(e) => set("longDescription", e.target.value)} />,
            )}
          </div>
        </Card>

        <Card title="Fläche & Kapazität" description="Leer lassen, solange die Angabe nicht bestätigt ist.">
          <div className="grid gap-4 sm:grid-cols-3">
            {intInput("areaSqm")}
            {intInput("capacitySeated")}
            {intInput("capacityStanding")}
          </div>
        </Card>

        <Card title="Preise" description="Beträge in Euro. Leer = unbekannt („Preis folgt“), niemals 0 für unbekannte Preise.">
          <div className="grid gap-4 sm:grid-cols-2">
            {field(
              "priceModel",
              "Preismodell",
              <select id="f-priceModel" className={inputClass} value={d.priceModel ?? ""} onChange={(e) => set("priceModel", (e.target.value || null) as SpaceEditorData["priceModel"])}>
                <option value="">– noch offen –</option>
                {Object.entries(PRICE_MODEL_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>,
            )}
            {moneyInput("basePrice", d.priceModel ? `Grundpreis ${PRICE_MODEL_LABEL[d.priceModel]}` : undefined)}
            {moneyInput("cleaningFee", "einmalig pro Buchung")}
            {moneyInput("deposit", "erstattungsfähig, kein Umsatz")}
          </div>
          <p className="mt-3 text-xs text-muted">Wochenend-, Saison- und Kombipreise pflegen Sie unter „Preise & Extras“.</p>
        </Card>

        <Card title="Buchungsregeln">
          <div className="grid gap-4 sm:grid-cols-2">
            {field(
              "bookingMode",
              "Buchungsart",
              <select id="f-bookingMode" className={inputClass} value={d.bookingMode} onChange={(e) => set("bookingMode", e.target.value as SpaceEditorData["bookingMode"])}>
                {Object.entries(BOOKING_MODE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>,
            )}
            <div className="hidden sm:block" />
            {intInput("minimumDurationMinutes", minutesHint("minimumDurationMinutes"))}
            {intInput("maximumDurationMinutes", minutesHint("maximumDurationMinutes"))}
            {intInput("setupBufferMinutes", "Zeit vor der Veranstaltung, die mit blockiert wird")}
            {intInput("cleanupBufferMinutes", "Zeit nach der Veranstaltung, die mit blockiert wird")}
            {intInput("advanceBookingMinHours", "z. B. 48 = frühestens in zwei Tagen buchbar")}
            {intInput("advanceBookingMaxDays", "z. B. 540 = bis ca. 18 Monate im Voraus")}
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {(
              [
                ["active", "Aktiv", "Auf der Website sichtbar"],
                ["bookable", "Buchbar", "Kann angefragt bzw. gebucht werden"],
                ["availableForStandaloneRental", "Einzeln mietbar", "Auch ohne weitere Bereiche buchbar"],
                ["includedInFullVenue", "Teil der Gesamtlocation", "Wird bei „Gesamte Location“ mitgebucht"],
              ] as const
            ).map(([key, label, hint]) => (
              <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-sand bg-paper px-3 py-2.5">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#b8904a]" checked={d[key]} onChange={(e) => set(key, e.target.checked)} />
                <span className="text-sm">
                  <span className="font-semibold">{label}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </Card>

        <Card title="Ausstattung, Nutzung & Regeln">
          <div className="space-y-5">
            {field("features", "Ausstattung", <ListEditor id="f-features" items={d.features} onChange={(v) => set("features", v)} placeholder="z. B. Tanzfläche, Beamer" />, "Nur tatsächlich vorhandene Ausstattung eintragen.")}
            {field("usageOptions", "Nutzungsmöglichkeiten", <ListEditor id="f-usageOptions" items={d.usageOptions} onChange={(v) => set("usageOptions", v)} placeholder="z. B. Hochzeit, Tagung" />)}
            {field("rules", "Regeln & Hinweise", <ListEditor id="f-rules" items={d.rules} maxLength={300} onChange={(v) => set("rules", v)} placeholder="z. B. Musik bis 24 Uhr" />)}
          </div>
        </Card>
      </div>

      <div className="space-y-6 xl:sticky xl:top-6">
        <Card title="Speichern">
          <div className="space-y-3">
            {message && (
              <Notice tone={message.tone} className="flex items-start gap-2">
                {message.tone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                <span data-testid="space-message">{message.text}</span>
              </Notice>
            )}
            <Button className="w-full" onClick={save} disabled={busy || !dirty} data-testid="save-space">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Änderungen speichern
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={busy || !dirty}
              onClick={() => {
                setD(initial);
                setText(initialText(initial));
                setErrors({});
                setMessage(null);
              }}
            >
              Verwerfen
            </Button>
            <p className="text-xs text-muted">{dirty ? "Es gibt ungespeicherte Änderungen." : "Keine ungespeicherten Änderungen."}</p>
          </div>
        </Card>

        <Card title="Noch zu bestätigen" description="Angaben, die vom Betreiber noch bestätigt werden müssen.">
          {d.needsVerification.length === 0 ? (
            <p className="text-sm text-success">Alle Angaben sind bestätigt.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5" data-testid="needs-verification">
              {d.needsVerification.map((k) => (
                <li key={k} className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-pale py-0.5 pl-2.5 pr-1 text-xs font-semibold text-warning">
                  {fieldLabel(k)}
                  <button
                    type="button"
                    onClick={() => set("needsVerification", d.needsVerification.filter((x) => x !== k))}
                    className="grid h-5 w-5 place-items-center rounded-full hover:bg-warning/15"
                    aria-label={`${fieldLabel(k)} als bestätigt markieren`}
                    title="Als bestätigt markieren"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {unverifiedOptions.length > 0 && (
            <div className="mt-4 flex gap-2">
              <select aria-label="Feld hinzufügen" className={inputClass} value={addVerify} onChange={(e) => setAddVerify(e.target.value)}>
                <option value="">Feld als „offen“ markieren …</option>
                {unverifiedOptions.map((k) => (
                  <option key={k} value={k}>
                    {fieldLabel(k)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!addVerify}
                className="grid w-11 shrink-0 place-items-center rounded-lg border border-stone bg-white text-ink-soft hover:border-ink/40 disabled:opacity-40"
                onClick={() => {
                  set("needsVerification", [...d.needsVerification, addVerify]);
                  setAddVerify("");
                }}
                aria-label="Hinzufügen"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
          <p className="mt-3 text-xs text-muted">Mit × als bestätigt markieren. Wirksam nach „Änderungen speichern“.</p>
        </Card>

        <Card title="Technische Angaben">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">ID</dt>
            <dd className="font-mono text-xs">{d.id}</dd>
            <dt className="text-muted">URL</dt>
            <dd className="font-mono text-xs">/bereiche/{d.slug}</dd>
            <dt className="text-muted">Kürzel</dt>
            <dd className="font-mono text-xs">{d.code}</dd>
          </dl>
        </Card>
      </div>
    </div>
  );
}
