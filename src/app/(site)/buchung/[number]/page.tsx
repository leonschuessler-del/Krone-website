import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, CheckCircle2, Clock, Home, Mail } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { siteConfig } from "@/config/site";
import { BOOKING_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/domain/booking";
import type { BookingStatus, PaymentStatus } from "@/domain/types";
import { PriceBreakdown } from "@/features/booking/PriceBreakdown";
import { PrintButton } from "@/features/booking/PrintButton";
import { formatDateTime, formatDuration, formatInstantDateLong, formatTime } from "@/lib/format";
import { getDb } from "@/server/db/client";
import { getPublicBooking } from "@/server/services/booking-service";
import { toPublicBooking } from "@/server/services/booking-view";
import { bookingAccessSchema } from "@/server/validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ihre Buchung", robots: { index: false, follow: false } };

export default async function BookingConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ token?: string; neu?: string; zahlung?: string }>;
}) {
  const { number } = await params;
  const sp = await searchParams;
  const parsed = bookingAccessSchema.safeParse({ bookingNumber: number, token: sp.token ?? "" });
  const details = parsed.success ? await getPublicBooking(await getDb(), parsed.data.bookingNumber, parsed.data.token) : null;

  if (!details) {
    return (
      <div className="container-page grid min-h-[60vh] place-items-center pb-20 pt-36 text-center">
        <div>
          <h1 className="text-4xl">Buchung nicht gefunden</h1>
          <p className="mt-3 text-ink-soft">Bitte verwenden Sie den vollständigen Link aus Ihrer Bestätigungs-E-Mail.</p>
          <ButtonLink href="/" className="mt-6">
            Zur Startseite
          </ButtonLink>
        </div>
      </div>
    );
  }

  const b = toPublicBooking(details);
  const isInquiry = b.kind === "inquiry";
  const confirmed = b.status === "confirmed";
  const start = Date.parse(b.start);
  const end = Date.parse(b.end);
  const icsHref = `/api/bookings/${b.bookingNumber}/ics?token=${encodeURIComponent(sp.token ?? "")}`;

  return (
    <div className="bg-cream pb-24 pt-28 md:pt-32 print:bg-white print:pt-0">
      <div className="container-page max-w-5xl">
        <div className="panel-dark overflow-hidden rounded-[2rem] p-8 md:p-12 print:bg-none print:text-ink">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="eyebrow !text-gold-light">{isInquiry ? "Anfrage eingegangen" : confirmed ? "Buchung bestätigt" : "Buchung eingegangen"}</p>
              <h1 className="mt-3 flex items-center gap-3 text-4xl text-paper md:text-5xl print:text-ink">
                {confirmed || isInquiry ? <CheckCircle2 className="h-10 w-10 text-gold-light" /> : <Clock className="h-10 w-10 text-gold-light" />}
                {isInquiry ? "Vielen Dank für Ihre Anfrage!" : confirmed ? "Vielen Dank – Ihre Buchung ist bestätigt!" : "Vielen Dank für Ihre Buchung!"}
              </h1>
              <p className="mt-4 max-w-2xl text-paper/75 print:text-ink-soft">
                {isInquiry
                  ? "Wir prüfen Ihre Anfrage und melden uns persönlich mit einem Angebot. Die Bereiche sind durch eine Anfrage noch nicht reserviert."
                  : confirmed
                    ? "Ihre Zahlung ist eingegangen. Eine Bestätigung haben wir an Ihre E-Mail-Adresse gesendet."
                    : "Ihre Buchung ist angelegt. Sie wird bestätigt, sobald die Zahlung eingegangen ist."}
                {b.isDemo && " (Demo-Modus: keine echte Zahlung, keine echte E-Mail.)"}
              </p>
            </div>
            <div className="shrink-0 rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-right print:border-sand">
              <p className="text-xs uppercase tracking-wider text-paper/60 print:text-muted">{isInquiry ? "Anfragenummer" : "Buchungsnummer"}</p>
              <p className="font-serif text-3xl font-semibold tracking-wide text-gold-light print:text-ink" data-testid="booking-number">
                {b.bookingNumber}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="card-surface p-6 md:p-8" aria-labelledby="details-title">
            <h2 id="details-title" className="font-serif text-2xl">
              Details
            </h2>
            <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Detail label="Status">
                <span data-testid="booking-status">{BOOKING_STATUS_LABEL[b.status as BookingStatus]}</span>
              </Detail>
              <Detail label="Zahlungsstatus">{isInquiry ? "keine Zahlung (Anfrage)" : PAYMENT_STATUS_LABEL[b.paymentStatus as PaymentStatus]}</Detail>
              <Detail label="Bereiche" wide>
                <ul className="flex flex-wrap gap-2" data-testid="booking-spaces">
                  {b.spaces.map((s) => (
                    <li key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-sm font-semibold">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </li>
                  ))}
                </ul>
              </Detail>
              <Detail label="Datum">{formatInstantDateLong(start)}</Detail>
              <Detail label="Zeitraum">
                {b.rentalMode === "daily" ? `${formatDateTime(start)} – ${formatDateTime(end)} Uhr` : `${formatTime(start)}–${formatTime(end)} Uhr`}
                <span className="block text-sm text-muted">{formatDuration(Math.round((end - start) / 60000))}</span>
              </Detail>
              <Detail label="Veranstaltung">{b.eventType}</Detail>
              <Detail label="Personenzahl">{b.guestCount ?? "–"}</Detail>
              <Detail label="Übergabe">{b.handoverAt ? `${formatDateTime(Date.parse(b.handoverAt))} Uhr` : "wird abgestimmt"}</Detail>
              <Detail label="Rückgabe">{b.returnAt ? `${formatDateTime(Date.parse(b.returnAt))} Uhr` : "wird abgestimmt"}</Detail>
              <Detail label="Kontakt" wide>
                {b.customer.name}
                {b.customer.company && `, ${b.customer.company}`}
                <span className="block text-sm text-muted">
                  {b.customer.email} · {b.customer.phone}
                </span>
              </Detail>
              {b.notes && (
                <Detail label="Bemerkungen" wide>
                  {b.notes}
                </Detail>
              )}
            </dl>
          </section>

          <aside className="space-y-6">
            <section className="card-surface p-6 md:p-8" aria-labelledby="price-title">
              <h2 id="price-title" className="mb-4 font-serif text-2xl">
                Preis
              </h2>
              <PriceBreakdown quote={b.quote} demo={b.isDemo} showDueNow={!isInquiry} />
            </section>
            <section className="card-surface space-y-3 p-6 print:hidden">
              <ButtonLink href={icsHref} variant="secondary" className="w-full">
                <CalendarPlus className="h-4 w-4" /> Zum Kalender hinzufügen
              </ButtonLink>
              <PrintButton />
              <ButtonLink href="/" variant="ghost" className="w-full">
                <Home className="h-4 w-4" /> Zur Startseite
              </ButtonLink>
              <p className="flex items-start gap-2 pt-2 text-xs text-muted">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Diesen Link bitte aufbewahren – er ist Ihr persönlicher Zugang zu dieser {isInquiry ? "Anfrage" : "Buchung"}.
              </p>
            </section>
            <p className="text-sm text-muted">
              Fragen? <Link href="/kontakt" className="font-semibold text-gold-dark underline underline-offset-4">Kontakt</Link> · {siteConfig.name}, {siteConfig.address.postalCode} {siteConfig.address.city}
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 font-semibold">{children}</dd>
    </div>
  );
}

