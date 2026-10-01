import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { formatAddressLine, siteConfig } from "@/config/site";
import { ContactForm } from "@/features/contact/ContactForm";

export const metadata: Metadata = {
  title: "Kontakt",
  description: "Kontakt zur Krone Leidersbach – Fragen zu Räumen, Terminen, Veranstaltungen und Hotel.",
  alternates: { canonical: "/kontakt" },
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ betreff?: string }> }) {
  const { betreff } = await searchParams;
  const { contact } = siteConfig;
  return (
    <div className="bg-cream pb-24 pt-28 md:pt-32">
      <div className="container-page">
        <Breadcrumbs items={[{ label: "Start", href: "/" }, { label: "Kontakt" }]} />
        <div className="mt-6 grid gap-12 lg:grid-cols-[1fr_1.5fr]">
          <div>
            <p className="eyebrow">Kontakt</p>
            <h1 className="mt-3 text-5xl md:text-6xl">Sprechen Sie uns an.</h1>
            <p className="mt-4 text-lg text-ink-soft">Wir beraten Sie gern zu Räumen, Kombinationen und Terminen.</p>
            <ul className="mt-10 space-y-5">
              <li className="flex gap-4">
                <MapPin className="mt-1 h-5 w-5 text-gold-dark" />
                <span>
                  <strong className="block">{siteConfig.name}</strong>
                  {formatAddressLine()}
                  {siteConfig.address.street === null && <span className="block text-sm text-muted">Straße und Hausnummer folgen</span>}
                </span>
              </li>
              <li className="flex gap-4">
                <Phone className="mt-1 h-5 w-5 text-gold-dark" />
                <span>{contact.phone ? <a href={`tel:${contact.phone.replace(/[\s-]/g, "")}`}>{contact.phone}</a> : <span className="text-muted">Telefonnummer folgt</span>}</span>
              </li>
              <li className="flex gap-4">
                <Mail className="mt-1 h-5 w-5 text-gold-dark" />
                <span>{contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : <span className="text-muted">E-Mail-Adresse folgt</span>}</span>
              </li>
            </ul>
            {contact.openingHoursNote === null && <p className="mt-8 text-sm text-muted">Erreichbarkeitszeiten werden ergänzt.</p>}
          </div>
          <ContactForm defaultSubject={betreff ?? ""} />
        </div>
      </div>
    </div>
  );
}
