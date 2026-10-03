import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BedDouble, BedSingle, CalendarCheck, CircleAlert, DoorOpen, Euro, Hotel, Hourglass, House, Ruler, Sparkles, TreeDeciduous, Users, Wallet, type LucideIcon } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Gallery } from "@/components/media/Gallery";
import { MediaPlaceholder } from "@/components/media/MediaPlaceholder";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SelectSpaceButton } from "@/features/spaces/SelectSpaceButton";
import { SpaceAvailability } from "@/features/spaces/SpaceAvailability";
import { hotelCopy, roomTypeSeeds, type RoomTypeSeed } from "@/content/hotel";
import { SpaceMiniMap } from "@/features/spaces/SpaceMiniMap";
import { formatPriceFrom } from "@/features/spaces/price-label";
import { env } from "@/lib/env";
import { displayFacts, ESTIMATE_NOTE } from "@/content/space-estimates";
import { formatDuration, formatMoney } from "@/lib/format";
import { listSpaceViews } from "@/server/services/space-service";

export const dynamic = "force-dynamic";

const TYPE_LABEL = { indoor: "Innenbereich", outdoor: "Außenbereich", hotel: "Hotel", service: "Funktionsbereich" } as const;
const MODE_LABEL = { instant: "Direktbuchung", inquiry: "auf Anfrage", both: "Direktbuchung oder Anfrage" } as const;

const stripPlaceholder = (t: string | null) => t?.replace(/\s*\[PLACEHOLDER[^\]]*\]/g, "").trim() ?? null;

/** Room rows on the hotel plan: glyph by bed kind, the whole floor gets the hotel glyph. */
const ROOM_ICON: Record<RoomTypeSeed["bedKind"], LucideIcon> = { double: BedDouble, single: BedSingle, multi: House };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const space = (await listSpaceViews()).find((s) => s.slug === slug);
  if (!space) return { title: "Bereich nicht gefunden" };
  return {
    title: `${space.name} mieten`,
    description: `${space.name} in der Krone Leidersbach – ${space.shortDescription ?? ""} Verfügbarkeit prüfen und buchen.`,
    alternates: { canonical: space.href },
    openGraph: { title: `${space.name} · Zur Krone Leidersbach`, images: space.media.hero ? [space.media.hero.src] : undefined },
  };
}

