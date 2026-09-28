import {
  BedDouble,
  ChefHat,
  DoorOpen,
  ImageIcon,
  Landmark,
  Sprout,
  Theater,
  TreeDeciduous,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

const ICONS: Record<string, LucideIcon> = {
  restaurant: UtensilsCrossed,
  kitchen: ChefHat,
  "side-room": DoorOpen,
  stage: Theater,
  "old-tavern": Landmark,
  "winter-garden": Sprout,
  "beer-garden": TreeDeciduous,
  hotel: BedDouble,
};

/**
 * Neutral, high-quality placeholder for missing photos. Deliberately NOT a
 * fake photo – it is clearly recognisable as "image follows".
 */
export function MediaPlaceholder({
  spaceId,
  code,
  color = "#b8904a",
  label = "Bildmaterial folgt",
  className,
  size = "md",
}: {
  spaceId?: string;
  code?: string;
  color?: string;
  label?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = (spaceId && ICONS[spaceId]) || ImageIcon;
  return (
    <div
      role="img"
      aria-label={label ?? "Platzhalter"}
      className={cn("relative isolate flex h-full w-full items-center justify-center overflow-hidden", className)}
      style={{
        background: `radial-gradient(120% 90% at 20% 10%, color-mix(in oklab, ${color} 16%, #fbf8f2) 0%, #f1ebdf 55%, #e7dece 100%)`,
      }}
    >
      <svg className="absolute inset-0 h-full w-full opacity-[0.35]" aria-hidden="true">
        <defs>
          <pattern id={`ph-${spaceId ?? "x"}`} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="22" stroke={color} strokeOpacity="0.18" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#ph-${spaceId ?? "x"})`} />
      </svg>
      {code && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute -bottom-6 -right-2 font-serif font-semibold leading-none opacity-[0.09]",
            size === "sm" ? "text-[6rem]" : size === "lg" ? "text-[16rem]" : "text-[10rem]",
          )}
          style={{ color }}
        >
          {code}
        </span>
      )}
      <div className="relative flex flex-col items-center gap-3 text-center">
        <span
          className={cn(
            "grid place-items-center rounded-full border bg-white/60 backdrop-blur-sm",
            size === "sm" ? "h-11 w-11" : size === "lg" ? "h-20 w-20" : "h-14 w-14",
          )}
          style={{ borderColor: `color-mix(in oklab, ${color} 45%, transparent)`, color }}
        >
          <Icon className={size === "sm" ? "h-5 w-5" : size === "lg" ? "h-9 w-9" : "h-6 w-6"} strokeWidth={1.4} />
        </span>
        {label && (
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted">{label}</span>
        )}
      </div>
    </div>
  );
}
