import type { Metadata } from "next";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { arrival, HOTEL_COORDS, ringLabels, sights } from "@/content/sights";
import { LeafletMap } from "@/features/sights/LeafletMap";
import { SightCard } from "@/features/sights/SightCard";
import { getPropertyGallery, mediaExists } from "@/lib/media";

export const metadata: Metadata = {
  title: "Umgebung & Sehenswürdigkeiten – Spessart, Aschaffenburg, Frankfurt",
  description: "Ausflugsziele rund um Leidersbach: Schloss Mespelbrunn, Aschaffenburg, Churfranken, Miltenberg, Frankfurt und Würzburg – mit Fahrzeiten ab Hotel und Karte.",
  alternates: { canonical: "/sehenswuerdigkeiten" },
};

export default function SightsPage() {
  const hero = mediaExists("/media/property/house-front.webp") ? { src: "/media/property/house-front.webp" } : (getPropertyGallery()[0] ?? null);
  const rings: Array<keyof typeof ringLabels> = ["nah", "mittel", "fern"];
  const markers = [
    { id: "hotel", name: "Landhotel Gasthof Zur Krone", lat: HOTEL_COORDS.lat, lng: HOTEL_COORDS.lng, text: "Hauptstraße 106, 63849 Leidersbach", primary: true },
    ...sights.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, minutes: s.minutes })),
  ];
  return (
    <article>
      <header className="relative isolate flex min-h-[70svh] items-end overflow-hidden bg-anthracite text-paper" data-hero>
        {hero && <Image src={hero.src} alt="" fill priority sizes="100vw" className="object-cover object-[50%_35%]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-anthracite via-anthracite/55 to-anthracite/35" /><div className="absolute inset-0 bg-gradient-to-r from-anthracite/70 via-transparent to-transparent" />
        <div className="container-page relative pb-16 pt-40 text-shadow-hero">
          <p className="eyebrow !text-gold-light">Umgebung</p>
          <h1 className="mt-5 max-w-3xl text-[3rem] font-light leading-[0.98] md:text-[4.8rem]">
            Spessart vor der Tür, <em>die Welt eine Stunde weit.</em>
          </h1>
          <p className="mt-6 max-w-xl text-lg font-light text-paper/85">Ein Wasserschloss, Weinberge am Main, eine Residenzstadt und eine Skyline: Leidersbach liegt ruhig – und mitten drin.</p>
        </div>
      </header>

      {rings.map((ring, ri) => {
        const list = sights.filter((s) => s.ring === ring);
        return (
          <section key={ring} className={ri % 2 ? "bg-cream py-24" : "bg-paper py-24"} aria-labelledby={`ring-${ring}`}>
            <div className="container-page">
              <SectionHeading id={`ring-${ring}`} eyebrow={`${String(ri + 1).padStart(2, "0")} / 03`} title={ringLabels[ring]} className="mb-12" />
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {list.map((s, i) => (
                  <SightCard key={s.id} sight={s} index={i} />
                ))}
              </div>
            </div>
          </section>
        );
      })}

      <section id="karte" className="scroll-mt-24 bg-paper pb-24" aria-labelledby="map-title">
        <div className="container-page">
          <SectionHeading id="map-title" eyebrow="Karte" title="Alles auf einen Blick." className="mb-10">
            <p>Das Hotel in Gold, die Ausflugsziele in Schwarz – antippen für Fahrzeit und Beschreibung.</p>
          </SectionHeading>
          <LeafletMap markers={markers} center={{ lat: 49.93, lng: 9.3 }} zoom={9} />
        </div>
      </section>

      <section className="bg-cream py-24" aria-labelledby="arrival-title">
        <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <SectionHeading id="arrival-title" eyebrow="Anfahrt" title="So kommen Sie zu uns.">
            <p>Kostenlose Parkplätze direkt am Haus. Motorradfahrer sind ausdrücklich willkommen – All Bikers Welcome.</p>
            <ButtonLink href="/kontakt" variant="secondary" className="mt-6">
              Kontakt & Adresse
            </ButtonLink>
          </SectionHeading>
          <dl className="grid gap-px overflow-hidden border border-sand bg-sand sm:grid-cols-2">
            {arrival.map((a) => (
              <div key={a.label} className="bg-white p-6">
                <dt className="text-[0.65rem] font-medium uppercase tracking-[0.25em] text-gold-dark">{a.label}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-ink-soft">{a.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </article>
  );
}
