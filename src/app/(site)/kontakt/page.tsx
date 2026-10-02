import type { Metadata } from "next";
import { Mail, MapPin, Phone, Printer } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { formatAddressLine, siteConfig } from "@/config/site";
import { arrival, HOTEL_COORDS } from "@/content/sights";
import { ContactForm } from "@/features/contact/ContactForm";
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
            <p className="eyebrow">Kontakt</p>
            <h1 className="mt-3 text-5xl font-light md:text-6xl">
              Sprechen Sie <em>mit uns.</em>
            </h1>
            <p className="mt-4 text-lg text-ink-soft">Zimmer, Feiern, Mietanfragen – wir antworten persönlich, meist innerhalb eines Tages.</p>
            <ul className="mt-10 space-y-5">
              <li className="flex gap-4">
                <MapPin className="mt-1 h-5 w-5 text-gold-dark" />
                <span>
                  <strong className="block">Landhotel Gasthof „Zur Krone“</strong>
                  Inh. Boris Schüßler
                  <br />
                  {formatAddressLine()}
                </span>
              </li>
              <li className="flex gap-4">
                <Phone className="mt-1 h-5 w-5 text-gold-dark" />
                <span>{contact.phone && <a href={`tel:${contact.phone.replace(/[\s-]/g, "")}`}>{contact.phone}</a>}</span>
              </li>
              <li className="flex gap-4">
                <Printer className="mt-1 h-5 w-5 text-gold-dark" />
                <span>Fax {contact.fax}</span>
              </li>
              <li className="flex gap-4">
                <Mail className="mt-1 h-5 w-5 text-gold-dark" />
                <span>{contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}</span>
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
          <dl className="mt-8 grid gap-px overflow-hidden border border-sand bg-sand sm:grid-cols-2 lg:grid-cols-5">
            {arrival.map((a) => (
              <div key={a.label} className="bg-white p-5">
                <dt className="text-[0.62rem] font-medium uppercase tracking-[0.25em] text-gold-dark">{a.label}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-ink-soft">{a.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
