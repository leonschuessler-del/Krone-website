import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { SpaceCard } from "@/features/spaces/SpaceCard";
import { env } from "@/lib/env";
import { listSpaceViews } from "@/server/services/space-service";
import { pageMeta } from "@/lib/page-metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Räume – Gaststube, Säle, Wintergarten & Biergarten",
  description: "Alle Räume der Eventlocation Zur Krone in Leidersbach: Gaststube, Küche, Nebenzimmer, Bühne, Alte Wirtschaft, Wintergarten, Biergarten und die Hotel-Etage für Ihre Gäste – einzeln oder kombiniert, Preis auf Anfrage.",
  path: "/bereiche",
});

export default async function SpacesPage() {
  const spaces = await listSpaceViews();
  return (
    <div className="bg-paper pb-24 pt-28 md:pt-32">
      <div className="container-page">
        <Breadcrumbs items={[{ label: "Start", href: "/" }, { label: "Räume" }]} />
        <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="eyebrow">Die Räume</p>
            <h1 className="mt-3 text-5xl md:text-6xl">Räume für jeden Anlass</h1>
            <p className="mt-4 text-lg text-ink-soft">Jeder Raum ist einzeln oder kombiniert anfragbar. Wählen Sie aus – oder stellen Sie Ihre Kombination direkt auf der Karte zusammen. Ihr Angebot erhalten Sie persönlich.</p>
          </div>
          <ButtonLink href="/#karte" variant="gold">
            Auf der Karte wählen
          </ButtonLink>
        </div>
        <section aria-labelledby="raeume-liste" className="mt-12">
          <h2 id="raeume-liste" className="sr-only">
            Alle Räume im Überblick
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {spaces.map((s) => (
              <SpaceCard key={s.id} space={s} demo={env.demoMode} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
