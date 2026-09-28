import type { Metadata } from "next";
import { todayLocal } from "@/domain/time";
import { BlockForm } from "@/features/admin/blocks/BlockForm";
import { BlockList } from "@/features/admin/blocks/BlockList";
import { PageHeader } from "@/features/admin/ui";
import { requireAdminPage } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { listManualBlocks } from "@/server/services/admin-service";
import { listSpaceRows } from "@/server/services/space-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sperrzeiten" };

export default async function AdminBlocksPage() {
  await requireAdminPage("/admin/sperrzeiten");
  const db = await getDb();
  const [spaceRows, blocks] = await Promise.all([listSpaceRows(db), listManualBlocks(db)]);
  const spaces = spaceRows.map((s) => ({ id: s.id, name: s.name, code: s.code, color: s.color, bookable: s.bookable }));

  return (
    <>
      <PageHeader
        eyebrow="Verfügbarkeit"
        title="Sperrzeiten"
        description="Bereiche manuell sperren – z. B. für Eigenveranstaltungen, Wartung oder Betriebsruhe. Gesperrte Zeiten sind sofort auf der Website und im Buchungsprozess nicht mehr buchbar."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(360px,440px)_1fr]">
        <BlockForm spaces={spaces} today={todayLocal()} />
        <BlockList blocks={blocks} now={Date.now()} />
      </div>
    </>
  );
}
