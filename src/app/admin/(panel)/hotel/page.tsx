import type { Metadata } from "next";
import { roomInventory, roomTypeSeeds } from "@/content/hotel";
import { nightCount } from "@/domain/hotel";
import { HotelReservationActions } from "@/features/admin/hotel/HotelReservationActions";
import { Badge, Card, EmptyState, PageHeader, tableClass, tdClass, thClass } from "@/features/admin/ui";
import { formatDateMedium, formatMoney } from "@/lib/format";
import { getDb } from "@/server/db/client";
import { listHotelReservations } from "@/server/services/hotel-service";

export const metadata: Metadata = { title: "Hotel" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "warning" | "success" | "neutral" }> = {
  requested: { label: "Anfrage", tone: "warning" },
  confirmed: { label: "Bestätigt", tone: "success" },
  cancelled: { label: "Storniert", tone: "neutral" },
};

export default async function HotelAdminPage() {
  const rows = await listHotelReservations(await getDb());
  const open = rows.filter((r) => r.r.status === "requested");
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Landhotel"
        title="Zimmerreservierungen"
        description={`${open.length} offene ${open.length === 1 ? "Anfrage" : "Anfragen"} · ${roomTypeSeeds.map((t) => `${roomInventory[t.inventoryGroup]}× ${t.name}`).filter((v, i, a) => a.indexOf(v) === i).join(" · ")}`}
      />
      <Card title="Reservierungen" description="Anfragen bestätigen oder ablehnen – der Gast erhält sofort die passende E-Mail, bestätigte Aufenthalte landen im Kalender und bei DIRS21 (sofern verbunden).">
        {rows.length === 0 ? (
          <EmptyState title="Noch keine Zimmeranfragen">Anfragen aus der Hotelbuchung erscheinen hier.</EmptyState>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Nummer</th>
                  <th className={thClass}>Gast</th>
                  <th className={thClass}>Zimmer</th>
                  <th className={thClass}>Aufenthalt</th>
                  <th className={thClass}>Preis</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ r, customer, type }) => (
                  <tr key={r.id} data-testid="hotel-row">
                    <td className={`${tdClass} font-mono text-xs`}>{r.reservationNumber ?? r.id.slice(0, 8)}</td>
                    <td className={tdClass}>
                      {customer ? (
                        <>
                          {customer.firstName} {customer.lastName}
                          <span className="block text-xs text-muted">{customer.email}{customer.phone ? ` · ${customer.phone}` : ""}</span>
                        </>
                      ) : (
                        "–"
                      )}
                      {r.notes && <span className="mt-1 block max-w-xs text-xs text-ink-soft">„{r.notes}“</span>}
                    </td>
                    <td className={tdClass}>
                      {r.rooms} × {type.name}
                      <span className="block text-xs text-muted">{r.guests} Gäste</span>
                    </td>
                    <td className={tdClass}>
                      {formatDateMedium(r.arrivalDate)} – {formatDateMedium(r.departureDate)}
                      <span className="block text-xs text-muted">{nightCount(r.arrivalDate, r.departureDate)} Nächte</span>
                    </td>
                    <td className={`${tdClass} tabular-nums`}>{formatMoney(r.totalPrice, "auf Anfrage")}</td>
                    <td className={tdClass}>
                      <Badge tone={STATUS[r.status]?.tone ?? "neutral"}>{STATUS[r.status]?.label ?? r.status}</Badge>
                      {r.channelRef && <span className="block text-[0.65rem] text-muted">DIRS21 {r.channelRef}</span>}
                    </td>
                    <td className={tdClass}>
                      <HotelReservationActions id={r.id} status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
