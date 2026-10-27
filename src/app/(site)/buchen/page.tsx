import type { Metadata } from "next";
import { Suspense } from "react";
import { siteScope } from "@/config/scope";
import { eventTypes } from "@/content/event-types";
import { terms } from "@/content/terms";
import { BookingWizard } from "@/features/booking/wizard/BookingWizard";
import { env } from "@/lib/env";
import { getDb } from "@/server/db/client";
import { listOfferedExtras } from "@/server/services/pricing-service";
import { listSpaceViews } from "@/server/services/space-service";
import { pageMeta } from "@/lib/page-metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: siteScope.requestOnly ? "Termin anfragen" : "Buchen & Anfragen",
  description: siteScope.requestOnly
    ? "Räume wählen, freie Termine prüfen und unverbindlich anfragen – Sie erhalten ein individuelles Angebot. Zur Krone Leidersbach."
    : "Bereiche wählen, freie Termine prüfen und direkt buchen oder unverbindlich anfragen – Zur Krone Leidersbach.",
  path: "/buchen",
  noindex: true,
});

export default async function BookingPage() {
  const db = await getDb();
  const [spaces, extras] = await Promise.all([listSpaceViews(db), listOfferedExtras(db)]);
  return (
    <div className="bg-cream pb-24 pt-28 md:pt-32">
      <div className="container-page">
        <p className="eyebrow">{siteScope.requestOnly ? "Unverbindliche Anfrage" : "Buchung"}</p>
        <h1 className="mt-3 text-4xl md:text-5xl">Ihre Veranstaltung in der Krone</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">
          {siteScope.requestOnly
            ? "Wählen Sie Räume und Termin – die Verfügbarkeit prüfen wir live für jeden Raum. Sie senden eine unverbindliche Anfrage und erhalten von uns ein individuelles Angebot."
            : "Wählen Sie Räume und Termin – die Verfügbarkeit wird für jeden Raum live geprüft. Am Ende senden Sie Ihre Anfrage; wir bestätigen persönlich."}
        </p>
        <div className="mt-10">
          <Suspense>
            <BookingWizard
              spaces={spaces}
              extras={extras.map((e) => ({
                id: e.id,
                name: e.name,
                description: e.description,
                category: e.category,
                // props are serialised into the page – no price data while prices are hidden
                ...(siteScope.showPrices ? { priceModel: e.priceModel, unitPrice: e.unitPrice } : {}),
                maxQuantity: e.maxQuantity,
                confirmed: e.confirmed,
                isDemo: e.isDemo,
              }))}
              eventTypes={eventTypes}
              terms={terms}
              demo={env.demoMode}
              paymentProvider={siteScope.requestOnly ? "none" : env.paymentProvider}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
