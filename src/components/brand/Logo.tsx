import { cn } from "@/lib/cn";

/** Gold of the original logo (krone-landhotel.de). */
export const BRAND_GOLD = "#bc8620";

/**
 * The original logo, 1:1 as on krone-landhotel.de and the house flyer
 * (arched "Landhotel-Gasthof", crown, Fraktur "Zur Krone") – kept as the
 * original artwork in a white plaque with the thin gold frame. Nothing is
 * redrawn; a print-quality vector file from the printer replaces the raster
 * at /public/brand/logo-original.png without any code change.
 */
export function Logo({ className, plaque = true }: { tone?: "dark" | "light"; compact?: boolean; className?: string; plaque?: boolean }) {
  return (
    <span className={cn("inline-block", plaque && "border border-[#bc8620] bg-white px-2.5 py-1.5", className)} data-logo>
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed brand asset, no optimisation wanted */}
      <img src="/brand/logo-original.png" alt="Landhotel-Gasthof Zur Krone" className="block h-[2.6rem] w-auto select-none md:h-[3.1rem]" draggable={false} />
    </span>
  );
}

/** Crown only (admin, favicon-like contexts): the crown cut from the original artwork. */
export function CrownMark({ className, title }: { className?: string; title?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/crown.png" alt={title ?? ""} aria-hidden={title ? undefined : true} className={cn("h-7 w-auto", className)} />
  );
}
