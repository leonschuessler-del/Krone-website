import { Car, Plane, Route, TrainFront, type LucideIcon } from "lucide-react";
import { arrival } from "@/content/sights";
import { cn } from "@/lib/cn";

const ARRIVAL_ICON: Record<string, LucideIcon> = {
  "a3-frankfurt": Route,
  "a3-wuerzburg": Route,
  airport: Plane,
  rail: TrainFront,
  parking: Car,
};

/** "So kommen Sie zu uns": the arrival facts from content/sights as one grid, a gold glyph per row. */
export function ArrivalGrid({ className }: { className?: string }) {
  return (
    <dl className={cn("grid gap-px overflow-hidden border border-sand bg-sand sm:grid-cols-2", className)}>
      {arrival.map((a) => {
        const Icon = ARRIVAL_ICON[a.id] ?? Route;
        return (
          <div key={a.id} className="bg-white p-6">
            <dt className="flex items-center gap-2 text-[0.65rem] font-medium uppercase tracking-[0.25em] text-gold-dark">
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
              {a.label}
            </dt>
            <dd className="mt-2 text-sm leading-relaxed text-ink-soft">{a.text}</dd>
          </div>
        );
      })}
    </dl>
  );
}
