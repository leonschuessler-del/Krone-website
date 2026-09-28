import type { Metadata } from "next";
import { floorplanMeta, getSpaceShape } from "@/config/floorplan";
import { MapEditor, type MapEditorSpace } from "@/features/admin/map/MapEditor";
import { PageHeader } from "@/features/admin/ui";
import { requireAdminPage } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { listSpaceRows } from "@/server/services/space-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Karten-Editor" };

export default async function AdminMapEditorPage({ searchParams }: { searchParams: Promise<{ bereich?: string }> }) {
  await requireAdminPage("/admin/karte");
  const sp = await searchParams;
  const rows = await listSpaceRows(await getDb(), { includeInactive: true });
  const spaces: MapEditorSpace[] = rows.map((r) => {
    const cfg = getSpaceShape(r.id);
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      color: r.color,
      level: cfg?.level ?? r.level,
      configPolygon: cfg?.polygon ? cfg.polygon.map(([x, y]) => [x, y] as [number, number]) : null,
      configLabel: cfg?.labelPosition ?? null,
      overridePolygon: r.polygonOverride ? r.polygonOverride.map(([x, y]) => [x, y] as [number, number]) : null,
      overrideLabel: r.labelPositionOverride ?? null,
    };
  });
  const initialId = spaces.some((s) => s.id === sp.bereich) ? sp.bereich! : (spaces[0]?.id ?? "");

  return (
    <>
      <PageHeader
        eyebrow="Grundstückskarte"
        title="Karten-Editor"
        description="Flächen der Bereiche auf der interaktiven Karte anpassen. Änderungen werden als Überschreibung in der Datenbank gespeichert und sofort auf der Website verwendet."
      />
      <MapEditor spaces={spaces} initialId={initialId} viewBox={floorplanMeta.viewBox} />
    </>
  );
}
