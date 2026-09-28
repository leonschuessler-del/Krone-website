import type { Metadata } from "next";
import { Suspense } from "react";
import { eventTypes } from "@/content/event-types";
import { terms } from "@/content/terms";
import { BookingWizard } from "@/features/booking/wizard/BookingWizard";
import { env } from "@/lib/env";
import { getDb } from "@/server/db/client";
import { listOfferedExtras } from "@/server/services/pricing-service";
import { listSpaceViews } from "@/server/services/space-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Buchen & Anfragen",
  description: "Bereiche wählen, freie Termine prüfen und direkt buchen oder unverbindlich anfragen – Zur Krone Leidersbach.",
  robots: { index: false },
};

export default async function BookingPage() {
  const db = await getDb();
  const [spaces, extras] = await Promise.all([listSpaceViews(db), listOfferedExtras(db)]);
  return (
    <div className="bg-cream pb-24 pt-28 md:pt-32">
      <div className="container-page">
        <p className="eyebrow">Buchung</p>
        <h1 className="mt-3 text-4xl md:text-5xl">Ihre Veranstaltung in der Krone</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">
          Wählen Sie Bereiche und Termin – die Verfügbarkeit wird für jeden Bereich live geprüft. Am Ende buchen Sie direkt oder fragen unverbindlich an.
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
                priceModel: e.priceModel,
                unitPrice: e.unitPrice,
                maxQuantity: e.maxQuantity,
                confirmed: e.confirmed,
                isDemo: e.isDemo,
              }))}
              eventTypes={eventTypes}
              terms={terms}
              demo={env.demoMode}
              paymentProvider={env.paymentProvider}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
