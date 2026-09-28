"use client";

import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { useBookingStore } from "@/store/booking-store";

/** Adds/removes a space to/from the global booking selection. */
export function SelectSpaceButton({ spaceId, name, className, size = "md" }: { spaceId: string; name: string; className?: string; size?: "md" | "lg" }) {
  const selected = useBookingStore((s) => s.selectedSpaceIds.includes(spaceId));
  const toggle = useBookingStore((s) => s.toggleSpace);
  return (
    <button
      type="button"
      onClick={() => toggle(spaceId)}
      aria-pressed={selected}
      aria-label={selected ? `${name} aus der Auswahl entfernen` : `${name} auswählen`}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-colors",
        size === "lg" ? "h-13 px-7 text-base" : "h-10 px-4 text-sm",
        selected ? "bg-ink text-paper hover:bg-ink-soft" : "bg-gold text-anthracite hover:bg-gold-light",
        className,
      )}
    >
      {selected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      {selected ? "Ausgewählt" : size === "lg" ? `${name} auswählen` : "Auswählen"}
    </button>
  );
}
