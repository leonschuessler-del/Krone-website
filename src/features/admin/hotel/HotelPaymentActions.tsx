"use client";

import { CreditCard, Loader2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { cancellationFee } from "@/domain/hotel";
import { todayLocal } from "@/domain/time";
import { formatMoney } from "@/lib/format";
import { adminApi, describeApiError } from "../api-client";
import { inputClass, labelClass, Notice } from "../ui";

/**
 * Payment actions of a room reservation: refund an online payment, or charge
 * the stored card for a no-show / late cancellation (amount proposed from the
 * house's cancellation rule, editable).
 */
export function HotelPaymentActions({ id, paymentStatus, total, arrival }: { id: string; paymentStatus: string; total: number | null; arrival: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"refund" | "charge" | null>(null);
  const [noShow, setNoShow] = useState(true);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  if (paymentStatus !== "paid" && paymentStatus !== "guaranteed") return null;

  const proposed = total === null ? 0 : cancellationFee(total, arrival, todayLocal(), noShow).amount;
  const open = (m: "refund" | "charge") => {
    setMode(m);
    setError(null);
    setAmount(m === "charge" ? String(proposed / 100) : total === null ? "" : String(total / 100));
  };
  const cents = Math.round(Number(amount.replace(",", ".")) * 100) || 0;

  async function submit() {
    if (!mode) return;
    setBusy(true);
    setError(null);
    const res = await adminApi<{ result: { refunded?: number; charged?: number } }>(`/api/admin/hotel/${id}/payment`, {
      method: "POST",
      body: mode === "refund" ? { action: "refund", amount: cents } : { action: "charge", amount: cents, reason: noShow ? "Nichtanreise" : "Stornogebühr" },
    });
    setBusy(false);
    if (!res.ok) return setError(describeApiError(res));
    setDone(mode === "refund" ? `${formatMoney(res.data.result.refunded ?? cents)} erstattet` : `${formatMoney(res.data.result.charged ?? cents)} belastet`);
    setMode(null);
    router.refresh();
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      {paymentStatus === "paid" && (
        <Button size="sm" variant="ghost" onClick={() => open("refund")} data-testid="hotel-refund">
          <Undo2 className="h-4 w-4" /> Erstatten
        </Button>
      )}
      {paymentStatus === "guaranteed" && (
        <Button size="sm" variant="ghost" onClick={() => open("charge")} data-testid="hotel-charge">
          <CreditCard className="h-4 w-4" /> Karte belasten
        </Button>
      )}
      {done && <span className="text-xs text-success">{done}</span>}
      <Dialog
        open={mode !== null}
        onClose={() => !busy && setMode(null)}
        title={mode === "refund" ? "Online-Zahlung erstatten" : "Hinterlegte Karte belasten"}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setMode(null)} disabled={busy}>
              Abbrechen
            </Button>
            <Button variant={mode === "refund" ? "primary" : "danger"} size="sm" onClick={submit} disabled={busy || cents <= 0}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "refund" ? `${formatMoney(cents)} erstatten` : `${formatMoney(cents)} belasten`}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          {error && <Notice tone="danger">{error}</Notice>}
          {mode === "charge" && (
            <>
              <p>Laut Stornobedingungen: in den letzten 2 Tagen vor Anreise 80 % des Gesamtpreises, bei Nichtanreise der Gesamtpreis. Der Betrag ist ein Vorschlag und kann geändert werden.</p>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={noShow} onChange={(e) => { setNoShow(e.target.checked); if (total !== null) setAmount(String(cancellationFee(total, arrival, todayLocal(), e.target.checked).amount / 100)); }} /> Nichtanreise (100 %)
              </label>
            </>
          )}
          {mode === "refund" && <p>Die Erstattung geht auf das Zahlungsmittel des Gastes zurück. Stripe behält seine Gebühr ein.</p>}
          <label className="block">
            <span className={labelClass}>Betrag in Euro</span>
            <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
        </div>
      </Dialog>
    </div>
  );
}
