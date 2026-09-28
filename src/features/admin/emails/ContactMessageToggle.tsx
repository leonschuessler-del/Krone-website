"use client";

import { Check, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { adminApi } from "../api-client";

export function ContactMessageToggle({ id, handled }: { id: string; handled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const res = await adminApi(`/api/admin/contact-messages/${id}`, { method: "PATCH", body: { handled: !handled } });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    router.refresh();
  }

  return (
    <div>
      <Button size="sm" variant={handled ? "ghost" : "secondary"} onClick={toggle} disabled={busy} aria-pressed={handled}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : handled ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        {handled ? "Wieder öffnen" : "Als erledigt markieren"}
      </Button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
