import type { Metadata } from "next";
import { SettingsForm } from "@/features/admin/settings/SettingsForm";
import { PageHeader } from "@/features/admin/ui";
import { env } from "@/lib/env";
import { requireAdminPage } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { getVenueSettings } from "@/server/services/settings-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Einstellungen" };

export default async function AdminSettingsPage() {
  await requireAdminPage("/admin/einstellungen");
  const settings = await getVenueSettings(await getDb());

  return (
    <>
      <PageHeader
        eyebrow="Betrieb"
        title="Einstellungen"
        description="Buchungszeiten, Zahlungsregeln und vorläufige Reservierungen. Änderungen gelten sofort für neue Anfragen und Buchungen."
      />
      <SettingsForm settings={settings} demoMode={env.demoMode} />
    </>
  );
}
