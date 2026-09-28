"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, Check, CreditCard, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { TermDefinition } from "@/content/terms";
import { describeSelectionIssue, getFullVenueSpaceIds, isFullVenueSelection, sanitizeSpaceIds, validateSelection } from "@/domain/selection";
import { useAvailabilityCheck } from "@/features/availability/use-availability-check";
import { fetchJson, useAsyncResource } from "@/lib/use-async-resource";
import { AvailabilityResult } from "@/features/booking/AvailabilityResult";
import { scheduleHasRange, usePriceQuote } from "@/features/booking/hooks";
import { PriceBreakdown } from "@/features/booking/PriceBreakdown";
import { SchedulePicker } from "@/features/booking/SchedulePicker";
import { SiteMap } from "@/features/map/SiteMap";
import type { SpaceView } from "@/features/spaces/types";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { formatDateLong, formatDateTime, formatDuration, formatMoney, formatTime, pluralize } from "@/lib/format";
import { contactSchema, zodErrorMessages } from "@/server/validation";
import { useBookingStore } from "@/store/booking-store";

export interface WizardExtra {
  id: string;
  name: string;
  description: string | null;
  category: string;
  priceModel: string;
  unitPrice: number | null;
  maxQuantity: number;
  confirmed: boolean;
  isDemo: boolean;
}

export interface WizardProps {
  spaces: SpaceView[];
  extras: WizardExtra[];
  eventTypes: ReadonlyArray<{ id: string; label: string }>;
  terms: TermDefinition[];
  demo: boolean;
  paymentProvider: "demo" | "stripe" | "none";
}

const STEPS = ["Bereiche", "Datum & Zeit", "Zusatzoptionen", "Veranstaltung", "Kontaktdaten", "Übergabe", "Bedingungen", "Zahlung / Anfrage", "Bestätigung"];

interface HandoverOption {
  value: string;
  label: string;
}

