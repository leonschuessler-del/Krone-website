"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { adminApi, describeApiError } from "../api-client";
import { inputClass, labelClass, Notice } from "../ui";

const REASONS = ["Zimmer in diesem Zeitraum belegt", "Zu viele Gäste für den Zimmertyp", "Haus in diesem Zeitraum geschlossen", "Sonstiger Grund"];

export function HotelReservationActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<"confirmed" | "cancelled" | null>(null);
  const [reason, setReason] = useState(REASONS[0]!);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  if (status === "cancelled") return <span className="text-xs text-muted">–</span>;

  async function submit() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = { status: pending };
    if (pending === "cancelled" && status === "requested") body.declineReason = reason;
    if (note.trim()) body.note = note.trim();
    const res = await adminApi<{ result: { email: string | null; calendar?: { ok: boolean; mode: string }; channel: { ok: boolean; error?: string } } }>(`/api/admin/hotel/${id}`, { method: "PATCH", body });
    setBusy(false);
    if (!res.ok) return setError(describeApiError(res));
    const bits = [pending === "confirmed" ? "Bestätigt" : "Abgelehnt"];
    if (res.data.result.email) bits.push("E-Mail erstellt");
    if (res.data.result.calendar?.ok) bits.push("Kalender aktualisiert");
    if (!res.data.result.channel.ok) bits.push(`DIRS21: ${res.data.result.channel.error}`);
    setDone(bits.join(" · "));
    setPending(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1.5">
      {status === "requested" ? (
        <div className="flex gap-1.5">
          <Button size="sm" className="!bg-success !text-white hover:!bg-success/90" onClick={() => setPending("confirmed")} data-testid="hotel-accept">
            <CheckCircle2 className="h-4 w-4" /> Bestätigen
          </Button>
          <Button size="sm" variant="danger" onClick={() => setPending("cancelled")} data-testid="hotel-decline">
            <XCircle className="h-4 w-4" /> Ablehnen
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setPending("cancelled")}>
          Stornieren
        </Button>
      )}
      {done && <span className="text-xs text-success">{done}</span>}
      <Dialog
        open={pending !== null}
        onClose={() => !busy && setPending(null)}
        title={pending === "confirmed" ? "Zimmer bestätigen?" : status === "requested" ? "Anfrage ablehnen?" : "Reservierung stornieren?"}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPending(null)} disabled={busy}>
              Abbrechen
            </Button>
            <Button variant={pending === "cancelled" ? "danger" : "primary"} size="sm" onClick={submit} disabled={busy} data-testid="hotel-confirm-action">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending === "confirmed" ? "Bestätigen" : status === "requested" ? "Absage senden" : "Stornieren"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          {error && <Notice tone="danger">{error}</Notice>}
          {pending === "confirmed" && <p>Der Gast erhält die Bestätigung; der Aufenthalt wird in den Kalender eingetragen und an DIRS21 gemeldet (sofern verbunden).</p>}
          {pending === "cancelled" && status === "requested" && (
            <label className="block">
              <span className={labelClass}>Grund</span>
              <select className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className={labelClass}>Persönliche Zeile (optional)</span>
            <textarea rows={2} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
      </Dialog>
    </div>
  );
}
