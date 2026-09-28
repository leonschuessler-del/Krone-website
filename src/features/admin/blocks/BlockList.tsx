"use client";

import { Loader2, Trash2, Wrench, Ban } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/format";
import { adminApi } from "../api-client";
import { BLOCK_TYPE_LABEL } from "../labels";
import { Badge, Card, DemoBadge, EmptyState, Notice, SpaceDot } from "../ui";

export interface BlockListItem {
  id: string;
  spaceId: string;
  spaceName: string;
  spaceColor: string;
  start: number;
  end: number;
  type: "reserved" | "booked" | "blocked" | "maintenance";
  reason: string | null;
  isDemo: boolean;
  createdBy: string | null;
  createdAt: number;
}

export function BlockList({ blocks, now }: { blocks: BlockListItem[]; now: number }) {
  const router = useRouter();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    setBusyId(id);
    setError(null);
    const res = await adminApi(`/api/admin/availability-blocks/${id}`, { method: "DELETE" });
    setBusyId(null);
    setConfirmId(null);
    if (!res.ok) return setError(res.message);
    router.refresh();
  }

  return (
    <Card
      title="Aktuelle und kommende Sperrzeiten"
      description="Manuelle Sperren ohne Buchungsbezug. Belegungen durch Buchungen werden über die jeweilige Buchung verwaltet."
      actions={
        <Link href="/admin/kalender" className="text-sm font-semibold text-gold-dark hover:underline">
          Im Kalender ansehen
        </Link>
      }
      bodyClassName="p-0"
    >
      {error && <Notice tone="danger" className="m-4">{error}</Notice>}
      {blocks.length === 0 ? (
        <EmptyState title="Keine Sperrzeiten">Alle Bereiche sind – abgesehen von Buchungen – frei buchbar.</EmptyState>
      ) : (
        <ul className="divide-y divide-sand/70" data-testid="block-list">
          {blocks.map((b) => {
            const running = b.start <= now && b.end > now;
            return (
              <li key={b.id} id={`block-${b.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5" data-block-space={b.spaceId}>
                <div className="flex min-w-[180px] flex-1 items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cream text-ink-soft">
                    {b.type === "maintenance" ? <Wrench className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      <SpaceDot color={b.spaceColor} className="ring-0" />
                      {b.spaceName}
                      <Badge tone={b.type === "maintenance" ? "info" : "neutral"}>{BLOCK_TYPE_LABEL[b.type]}</Badge>
                      {running && <Badge tone="danger">läuft</Badge>}
                      {b.isDemo && <DemoBadge />}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {formatDateTime(b.start)} – {formatDateTime(b.end)} Uhr
                    </p>
                    <p className="text-xs text-muted">
                      {b.reason ?? "ohne Grund"} · angelegt von {b.createdBy?.replace(/^admin:/, "") ?? "–"}
                    </p>
                  </div>
                </div>
                {confirmId === b.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-danger">Wirklich aufheben?</span>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)} disabled={busyId !== null}>
                      Nein
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => remove(b.id)} disabled={busyId !== null} data-testid="confirm-delete-block">
                      {busyId === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Aufheben
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setConfirmId(b.id)} aria-label={`Sperrzeit ${b.spaceName} aufheben`}>
                    <Trash2 className="h-4 w-4" /> Aufheben
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
