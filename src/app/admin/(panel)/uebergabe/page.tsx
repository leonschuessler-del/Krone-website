import type { Metadata } from "next";
import { HandoverManager } from "@/features/admin/handover/HandoverManager";
import { Notice, PageHeader } from "@/features/admin/ui";
import { requireAdminPage } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { listHandoverSlots } from "@/server/services/admin-catalog-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Übergabezeiten" };

export default async function AdminHandoverPage() {
  await requireAdminPage("/admin/uebergabe");
  const slots = await listHandoverSlots(await getDb());
  const activeCount = slots.filter((s) => s.active).length;

  return (
    <>
      <PageHeader
        eyebrow="Ablauf"
        title="Übergabezeiten"
        description="Feste Zeitpunkte für Schlüsselübergabe und Rückgabe, die Gäste bei der Buchung auswählen. Die Belegung im Kalender wird automatisch um Übergabe und Rückgabe erweitert."
      />
      {activeCount === 0 && (
        <Notice tone="info" className="mb-6">
          Es sind keine aktiven Zeiten hinterlegt – Übergabe und Rückgabe werden dann individuell mit den Gästen abgestimmt.
        </Notice>
      )}
      <HandoverManager slots={slots} />
    </>
  );
}
