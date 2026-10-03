import type { Metadata } from "next";
import { Mail, MapPin, Navigation, Phone, Printer } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { formatAddressLine, siteConfig } from "@/config/site";
import { HOTEL_COORDS } from "@/content/sights";
import { ContactForm } from "@/features/contact/ContactForm";
import { ArrivalGrid } from "@/features/sights/ArrivalGrid";
import { LeafletMap } from "@/features/sights/LeafletMap";

export const metadata: Metadata = {
  title: "Kontakt & Anfahrt",
  description: "Kontakt zum Landhotel Gasthof Zur Krone in Leidersbach – Zimmer, Veranstaltungen, Mietanfragen. Adresse, Telefon, Karte und Anfahrt.",
  alternates: { canonical: "/kontakt" },
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ betreff?: string }> }) {
  const { betreff } = await searchParams;
  const { contact } = siteConfig;
  return (
    <div className="bg-paper pb-24 pt-28 md:pt-36">
      <div className="container-page">
        <Breadcrumbs items={[{ label: "Start", href: "/" }, { label: "Kontakt" }]} />
        <div className="mt-6 grid gap-12 lg:grid-cols-[1fr_1.5fr]">
          <div>
            <p className="eyebrow flex items-center gap-3">
              <span className="gold-rule" aria-hidden />
              Kontakt
            </p>
            <h1 className="mt-3 text-5xl font-light md:text-6xl">
              Sprechen Sie <em className="accent">mit uns.</em>
            </h1>
            <p className="mt-4 text-lg text-ink-soft">Zimmer, Feiern, Mietanfragen – wir antworten persönlich, meist innerhalb eines Tages.</p>
            <ul className="mt-10 space-y-5">
              <li className="group flex gap-4">
                <MapPin className="mt-1 h-5 w-5 text-gold-dark transition-colors group-hover:text-gold" aria-hidden />
                <span>
                  <strong className="block">Landhotel Gasthof „Zur Krone“</strong>
                  Inh. Boris Schüßler
                  <br />
                  {formatAddressLine()}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(formatAddressLine())}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 flex w-fit items-center gap-1.5 text-sm text-gold-dark underline-offset-4 hover:underline"
                  >
                    <Navigation className="h-3.5 w-3.5" aria-hidden />
                    Route planen
                  </a>
                </span>
              </li>
              <li className="group flex gap-4">
                <Phone className="mt-1 h-5 w-5 text-gold-dark transition-colors group-hover:text-gold" aria-hidden />
                <span>
                  {contact.phone && (
                    <a href={`tel:${contact.phone.replace(/[\s-]/g, "")}`} className="underline-offset-4 transition-colors hover:text-gold-dark hover:underline">
                      {contact.phone}
                    </a>
                  )}
                </span>
              </li>
              <li className="flex gap-4">
                <Printer className="mt-1 h-5 w-5 text-gold-dark" aria-hidden />
                <span>Fax {contact.fax}</span>
              </li>
              <li className="group flex gap-4">
                <Mail className="mt-1 h-5 w-5 text-gold-dark transition-colors group-hover:text-gold" aria-hidden />
                <span>
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="underline-offset-4 transition-colors hover:text-gold-dark hover:underline">
                      {contact.email}
                    </a>
                  )}
                </span>
              </li>
            </ul>
          </div>
          <ContactForm defaultSubject={betreff ?? ""} />
        </div>

        <section id="karte" className="mt-24 scroll-mt-24" aria-labelledby="map-title">
          <SectionHeading id="map-title" eyebrow="Lage" title="Mitten in Leidersbach." className="mb-8">
            <p>Hauptstraße 106 – im Ortskern, mit kostenlosen Parkplätzen direkt am Haus.</p>
          </SectionHeading>
          <LeafletMap markers={[{ id: "hotel", name: "Landhotel Gasthof Zur Krone", lat: HOTEL_COORDS.lat, lng: HOTEL_COORDS.lng, text: formatAddressLine(), primary: true }]} center={HOTEL_COORDS} zoom={14} height="h-[24rem]" />
          <ArrivalGrid className="mt-8 lg:grid-cols-5" />
        </section>
      </div>
    </div>
  );
}
