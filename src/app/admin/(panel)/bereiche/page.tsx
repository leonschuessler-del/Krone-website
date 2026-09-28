import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Map as MapIcon } from "lucide-react";
import { BOOKING_MODE_LABEL, PRICE_MODEL_LABEL, SPACE_TYPE_LABEL } from "@/features/admin/labels";
import { Badge, Card, PageHeader, tableClass, tdClass, thClass } from "@/features/admin/ui";
import { cn } from "@/lib/cn";
import { formatArea, formatCapacity, formatMoney } from "@/lib/format";
import { requireAdminPage } from "@/server/auth/admin-session";
import { getDb } from "@/server/db/client";
import { listAdminSpaces } from "@/server/services/admin-catalog-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bereiche" };

export default async function AdminSpacesPage() {
  await requireAdminPage("/admin/bereiche");
  const spaces = await listAdminSpaces(await getDb());

  return (
    <>
      <PageHeader
        eyebrow="Stammdaten"
        title="Bereiche"
        description="Räume und Flächen der Krone. Unbekannte Angaben bleiben leer und werden auf der Website als „Angabe folgt“ bzw. „Preis folgt“ angezeigt – niemals als 0."
        actions={
          <Link href="/admin/karte" className="inline-flex h-9 items-center gap-2 rounded-full border border-ink/20 bg-white px-4 text-sm font-semibold hover:border-ink/40">
            <MapIcon className="h-4 w-4" /> Karten-Editor
          </Link>
        }
      />
      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className={cn(tableClass, "min-w-[980px]")}>
            <thead>
              <tr>
                <th className={thClass}>Bereich</th>
                <th className={thClass}>Fläche / Kapazität</th>
                <th className={thClass}>Preis</th>
                <th className={thClass}>Buchung</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Zu bestätigen</th>
                <th className={thClass}>
                  <span className="sr-only">Aktion</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {spaces.map((s) => (
                <tr key={s.id} className={cn("transition-colors hover:bg-cream/45", !s.active && "opacity-60")}>
                  <td className={tdClass}>
                    <Link href={`/admin/bereiche/${s.id}`} className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg font-serif text-sm font-bold text-white" style={{ background: s.color }}>
                        {s.code}
                      </span>
                      <span>
                        <span className="block font-semibold text-ink">{s.name}</span>
                        <span className="text-xs text-muted">
                          {SPACE_TYPE_LABEL[s.type] ?? s.type} · {s.featureCount} Ausstattungsmerkmal{s.featureCount === 1 ? "" : "e"}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className={tdClass}>
                    <span className="block">{formatArea(s.areaSqm)}</span>
                    <span className="text-xs text-muted">{formatCapacity(s.capacitySeated, s.capacityStanding)}</span>
                  </td>
                  <td className={tdClass}>
                    <span className="block font-semibold tabular-nums">{s.priceModel === "on_request" ? "auf Anfrage" : formatMoney(s.basePrice)}</span>
                    <span className="text-xs text-muted">{s.priceModel ? PRICE_MODEL_LABEL[s.priceModel] : "Preismodell offen"}</span>
                  </td>
                  <td className={tdClass}>
                    <span className="block">{BOOKING_MODE_LABEL[s.bookingMode]}</span>
                    <span className="text-xs text-muted">{s.availableForStandaloneRental ? "einzeln buchbar" : "nur in Kombination"}</span>
                  </td>
                  <td className={tdClass}>
                    <div className="flex flex-wrap gap-1">
                      {s.active ? <Badge tone="success">aktiv</Badge> : <Badge tone="neutral">inaktiv</Badge>}
                      {!s.bookable && <Badge tone="neutral">nicht buchbar</Badge>}
                      {s.polygonOverride && <Badge tone="info">Karte angepasst</Badge>}
                    </div>
                  </td>
                  <td className={tdClass}>
                    {s.needsVerification.length ? <Badge tone="warning">{s.needsVerification.length} offen</Badge> : <Badge tone="success">vollständig</Badge>}
                  </td>
                  <td className={cn(tdClass, "text-right")}>
                    <Link href={`/admin/bereiche/${s.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-gold-dark hover:underline">
                      Bearbeiten <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