export default async function SpaceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const spaces = await listSpaceViews();
  const space = spaces.find((s) => s.slug === slug);
  if (!space) notFound();
  const demo = env.demoMode;
  const unverified = new Set(space.needsVerification);
  const others = spaces.filter((s) => s.id !== space.id);
  const images = space.media.hero ? [space.media.hero, ...space.media.gallery.filter((g) => g.src !== space.media.hero!.src)] : space.media.gallery;

  const est = displayFacts(space);
  const facts: Array<{ icon: LucideIcon; label: string; value: string; pending?: boolean }> = [
    { icon: Ruler, label: "Fläche", value: est.area, pending: space.areaSqm === null && est.area === "Angabe folgt" },
    { icon: space.type === "hotel" ? BedDouble : Users, label: space.type === "hotel" ? "Zimmer" : "Sitzplätze", value: est.seats, pending: space.capacitySeated === null && est.seats === "Angabe folgt" },
    { icon: Users, label: "Stehplätze", value: space.capacityStanding !== null ? String(space.capacityStanding) : "Angabe folgt", pending: space.capacityStanding === null },
    { icon: Euro, label: "Preis", value: formatPriceFrom(space) + (demo && space.basePrice !== null ? " (Demo)" : ""), pending: space.basePrice === null },
    {
      icon: Hourglass,
      label: "Mindestdauer",
      value: space.minimumDurationMinutes !== null ? formatDuration(space.minimumDurationMinutes) : "Angabe folgt",
      pending: space.minimumDurationMinutes === null,
    },
    { icon: Wallet, label: "Kaution", value: formatMoney(space.deposit, "Angabe folgt") + (demo && space.deposit !== null ? " (Demo)" : ""), pending: space.deposit === null },
    { icon: Sparkles, label: "Endreinigung", value: formatMoney(space.cleaningFee, "Angabe folgt") + (demo && space.cleaningFee !== null ? " (Demo)" : ""), pending: space.cleaningFee === null },
    { icon: CalendarCheck, label: "Buchung", value: space.bookable ? MODE_LABEL[space.bookingMode] : "auf Anfrage" },
    { icon: space.type === "outdoor" ? TreeDeciduous : DoorOpen, label: "Art", value: TYPE_LABEL[space.type] },
  ];

  return (
    <article>
      {/* Hero */}
      <header className="relative isolate flex min-h-[72svh] items-end overflow-hidden bg-anthracite text-paper">
        <div className="absolute inset-0">
          {space.media.hero ? (
            <Image src={space.media.hero.src} alt={space.media.hero.alt} fill priority sizes="100vw" className="object-cover" />
          ) : (
            <MediaPlaceholder spaceId={space.id} code={space.code} color={space.color} size="lg" label={null} />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-anthracite via-anthracite/45 to-anthracite/10" />
        <div className="container-page relative pb-12 pt-32">
          <Breadcrumbs tone="dark" items={[{ label: "Start", href: "/" }, { label: "Bereiche", href: "/bereiche" }, { label: space.name }]} />
          <div className="mt-6 flex items-center gap-3">
            <span className="grid h-12 min-w-12 place-items-center rounded-full border border-white/40 px-2 font-serif text-lg font-semibold" style={{ background: space.color }}>
              {space.code}
            </span>
            <span className="eyebrow !text-gold-light">{TYPE_LABEL[space.type]}</span>
          </div>
          <h1 className="mt-4 text-5xl md:text-7xl">{space.name}</h1>
          <p className="mt-4 max-w-2xl text-lg text-paper/85">{space.shortDescription}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {space.bookable ? (
              <>
                <SelectSpaceButton spaceId={space.id} name={space.name} requires={space.requires} size="lg" />
                <ButtonLink href="/eventlocation#karte" variant="dark" size="lg">
                  Zum Raumplaner <ArrowRight className="h-4 w-4" />
                </ButtonLink>
              </>
            ) : space.type === "hotel" ? (
              <ButtonLink href="#zimmer" variant="gold" size="lg">
                <BedDouble className="h-4 w-4" /> Zimmer buchen
              </ButtonLink>
            ) : (
              <ButtonLink href="/eventlocation#karte" variant="gold" size="lg">
                Zum Raumplaner <ArrowRight className="h-4 w-4" />
              </ButtonLink>
            )}
          </div>
          {space.media.hero && !space.media.hero.isReal && (
            <span className="absolute bottom-4 right-5 rounded-full bg-anthracite/60 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wider text-paper/80">Beispielbild</span>
          )}
        </div>
      </header>

      {/* Description + facts */}
      <section className="bg-paper py-20" aria-labelledby="about-title">
        <div className="container-page grid gap-12 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <SectionHeading
              id="about-title"
              eyebrow="Beschreibung"
              title={
                <>
                  Der Bereich <span className="accent">{space.name}</span>
                </>
              }
            >
              <p>{stripPlaceholder(space.longDescription)}</p>
            </SectionHeading>
            {unverified.has("longDescription") && <p className="mt-3 text-xs uppercase tracking-wider text-muted">Ausführliche Beschreibung folgt</p>}

            <div className="mt-12 grid gap-8 sm:grid-cols-2">
              <ListBlock title="Ausstattung" items={space.features} empty="Die Ausstattung wird aktuell zusammengestellt." />
              <ListBlock title="Nutzungsmöglichkeiten" items={space.usageOptions} empty="Nutzungsmöglichkeiten werden ergänzt." />
              <ListBlock title="Regeln & Hinweise" items={space.rules} empty="Hausordnung und Nutzungsregeln folgen." wide />
            </div>
          </div>
          <aside>
            <div className="card-surface p-6">
              <h2 className="font-serif text-2xl">Auf einen Blick</h2>
              <dl className="mt-4 divide-y divide-sand">
                {facts.map((f) => (
                  <div key={f.label} className="flex items-baseline justify-between gap-4 py-2.5">
                    <dt className="flex items-center gap-2 text-sm text-muted">
                      <f.icon className="h-3.5 w-3.5 shrink-0 text-gold-dark" strokeWidth={1.5} aria-hidden />
                      {f.label}
                    </dt>
                    <dd className={f.pending ? "text-sm text-muted" : "font-semibold"}>{f.value}</dd>
                  </div>
                ))}
              </dl>
              {space.needsVerification.length > 0 && (
                <p className="mt-4 flex items-start gap-2 rounded-xl bg-cream p-3 text-xs text-ink-soft">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {est.estimated ? `ca.-Werte: ${ESTIMATE_NOTE}` : "Einige Angaben werden noch vom Betreiber bestätigt."}
                </p>
              )}
            </div>
          </aside>
        </div>
      </section>

      {/* Gallery + video */}
      <section className="bg-cream py-20" aria-labelledby="gallery-title">
        <div className="container-page">
          <SectionHeading id="gallery-title" eyebrow="Bilder" title="Eindrücke" className="mb-10" />
          {images.length ? (
            <Gallery images={images} label={`Galerie ${space.name}`} />
          ) : (
            <div className="grid h-72 overflow-hidden rounded-2xl">
              <MediaPlaceholder spaceId={space.id} code={space.code} color={space.color} />
            </div>
          )}
          {space.media.video && (
            <div className="mt-10">
              <h3 className="mb-4 font-serif text-2xl">Rundgang {space.media.video.isReal ? "" : "(Testvideo)"}</h3>
              <video
                className="aspect-video w-full rounded-2xl bg-anthracite object-cover shadow-lift"
                controls
                muted
                playsInline
                preload="none"
                poster={space.media.video.poster}
              >
                <source src={space.media.video.src} type={space.media.video.src.endsWith(".webm") ? "video/webm" : "video/mp4"} />
              </video>
            </div>
          )}
        </div>
      </section>

      {/* Hotel: upper-floor plan */}
      {space.type === "hotel" && (
        <section className="bg-paper py-20" aria-labelledby="plan-title">
          <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:items-center">
            <SectionHeading id="plan-title" eyebrow="1. Obergeschoss" title="Elf Zimmer über dem Gasthof">
              <p>Der Grundriss zeigt die Etage über Restaurant, Nebenzimmer und Bühne: acht Doppelzimmer, zwei Einzelzimmer, das Apartment mit eigener Küche und der Aufenthaltsraum mit Balkon.</p>
              <ul className="mt-5 divide-y divide-sand rounded-2xl border border-sand bg-white text-sm">
                {roomTypeSeeds.map((t) => {
                  const Icon = t.id === "floor" ? Hotel : ROOM_ICON[t.bedKind];
                  return (
                    <li key={t.id} className="flex items-baseline justify-between gap-4 px-4 py-3">
                      <span>
                        <span className="font-serif text-lg">
                          <Icon className="mr-2 inline h-4 w-4 -translate-y-px text-gold-dark" strokeWidth={1.5} aria-hidden />
                          {t.name}
                        </span>
                        <span className="block text-xs text-muted">{t.description}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{t.basePricePerNight === null ? "auf Anfrage" : `${formatMoney(t.basePricePerNight)} / Nacht`}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-sm text-muted">Grundriss nach dem Bauplan des Hauses.</p>
              <div className="mt-6">
                <ButtonLink href="#zimmer" variant="gold">
                  Zimmer buchen
                </ButtonLink>
              </div>
            </SectionHeading>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/media/hotel/grundriss-og.svg" alt="Grundriss Obergeschoss mit den Hotelzimmern" className="w-full rounded-[1.25rem] border border-sand bg-white p-3 shadow-soft" loading="lazy" />
          </div>
        </section>
      )}

      {/* Location on the property */}
      {space.type !== "hotel" && (
      <section className="bg-paper py-20" aria-labelledby="location-title">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-center">
          <SectionHeading id="location-title" eyebrow="Lage" title="Wo auf dem Grundstück?">
            <p>
              {space.shape
                ? `„${space.name}“ ist auf der Karte hervorgehoben – tippen Sie einen anderen Bereich an, um ihn zu entdecken.`
                : "Die genaue Abgrenzung dieses Bereichs auf dem Grundstück wird noch eingezeichnet."}
            </p>
            <p className="mt-2 text-sm text-muted">Drohnenaufnahme von oben – Raumgrenzen sinngemäß eingezeichnet.</p>
            {space.bookable && (
              <div className="mt-6">
                <ButtonLink href="/eventlocation#karte" variant="secondary">
                  Zum Raumplaner
                </ButtonLink>
              </div>
            )}
          </SectionHeading>
          <SpaceMiniMap spaces={spaces} currentId={space.id} />
        </div>
      </section>
      )}

      {/* Availability */}
      {space.bookable ? (
        <section className="bg-cream py-20" aria-labelledby="availability-title">
          <div className="container-page">
            <SectionHeading id="availability-title" eyebrow="Verfügbarkeit" title={`Freie Termine für ${space.name}`} className="mb-10">
              <p>Wählen Sie ein Datum und eine Uhrzeit – anschließend können Sie direkt buchen oder weitere Bereiche hinzufügen.</p>
            </SectionHeading>
            <SpaceAvailability space={space} spaces={spaces} />
          </div>
        </section>
      ) : space.type === "hotel" ? (
        <section id="zimmer" className="scroll-mt-24 bg-cream py-20" aria-labelledby="rooms-title">
          <div className="container-page">
            <SectionHeading id="rooms-title" eyebrow={hotelCopy.eyebrow} title={hotelCopy.title} className="mb-10">
              <p>{hotelCopy.text}</p>
            </SectionHeading>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/hotel/buchen" variant="gold" size="lg">
                Zimmer buchen
              </ButtonLink>
              <ButtonLink href="/hotel" variant="secondary" size="lg">
                Zimmer & Preise
              </ButtonLink>
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-cream py-20">
          <div className="container-page">
            <div className="card-surface p-8">
              <h2 className="font-serif text-3xl">Küche als Zusatzleistung</h2>
              <p className="mt-3 max-w-2xl text-ink-soft">
                Die Küche ist kein eigener Mietraum, sondern eine Zusatzleistung zu Ihrer Feier – ausschließlich mit einem Caterer. Sie wählen sie im Raumplaner unter Zusatzleistungen.
              </p>
              <ButtonLink href="/eventlocation#karte" variant="gold" className="mt-6">
                Zum Raumplaner
              </ButtonLink>
            </div>
          </div>
        </section>
      )}

      {/* Other spaces */}
      <section className="bg-paper py-20" aria-labelledby="more-title">
        <div className="container-page">
          <h2 id="more-title" className="font-serif text-3xl">
            Weitere Bereiche
          </h2>
          <ul className="mt-6 flex flex-wrap gap-2">
            {others.map((o) => (
              <li key={o.id}>
                <Link href={o.href} className="inline-flex items-center gap-2 rounded-full border border-sand bg-white px-4 py-2 font-semibold transition-colors duration-300 hover:border-gold hover:text-gold-dark">
                  <span className="font-serif text-xs text-gold-dark">{o.code}</span> {o.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </article>
  );
}

function ListBlock({ title, items, empty, wide }: { title: string; items: string[]; empty: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <h3 className="font-serif text-2xl">{title}</h3>
      {items.length ? (
        <ul className="mt-3 space-y-1.5 text-ink-soft">
          {items.map((i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" /> {i}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-muted">{empty}</p>
      )}
    </div>
  );
}
