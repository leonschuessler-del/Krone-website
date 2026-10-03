import { useId } from "react";
import { cn } from "@/lib/cn";
import { LOGO_MARK_PATH } from "./logo-path";

/** Gold of the original logo (krone-landhotel.de). */
export const BRAND_GOLD = "#bc8620";

/**
 * The original logo as a vector: crown and the Fraktur „Zur Krone“ are traced
 * from the house's own artwork (flyer / krone-landhotel.de), the arched
 * „Landhotel-Gasthof“ is set in the logo's Goudy typeface so it stays sharp at
 * every size. Shown in the white plaque with the thin gold frame, as on the
 * old website.
 */
export function Logo({ className, plaque = true }: { tone?: "dark" | "light"; compact?: boolean; className?: string; plaque?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <span className={cn("inline-block", plaque && "border border-[#bc8620] bg-white px-2.5 py-1.5", className)} data-logo>
      <svg viewBox="60 20 3130 2010" role="img" aria-label="Landhotel-Gasthof Zur Krone" className="block h-[2.6rem] w-auto select-none md:h-[3.1rem]" fill={BRAND_GOLD}>
        <defs>
          <path id={`arc-${id}`} d="M 290 760 Q 1625 60 2960 760" />
        </defs>
        <text fontSize={300} textAnchor="middle" style={{ fontFamily: "var(--font-goudy), 'Sorts Mill Goudy', Georgia, serif" }} letterSpacing={2}>
          <textPath href={`#arc-${id}`} startOffset="50%">
            Landhotel-Gasthof
          </textPath>
        </text>
        <path d={LOGO_MARK_PATH} fillRule="evenodd" />
      </svg>
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
