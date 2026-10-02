import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { SpaceCard } from "@/features/spaces/SpaceCard";
import { env } from "@/lib/env";
import { listSpaceViews } from "@/server/services/space-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bereiche – Restaurant, Eventräume, Biergarten & Hotel",
  description: "Alle Bereiche der Krone Leidersbach: Restaurant, Küche, Nebenzimmer, Bühne, Alte Wirtschaft, Wintergarten, Biergarten und Hotel.",
  alternates: { canonical: "/bereiche" },
};

export default async function SpacesPage() {
  const spaces = await listSpaceViews();
  return (
    <div className="bg-paper pb-24 pt-28 md:pt-32">
      <div className="container-page">
        <Breadcrumbs items={[{ label: "Start", href: "/" }, { label: "Bereiche" }]} />
        <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="eyebrow">Bereiche</p>
            <h1 className="mt-3 text-5xl md:text-6xl">Räume für jeden Anlass</h1>
            <p className="mt-4 text-lg text-ink-soft">Jeder Bereich ist einzeln oder kombiniert buchbar. Wählen Sie aus – oder stellen Sie Ihre Kombination direkt auf der Karte zusammen.</p>
          </div>
          <ButtonLink href="/eventlocation#karte" variant="gold">
            Auf der Karte wählen
          </ButtonLink>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {spaces.map((s) => (
            <SpaceCard key={s.id} space={s} demo={env.demoMode} />
          ))}
        </div>
      </div>
    </div>
  );
}
