import type { Metadata } from "next";
import { BundleRulesSection } from "@/features/admin/pricing/BundleRulesSection";
import { ExtrasSection } from "@/features/admin/pricing/ExtrasSection";
import { PricingRulesSection } from "@/features/admin/pricing/PricingRulesSection";
import { Notice, PageHeader } from "@/features/admin/ui";
import { env } from "@/lib/env";
import { requireAdminPage } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { listPricingData } from "@/server/services/admin-catalog-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preise & Extras" };

export default async function AdminPricingPage() {
  await requireAdminPage("/admin/preise");
  const data = await listPricingData(await getDb());

  return (
    <>
      <PageHeader
        eyebrow="Preise"
        title="Preise & Extras"
        description="Grundpreise pflegen Sie beim jeweiligen Bereich. Hier: abweichende Preisregeln, Kombi-Preise und Zusatzleistungen. Alle Beträge in Euro."
      />
      <nav className="mb-6 flex flex-wrap gap-2 text-sm font-semibold" aria-label="Abschnitte">
        {[
          ["#preisregeln", `Preisregeln (${data.rules.length})`],
          ["#kombipreise", `Kombi-Preise (${data.bundles.length})`],
          ["#extras", `Extras (${data.extras.length})`],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full border border-stone/70 bg-white px-3.5 py-1.5 text-ink-soft hover:border-ink/40">
            {label}
          </a>
        ))}
      </nav>
      {env.demoMode && (
        <Notice tone="warning" className="mb-6">
          DEMO-Modus: Mit „Demo“ gekennzeichnete Preise sind Beispielwerte. Vor dem Live-Betrieb durch echte Preise ersetzen oder löschen.
        </Notice>
      )}
      <div className="space-y-6">
        <PricingRulesSection rules={data.rules} spaces={data.spaces} />
        <BundleRulesSection bundles={data.bundles} spaces={data.spaces} />
        <ExtrasSection extras={data.extras} />
      </div>
    </>
  );
}