export function BookingWizard({ spaces, extras, eventTypes, terms, demo, paymentProvider }: WizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const s = useBookingStore();
  const [hydrated, setHydrated] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<{ bookingNumber: string; token: string; amount: number } | null>(null);

  const honeypot = useRef<HTMLInputElement>(null);
  const navigatingRef = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  const bookable = useMemo(() => spaces.filter((x) => x.bookable), [spaces]);
  const selected = s.selectedSpaceIds.filter((id) => bookable.some((b) => b.id === id));
  const selectedSpaces = bookable.filter((b) => selected.includes(b.id));
  const nameOf = (id: string) => spaces.find((x) => x.id === id)?.name ?? id;

  // Wait for sessionStorage rehydration, then apply ?spaces= (validated) once.
  useEffect(() => {
    const done = () => {
      const fromUrl = sanitizeSpaceIds(searchParams.get("spaces"), spaces);
      if (fromUrl.length) useBookingStore.getState().setSelection(fromUrl);
      setHydrated(true);
    };
    if (useBookingStore.persist.hasHydrated()) done();
    else {
      const unsub = useBookingStore.persist.onFinishHydration(done);
      void useBookingStore.persist.rehydrate();
      return unsub;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availability = useAvailabilityCheck(selected, s.schedule, { alternatives: 3, enabled: hydrated });
  const guests = Number(s.event.guestCount) || null;
  const quote = usePriceQuote(selected, s.schedule, { extras: s.extras, guestCount: guests, enabled: hydrated });
  const q = quote.data;
  const inquiryOnly = !q || q.bookingMode === "inquiry" || !q.paymentEnabled;
  const mode: "booking" | "inquiry" = inquiryOnly ? "inquiry" : s.submissionMode;
  const hasRange = scheduleHasRange(s.schedule);
  const requestedStart = availability.data?.requested.start ?? null;
  const requestedEnd = availability.data?.requested.end ?? null;

  // Keep URL shareable (?spaces=…) without adding history entries.
  useEffect(() => {
    if (!hydrated || navigatingRef.current) return;
    const url = selected.length ? `/buchen?spaces=${selected.join(",")}` : "/buchen";
    window.history.replaceState(null, "", url);
  }, [hydrated, selected.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load handover options for step 6.
  const handoverRes = useAsyncResource<{ handover: HandoverOption[]; return: HandoverOption[]; individual: boolean }>(
    `${requestedStart}|${requestedEnd}`,
    s.step === 6 && Boolean(requestedStart && requestedEnd),
    (signal) => fetchJson(`/api/handover?start=${encodeURIComponent(requestedStart ?? "")}&end=${encodeURIComponent(requestedEnd ?? "")}`, { signal }),
    0,
  );
  const handover = {
    state: handoverRes.state,
    handover: handoverRes.data?.handover ?? [],
    ret: handoverRes.data?.return ?? [],
    individual: handoverRes.data?.individual ?? false,
  };
  useEffect(() => {
    const data = handoverRes.data;
    if (!data) return;
    const st = useBookingStore.getState();
    if (st.handover.handoverSlotId && !data.handover.some((o) => o.value === st.handover.handoverSlotId)) st.setHandover({ handoverSlotId: null });
    if (st.handover.returnSlotId && !data.return.some((o) => o.value === st.handover.returnSlotId)) st.setHandover({ returnSlotId: null });
  }, [handoverRes.data]);

  const selectionIssues = validateSelection(selected, spaces).filter((i) => i.type !== "empty");
  const requiredTerms = terms.filter((t) => t.requiredFor.includes(mode));

  function validateStep(step: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (selected.length === 0) e.spaces = "Bitte wählen Sie mindestens einen Bereich.";
      if (selectionIssues.length) e.spaces = selectionIssues.map((i) => describeSelectionIssue(i, nameOf)).join(" ");
    }
    if (step === 2) {
      if (!hasRange) e.schedule = s.schedule.rentalMode === "hourly" ? "Bitte wählen Sie Datum, Beginn und Ende." : "Bitte wählen Sie ein Datum.";
      else if (availability.state === "loading") e.schedule = "Die Verfügbarkeit wird noch geprüft …";
      else if (!availability.data?.bookingAllowed) e.schedule = "Der gewählte Zeitraum ist nicht für alle Bereiche verfügbar.";
    }
    if (step === 4) {
      if (!s.event.eventType) e.eventType = "Bitte wählen Sie die Art der Veranstaltung.";
      const g = Number(s.event.guestCount);
      if (!Number.isInteger(g) || g < 1 || g > 5000) e.guestCount = "Bitte geben Sie die voraussichtliche Personenzahl an.";
    }
    if (step === 5) {
      const c = s.contact;
      const parsed = contactSchema.safeParse({
        ...c,
        billing: c.billingDifferent
          ? { name: c.billingName, street: c.billingStreet, houseNumber: c.billingHouseNumber, postalCode: c.billingPostalCode, city: c.billingCity, country: c.billingCountry }
          : null,
      });
      if (!parsed.success) Object.assign(e, zodErrorMessages(parsed.error));
    }
    if (step === 6 && !handover.individual && mode === "booking") {
      if (!s.handover.handoverSlotId) e.handover = "Bitte wählen Sie eine Übergabezeit.";
      if (!s.handover.returnSlotId) e.return = "Bitte wählen Sie eine Rückgabezeit.";
    }
    if (step === 7) {
      const missing = requiredTerms.filter((t) => !s.acceptedTerms[t.id]);
      if (missing.length) e.terms = "Bitte bestätigen Sie alle mit * markierten Punkte.";
    }
    return e;
  }

  function goTo(step: number) {
    s.setStep(step);
    setErrors({});
    setSubmitError(null);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function next() {
    const e = validateStep(s.step);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (s.step === 1) track("booking_started", { spaces: selected.length });
    goTo(Math.min(8, s.step + 1));
  }

  async function submit() {
    for (const step of [1, 2, 4, 5, 6, 7]) {
      const e = validateStep(step);
      if (Object.keys(e).length) {
        setErrors(e);
        goTo(step);
        setErrors(e);
        return;
      }
    }
    setSubmitting(true);
    setSubmitError(null);
    const c = s.contact;
    const body = {
      kind: mode,
      spaceIds: selected,
      schedule: {
        rentalMode: s.schedule.rentalMode,
        date: s.schedule.date,
        endDate: s.schedule.rentalMode === "daily" ? (s.schedule.endDate ?? s.schedule.date) : null,
        startTime: s.schedule.rentalMode === "hourly" ? s.schedule.startTime : null,
        endTime: s.schedule.rentalMode === "hourly" ? s.schedule.endTime : null,
      },
      extras: Object.entries(s.extras).map(([extraId, quantity]) => ({ extraId, quantity })),
      event: { eventType: s.event.eventType || null, guestCount: Number(s.event.guestCount) || null, notes: s.event.notes || null },
      contact: {
        firstName: c.firstName,
        lastName: c.lastName,
        company: c.company || null,
        email: c.email,
        phone: c.phone,
        street: c.street,
        houseNumber: c.houseNumber,
        postalCode: c.postalCode,
        city: c.city,
        country: c.country,
        billing: c.billingDifferent
          ? { name: c.billingName, street: c.billingStreet, houseNumber: c.billingHouseNumber, postalCode: c.billingPostalCode, city: c.billingCity, country: c.billingCountry }
          : null,
      },
      handoverAt: s.handover.handoverSlotId,
      returnAt: s.handover.returnSlotId,
      acceptedTerms: Object.entries(s.acceptedTerms)
        .filter(([, v]) => v)
        .map(([k]) => k),
      website: honeypot.current?.value ?? "",
    };
    try {
      const res = await fetch(mode === "inquiry" ? "/api/inquiries" : "/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        bookingNumber?: string;
        accessToken?: string;
        paymentRequired?: boolean;
        dueNow?: number | null;
        error?: { code: string; message: string; details?: unknown };
      };
      if (!res.ok || !data.bookingNumber || !data.accessToken) {
        const err = data.error;
        setSubmitError(err?.message ?? "Die Anfrage konnte nicht gesendet werden.");
        if (err?.code === "NOT_AVAILABLE") availability.retry();
        if (err?.code === "VALIDATION_ERROR" && err.details && typeof err.details === "object") setErrors(err.details as Record<string, string>);
        return;
      }
      track(mode === "inquiry" ? "inquiry_submitted" : "booking_submitted", { spaces: selected.length });
      if (mode === "booking" && data.paymentRequired) {
        const pay = await fetch("/api/payments/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingNumber: data.bookingNumber, token: data.accessToken }),
        });
        const session = (await pay.json()) as { provider: string; checkoutUrl?: string; amount?: number; error?: { message: string } };
        if (!pay.ok) {
          setSubmitError(session.error?.message ?? "Die Zahlung konnte nicht gestartet werden.");
          return;
        }
        if (session.provider === "stripe" && session.checkoutUrl) {
          window.location.assign(session.checkoutUrl);
          return;
        }
        if (session.provider === "demo") {
          setPendingPayment({ bookingNumber: data.bookingNumber, token: data.accessToken, amount: session.amount ?? data.dueNow ?? 0 });
          return;
        }
      }
      finish(data.bookingNumber, data.accessToken);
    } catch {
      setSubmitError("Verbindungsfehler – bitte versuchen Sie es erneut.");
    } finally {
      setSubmitting(false);
    }
  }

  async function completeDemoPayment(outcome: "succeeded" | "failed") {
    if (!pendingPayment) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/payments/demo/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingNumber: pendingPayment.bookingNumber, token: pendingPayment.token, outcome }),
      });
      if (!res.ok) throw new Error();
      if (outcome === "failed") {
        setSubmitError("Die (Demo-)Zahlung ist fehlgeschlagen. Ihre Buchung ist NICHT bestätigt – die Bereiche bleiben kurz reserviert. Sie können es erneut versuchen.");
        const retry = await fetch("/api/payments/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingNumber: pendingPayment.bookingNumber, token: pendingPayment.token }),
        });
        if (!retry.ok || (await retry.json()).provider !== "demo") setPendingPayment(null);
        return;
      }
      finish(pendingPayment.bookingNumber, pendingPayment.token);
    } catch {
      setSubmitError("Zahlung konnte nicht verarbeitet werden.");
    } finally {
      setSubmitting(false);
    }
  }

  function finish(bookingNumber: string, token: string) {
    navigatingRef.current = true;
    router.push(`/buchung/${bookingNumber}?token=${encodeURIComponent(token)}&neu=1`);
    // Clear the draft once the confirmation page is on its way (keeps contact data for this session only).
    setTimeout(() => useBookingStore.getState().resetCheckout(), 1500);
  }

  if (!hydrated) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const step = s.step;
  return (
    <div ref={topRef} className="scroll-mt-28" data-testid="booking-wizard" data-step={step}>
      <Progress step={step} onGoTo={(n) => n < step && goTo(n)} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] xl:gap-12">
        <div className="min-w-0">
          <div className="card-surface p-5 sm:p-8">
            <h2 className="font-serif text-3xl" data-testid="step-title">
              <span className="mr-2 text-gold-dark">{step}.</span>
              {STEPS[step - 1]}
            </h2>

            {step === 1 && (
              <div className="mt-6 space-y-5">
                <p className="text-ink-soft">Wählen Sie einen oder mehrere Bereiche – direkt auf der Karte oder in der Liste.</p>
                <SiteMap
                  spaces={bookable}
                  selectedIds={selected}
                  onToggle={s.toggleSpace}
                  labels="code"
                  className="overflow-hidden rounded-2xl ring-1 ring-black/5"
                  showCompass={false}
                />
                <div className="flex flex-wrap gap-2">
                  {bookable.map((sp) => {
                    const on = selected.includes(sp.id);
                    return (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => s.toggleSpace(sp.id)}
                        aria-pressed={on}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors",
                          on ? "border-ink bg-ink text-paper" : "border-sand bg-white hover:border-ink/40",
                        )}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: sp.color }} />
                        {sp.name}
                        {on && <Check className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => (isFullVenueSelection(selected, spaces) ? s.clearSelection() : s.setSelection(getFullVenueSpaceIds(spaces)))}
                    className="inline-flex items-center gap-2 rounded-full border border-gold bg-gold-pale/50 px-3.5 py-2 text-sm font-semibold hover:bg-gold-pale"
                  >
                    {isFullVenueSelection(selected, spaces) ? "Auswahl leeren" : "Gesamte Location"}
                  </button>
                </div>
                <FieldError message={errors.spaces} />
              </div>
            )}

            {step === 2 && (
              <div className="mt-6 space-y-5">
                <SchedulePicker spaces={spaces} selectedIds={selected} schedule={s.schedule} onChange={s.setSchedule} />
                {hasRange && (
                  <div className="rounded-2xl border border-sand bg-cream/50 p-4">
                    <AvailabilityResult
                      result={availability}
                      onRemoveSpace={s.removeSpace}
                      onPickAlternative={(alt) => s.setSchedule({ rentalMode: "hourly", ...alt })}
                    />
                  </div>
                )}
                <FieldError message={errors.schedule} />
              </div>
            )}

            {step === 3 && (
              <div className="mt-6 space-y-4">
                <p className="text-ink-soft">Optionale Zusatzleistungen. Alles Weitere stimmen wir gern persönlich mit Ihnen ab.</p>
                {demo && (
                  <p className="rounded-xl bg-warning-pale px-4 py-3 text-sm text-[#5d4413]">
                    Demo: Die folgenden Leistungen sind vorbereitete Beispiele. Ob und zu welchen Konditionen sie angeboten werden, ist noch nicht bestätigt.
                  </p>
                )}
                {extras.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-stone p-6 text-center text-muted">Zusatzleistungen werden in Kürze ergänzt.</p>
                ) : (
                  <ul className="divide-y divide-sand rounded-2xl border border-sand">
                    {extras.map((ex) => {
                      const qty = s.extras[ex.id] ?? 0;
                      return (
                        <li key={ex.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-semibold">
                              {ex.name}
                              {!ex.confirmed && <span className="ml-2 rounded-full bg-cream px-2 py-0.5 text-[0.65rem] uppercase tracking-wider text-muted">Beispiel</span>}
                            </p>
                            {ex.description && <p className="text-sm text-muted">{ex.description}</p>}
                            <p className="mt-0.5 text-sm text-ink-soft">{extraPriceLabel(ex)}</p>
                          </div>
                          {ex.maxQuantity > 1 ? (
                            <div className="flex items-center gap-2">
                              <button type="button" className="grid h-9 w-9 place-items-center rounded-full border border-sand text-lg hover:border-ink/40" onClick={() => s.setExtra(ex.id, qty - 1)} aria-label={`${ex.name} verringern`} disabled={qty === 0}>
                                −
                              </button>
                              <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">
                                {qty}
                              </span>
                              <button type="button" className="grid h-9 w-9 place-items-center rounded-full border border-sand text-lg hover:border-ink/40" onClick={() => s.setExtra(ex.id, Math.min(ex.maxQuantity, qty + 1))} aria-label={`${ex.name} erhöhen`}>
                                +
                              </button>
                            </div>
                          ) : (
                            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold">
                              <input type="checkbox" className="h-5 w-5 accent-[#b8904a]" checked={qty > 0} onChange={(e) => s.setExtra(ex.id, e.target.checked ? 1 : 0)} />
                              Hinzufügen
                            </label>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="field-label">Art der Veranstaltung *</span>
                  <select className="field-input" value={s.event.eventType} onChange={(e) => s.setEvent({ eventType: e.target.value })} aria-invalid={Boolean(errors.eventType)}>
                    <option value="">– bitte wählen –</option>
                    {eventTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.eventType} />
                </label>
                <label className="block">
                  <span className="field-label">Voraussichtliche Personenzahl *</span>
                  <input type="number" inputMode="numeric" min={1} max={5000} className="field-input" value={s.event.guestCount} onChange={(e) => s.setEvent({ guestCount: e.target.value })} aria-invalid={Boolean(errors.guestCount)} />
                  <FieldError message={errors.guestCount} />
                </label>
                <label className="block sm:col-span-2">
                  <span className="field-label">Bemerkungen</span>
                  <textarea rows={4} maxLength={2000} className="field-input" value={s.event.notes} onChange={(e) => s.setEvent({ notes: e.target.value })} placeholder="Ablauf, besondere Wünsche, Fragen …" />
                </label>
                <p className="text-xs text-muted sm:col-span-2">Die zulässige Personenzahl je Bereich wird noch festgelegt – wir prüfen Ihre Angaben persönlich.</p>
              </div>
            )}

            {step === 5 && <ContactStep errors={errors} />}

            {step === 6 && (
              <div className="mt-6 space-y-6">
                <p className="text-ink-soft">
                  Wann möchten Sie die Location übernehmen – und wann geben Sie sie zurück?
                  {requestedStart && requestedEnd && (
                    <span className="block text-sm text-muted">
                      Ihre Veranstaltung: {formatDateTime(Date.parse(requestedStart))} – {formatDateTime(Date.parse(requestedEnd))} Uhr
                    </span>
                  )}
                </p>
                {handover.state === "loading" && (
                  <p className="flex items-center gap-2 text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" /> Zeitfenster werden geladen …
                  </p>
                )}
                {handover.state === "error" && <p className="text-danger">Die Übergabezeiten konnten nicht geladen werden.</p>}
                {handover.state === "ready" && handover.individual && (
                  <p className="rounded-xl bg-cream p-4">Übergabe und Rückgabe werden individuell mit Ihnen abgestimmt.</p>
                )}
                {handover.state === "ready" && !handover.individual && (
                  <div className="grid gap-6 md:grid-cols-2">
                    <SlotGroup
                      title={`Übergabe${mode === "booking" ? " *" : ""}`}
                      name="handover"
                      options={handover.handover}
                      value={s.handover.handoverSlotId}
                      onChange={(v) => s.setHandover({ handoverSlotId: v })}
                      error={errors.handover}
                      empty="Keine Übergabezeit vor Veranstaltungsbeginn verfügbar – wir stimmen sie individuell ab."
                    />
                    <SlotGroup
                      title={`Rückgabe${mode === "booking" ? " *" : ""}`}
                      name="return"
                      options={handover.ret}
                      value={s.handover.returnSlotId}
                      onChange={(v) => s.setHandover({ returnSlotId: v })}
                      error={errors.return}
                      empty="Keine Rückgabezeit verfügbar – wir stimmen sie individuell ab."
                    />
                  </div>
                )}
                {demo && <p className="text-xs text-muted">Demo: Die angebotenen Zeitfenster sind Beispielwerte. Betreiber legen sie im Admin fest.</p>}
              </div>
            )}

            {step === 7 && (
              <div className="mt-6 space-y-4">
                <p className="rounded-xl border border-warning/30 bg-warning-pale px-4 py-3 text-sm text-[#5d4413]">
                  Hinweis: Die verlinkten Dokumente sind Platzhalter und werden vor dem Livegang rechtlich geprüft (LEGAL REVIEW REQUIRED).
                </p>
                <ul className="space-y-3">
                  {terms.map((t) => {
                    const required = t.requiredFor.includes(mode);
                    const [before, after] = t.label.split("{link}");
                    return (
                      <li key={t.id}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-sand p-4 hover:border-ink/30">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-5 w-5 shrink-0 accent-[#b8904a]"
                            checked={Boolean(s.acceptedTerms[t.id])}
                            onChange={(e) => s.setTermAccepted(t.id, e.target.checked)}
                            data-testid={`term-${t.id}`}
                          />
                          <span className="text-[0.95rem]">
                            {before}
                            <Link href={t.href} target="_blank" className="font-semibold text-gold-dark underline underline-offset-4">
                              {t.linkLabel}
                            </Link>
                            {after}
                            {required ? " *" : <span className="text-muted"> (optional bei Anfragen)</span>}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <FieldError message={errors.terms} />
              </div>
            )}

            {step === 8 && (
              <div className="mt-6 space-y-6">
                <div role="radiogroup" aria-label="Art der Übermittlung" className="grid gap-3 sm:grid-cols-2">
                  <ModeOption
                    checked={mode === "booking"}
                    disabled={inquiryOnly}
                    onSelect={() => s.setSubmissionMode("booking")}
                    title="Verbindlich buchen"
                    text={
                      inquiryOnly
                        ? q && !q.paymentEnabled
                          ? "Online-Zahlung ist noch nicht freigeschaltet."
                          : "Für diese Kombination nur als Anfrage möglich."
                        : `Heute fällig: ${formatMoney(q?.dueNow ?? null)}`
                    }
                  />
                  <ModeOption checked={mode === "inquiry"} onSelect={() => s.setSubmissionMode("inquiry")} title="Unverbindlich anfragen" text="Ohne Zahlung – wir melden uns mit einem Angebot." />
                </div>

                {mode === "booking" && terms.some((t) => t.requiredFor.includes("booking") && !s.acceptedTerms[t.id]) && (
                  <p className="rounded-xl bg-warning-pale p-4 text-sm">
                    Für eine verbindliche Buchung bestätigen Sie bitte alle Bedingungen.{" "}
                    <button type="button" className="font-semibold underline" onClick={() => goTo(7)}>
                      Zu den Bedingungen
                    </button>
                  </p>
                )}

                {mode === "booking" && !pendingPayment && (
                  <div className="rounded-2xl border border-sand p-5">
                    <p className="flex items-center gap-2 font-semibold">
                      <CreditCard className="h-4 w-4 text-gold-dark" /> Zahlung {paymentProvider === "demo" ? "(Demo – es wird kein Geld bewegt)" : "über Stripe"}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {paymentProvider === "stripe"
                        ? "Sie werden zur sicheren Zahlungsseite weitergeleitet."
                        : "Im Demo-Modus wird die Zahlung im nächsten Schritt simuliert."}{" "}
                      Die Kaution wird separat behandelt und ist nicht Teil der heutigen Zahlung.
                    </p>
                  </div>
                )}

                {pendingPayment && (
                  <div className="rounded-2xl border-2 border-gold bg-gold-pale/30 p-5" data-testid="demo-payment">
                    <p className="flex items-center gap-2 font-semibold">
                      <Lock className="h-4 w-4" /> Demo-Zahlung · {formatMoney(pendingPayment.amount)}
                    </p>
                    <p className="mt-1 text-sm text-ink-soft">
                      Buchung <strong>{pendingPayment.bookingNumber}</strong> ist angelegt und die Bereiche sind vorübergehend reserviert. Bestätigt wird sie erst nach erfolgreicher Zahlung.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                      <input className="field-input" value="4242 4242 4242 4242 · 12/30 · 123" readOnly aria-label="Demo-Kartendaten" />
                      <Button variant="gold" onClick={() => completeDemoPayment("succeeded")} disabled={submitting} data-testid="demo-pay-success">
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Zahlung abschließen
                      </Button>
                      <Button variant="secondary" onClick={() => completeDemoPayment("failed")} disabled={submitting}>
                        Fehlschlag simulieren
                      </Button>
                    </div>
                  </div>
                )}

                {submitError && (
                  <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger-pale p-4 text-sm text-danger">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p>{submitError}</p>
                      <button type="button" className="mt-1 font-semibold underline" onClick={() => goTo(2)}>
                        Termin anpassen
                      </button>
                    </div>
                  </div>
                )}
                <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-sand pt-6 sm:flex-row sm:items-center sm:justify-between">
              {step > 1 ? (
                <Button variant="ghost" onClick={() => goTo(step - 1)} disabled={submitting || Boolean(pendingPayment)}>
                  <ArrowLeft className="h-4 w-4" /> Zurück
                </Button>
              ) : (
                <Link href="/#karte" className="text-sm font-semibold text-muted hover:text-ink">
                  Zur Karte
                </Link>
              )}
              {step < 8 ? (
                <Button variant="primary" size="lg" onClick={next} data-testid="wizard-next">
                  Weiter <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                !pendingPayment && (
                  <Button variant="gold" size="lg" onClick={submit} disabled={submitting} data-testid="wizard-submit">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "inquiry" ? <Mail className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    {mode === "inquiry" ? "Anfrage absenden" : paymentProvider === "demo" ? "Zahlungspflichtig buchen (Demo)" : "Zahlungspflichtig buchen"}
                  </Button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Sticky summary */}
        <aside aria-label="Zusammenfassung" className="lg:block">
          <div className="panel-dark sticky top-24 rounded-[1.5rem] p-6 shadow-lift" data-testid="booking-summary">
            <p className="eyebrow !text-gold-light">{mode === "inquiry" ? "Ihre Anfrage" : "Ihre Buchung"}</p>
            <ul className="mt-3 space-y-1.5">
              {selectedSpaces.length === 0 && <li className="text-paper/60">Noch keine Bereiche gewählt</li>}
              {selectedSpaces.map((sp) => (
                <li key={sp.id} className="flex items-center gap-2 font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: sp.color }} /> {sp.name}
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-0.5 border-t border-white/10 pt-4 text-sm">
              {s.schedule.date ? (
                <>
                  <p className="font-semibold">
                    {formatDateLong(s.schedule.date)}
                    {s.schedule.rentalMode === "daily" && s.schedule.endDate && s.schedule.endDate !== s.schedule.date && ` – ${formatDateLong(s.schedule.endDate)}`}
                  </p>
                  {requestedStart && requestedEnd && (
                    <p className="text-paper/70">
                      {formatTime(Date.parse(requestedStart))}–{formatTime(Date.parse(requestedEnd))} Uhr · {formatDuration(Math.round((Date.parse(requestedEnd) - Date.parse(requestedStart)) / 60000))}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-paper/60">Termin noch offen</p>
              )}
              {s.event.guestCount && <p className="text-paper/70">{pluralize(Number(s.event.guestCount) || 0, "Person", "Personen")}</p>}
              {s.handover.handoverSlotId && <p className="text-paper/70">Übergabe: {formatDateTime(Date.parse(s.handover.handoverSlotId))} Uhr</p>}
              {s.handover.returnSlotId && <p className="text-paper/70">Rückgabe: {formatDateTime(Date.parse(s.handover.returnSlotId))} Uhr</p>}
            </div>
            <div className="mt-4 border-t border-white/10 pt-4">
              {hasRange ? (
                quote.state === "error" && !q ? (
                  <p className="text-sm text-paper/70">
                    Preis konnte nicht berechnet werden.{" "}
                    <button type="button" className="underline" onClick={quote.retry}>
                      Erneut
                    </button>
                  </p>
                ) : (
                  <PriceBreakdown quote={q} tone="dark" demo={demo} showDueNow={mode === "booking"} />
                )
              ) : (
                <PriceBreakdown quote={null} tone="dark" />
              )}
              {quote.state === "loading" && <p className="mt-2 text-xs text-paper/50">wird aktualisiert …</p>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function extraPriceLabel(ex: WizardExtra): string {
  if (ex.unitPrice === null || ex.priceModel === "on_request") return "Preis auf Anfrage";
  const unit: Record<string, string> = {
    flat: "pauschal",
    per_hour: "pro Stunde",
    per_day: "pro Tag",
    per_person: "pro Person",
    per_unit: "pro Stunde/Einheit",
  };
  return `${formatMoney(ex.unitPrice)} ${unit[ex.priceModel] ?? ""}${ex.isDemo ? " · Demo-Preis" : ""}`;
}

function Progress({ step, onGoTo }: { step: number; onGoTo: (n: number) => void }) {
  return (
    <nav aria-label="Buchungsschritte">
      <p className="mb-3 text-sm font-semibold text-muted md:hidden">
        Schritt {step} von {STEPS.length}: {STEPS[step - 1]}
      </p>
      <div className="h-1 overflow-hidden rounded-full bg-sand md:hidden">
        <div className="h-full bg-gold transition-[width] duration-500" style={{ width: `${(step / STEPS.length) * 100}%` }} />
      </div>
      <ol className="hidden items-center gap-1 md:flex">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const current = n === step;
          return (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-1">
              <button
                type="button"
                onClick={() => onGoTo(n)}
                disabled={!done}
                aria-current={current ? "step" : undefined}
                className={cn("flex min-w-0 items-center gap-2 rounded-full py-1 pr-2 text-left text-xs font-semibold", done ? "cursor-pointer text-ink hover:text-gold-dark" : current ? "text-ink" : "text-muted")}
              >
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[0.75rem] transition-colors",
                    done && "border-gold bg-gold text-anthracite",
                    current && "border-ink bg-ink text-paper",
                    !done && !current && "border-stone bg-white",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : n}
                </span>
                <span className="hidden truncate xl:inline">{label}</span>
              </button>
              {n < STEPS.length && <span className={cn("h-px flex-1", done ? "bg-gold" : "bg-sand")} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ContactStep({ errors }: { errors: Record<string, string> }) {
  const c = useBookingStore((st) => st.contact);
  const set = useBookingStore((st) => st.setContact);
  const field = (key: keyof typeof c, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, span = 1) => (
    <label className={cn("block", span === 2 && "sm:col-span-2")}>
      <span className="field-label">{label}</span>
      <input
        className="field-input"
        value={String(c[key] ?? "")}
        onChange={(e) => set({ [key]: e.target.value } as Partial<typeof c>)}
        aria-invalid={Boolean(errors[key])}
        {...props}
      />
      <FieldError message={errors[key]} />
    </label>
  );
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("firstName", "Vorname *", { autoComplete: "given-name" })}
        {field("lastName", "Nachname *", { autoComplete: "family-name" })}
        {field("company", "Firma (optional)", { autoComplete: "organization" }, 2)}
        {field("email", "E-Mail *", { type: "email", autoComplete: "email", inputMode: "email" })}
        {field("phone", "Telefon *", { type: "tel", autoComplete: "tel", inputMode: "tel" })}
      </div>
      <fieldset className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <legend className="mb-2 font-serif text-xl">Adresse</legend>
        {field("street", "Straße *", { autoComplete: "address-line1" })}
        {field("houseNumber", "Hausnummer *")}
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-[8rem_1fr_1fr]">
          {field("postalCode", "PLZ *", { autoComplete: "postal-code", inputMode: "numeric" })}
          {field("city", "Ort *", { autoComplete: "address-level2" })}
          {field("country", "Land *", { autoComplete: "country-name" })}
        </div>
      </fieldset>
      <label className="flex items-center gap-3">
        <input type="checkbox" className="h-5 w-5 accent-[#b8904a]" checked={c.billingDifferent} onChange={(e) => set({ billingDifferent: e.target.checked })} />
        <span className="font-semibold">Abweichende Rechnungsadresse</span>
      </label>
      {c.billingDifferent && (
        <fieldset className="grid gap-4 rounded-2xl border border-sand p-4 sm:grid-cols-[1fr_8rem]">
          <legend className="px-1 font-semibold">Rechnungsadresse</legend>
          {field("billingName", "Name / Firma *", {}, 2)}
          {field("billingStreet", "Straße *")}
          {field("billingHouseNumber", "Hausnummer *")}
          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-[8rem_1fr_1fr]">
            {field("billingPostalCode", "PLZ *")}
            {field("billingCity", "Ort *")}
            {field("billingCountry", "Land *")}
          </div>
          <FieldError message={errors["billing.name"] ?? errors["billing.street"] ?? errors["billing.postalCode"] ?? errors["billing.city"]} />
        </fieldset>
      )}
      <p className="text-xs text-muted">Wir erheben nur die für die Bearbeitung notwendigen Daten. Details in den Datenschutzhinweisen.</p>
    </div>
  );
}

function SlotGroup({
  title,
  name,
  options,
  value,
  onChange,
  error,
  empty,
}: {
  title: string;
  name: string;
  options: HandoverOption[];
  value: string | null;
  onChange: (v: string) => void;
  error?: string;
  empty: string;
}) {
  return (
    <fieldset>
      <legend className="mb-3 font-serif text-xl">{title}</legend>
      {options.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <div className="grid gap-2">
          {options.map((o) => (
            <label key={o.value} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors", value === o.value ? "border-gold bg-gold-pale/50" : "border-sand hover:border-ink/30")}>
              <input type="radio" name={name} className="h-4 w-4 accent-[#b8904a]" checked={value === o.value} onChange={() => onChange(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
      )}
      <FieldError message={error} />
    </fieldset>
  );
}

function ModeOption({ checked, disabled, onSelect, title, text }: { checked: boolean; disabled?: boolean; onSelect: () => void; title: string; text: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "rounded-2xl border-2 p-5 text-left transition-colors",
        checked ? "border-gold bg-gold-pale/40" : "border-sand hover:border-ink/30",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span className="flex items-center gap-2 font-serif text-xl">
        <span className={cn("grid h-5 w-5 place-items-center rounded-full border-2", checked ? "border-gold" : "border-stone")}>{checked && <span className="h-2.5 w-2.5 rounded-full bg-gold" />}</span>
        {title}
      </span>
      <span className="mt-1 block text-sm text-ink-soft">{text}</span>
    </button>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="field-error" role="alert">
      {message}
    </p>
  );
}
