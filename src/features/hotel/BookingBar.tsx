"use client";

import { CalendarDays, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { addDays, todayLocal } from "@/domain/time";
import { cn } from "@/lib/cn";

/**
 * The booking bar of the luxury hotel sites: arrival, departure, guests →
 * availability. It hands the dates to the hotel booking (/hotel#buchen).
 */
export function BookingBar({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const router = useRouter();
  const today = todayLocal();
  const [arrival, setArrival] = useState(addDays(today, 7));
  const [departure, setDeparture] = useState(addDays(today, 9));
  const [guests, setGuests] = useState(2);
  const dark = tone === "dark";
  const field = cn("flex flex-1 flex-col gap-1 border-b px-4 py-3 md:border-b-0 md:border-r", dark ? "border-white/15" : "border-sand");
  const label = cn("flex items-center gap-1.5 text-[0.62rem] font-medium uppercase tracking-[0.25em]", dark ? "text-paper/60" : "text-muted");
  const input = cn("bg-transparent font-serif text-xl outline-none", dark ? "text-paper [color-scheme:dark]" : "text-ink");
  return (
    <form
      className={cn("flex flex-col md:flex-row md:items-stretch", dark ? "bg-anthracite/85 text-paper backdrop-blur-md" : "bg-white text-ink shadow-[0_30px_60px_-30px_rgb(27_24_22/0.35)]", className)}
      data-testid="booking-bar"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/hotel?anreise=${arrival}&abreise=${departure}&gaeste=${guests}#buchen`);
      }}
    >
      <label className={field}>
        <span className={label}><CalendarDays className="h-3 w-3" aria-hidden /> Anreise</span>
        <input type="date" min={today} value={arrival} onChange={(e) => { setArrival(e.target.value); if (e.target.value >= departure) setDeparture(addDays(e.target.value, 1)); }} className={input} />
      </label>
      <label className={field}>
        <span className={label}><CalendarDays className="h-3 w-3" aria-hidden /> Abreise</span>
        <input type="date" min={addDays(arrival, 1)} value={departure} onChange={(e) => setDeparture(e.target.value)} className={input} />
      </label>
      <label className={cn(field, "md:max-w-[9rem]")}>
        <span className={label}><Users className="h-3 w-3" aria-hidden /> Gäste</span>
        <select value={guests} onChange={(e) => setGuests(Number(e.target.value))} className={cn(input, "appearance-none")}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n} className="text-ink">{n}</option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="gold" size="lg" className="md:h-auto md:px-9">
        Verfügbarkeit prüfen
      </Button>
    </form>
  );
}
