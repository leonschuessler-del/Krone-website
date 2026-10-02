import { useId } from "react";
import { cn } from "@/lib/cn";

/** Gold of the original logo (krone-landhotel.de). */
export const BRAND_GOLD = "#bc8620";
const LIGHT_GOLD = "#d8bb7e";

/**
 * Crown of the original logo: orb with cross, five round lobes, band and ring.
 * Fine cut lines are a mask, so the mark works on any background.
 */
function CrownShape({ maskId }: { maskId: string }) {
  return (
    <>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="90" y="50" width="120" height="110">
          <rect x="90" y="50" width="120" height="110" fill="#fff" />
          <g fill="none" stroke="#000" strokeWidth={2} strokeLinecap="round">
            <path d="M114 134 Q150 126 186 134" />
            <path d="M124.5 126 Q123 118 122 113" />
            <path d="M175.5 126 Q177 118 178 113" />
            <path d="M141 125 Q140.5 115 140.5 108" />
            <path d="M159 125 Q159.5 115 159.5 108" />
          </g>
          <ellipse cx="150" cy="148.6" rx="23" ry="4" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        <path d="M148.3 62h3.4v5h4.4v3.2h-4.4v5.3h-3.4v-5.3h-4.4v-3.2h4.4z" />
        <circle cx="150" cy="81" r="6" />
        <ellipse cx="150" cy="99.5" rx="8.6" ry="12" />
        <circle cx="133" cy="104" r="9" />
        <circle cx="167" cy="104" r="9" />
        <circle cx="116.5" cy="110" r="10.5" />
        <circle cx="183.5" cy="110" r="10.5" />
        <path d="M107 112 Q110 122 113 128 L187 128 Q190 122 193 112 Q170 116 150 116 Q130 116 107 112z" />
        <path d="M111 127q39-7 78 0l-1.6 14.5q-37.4-6.5-74.8 0z" />
        <ellipse cx="150" cy="148" rx="34.5" ry="8.2" />
      </g>
    </>
  );
}

/** The crown alone (favicon-like contexts, admin). */
export function CrownMark({ className, title }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="100 58 100 100" className={cn("h-7 w-auto", className)} fill="currentColor" role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <CrownShape maskId={`crown-${id}`} />
    </svg>
  );
}

/**
 * Logo as on krone-landhotel.de: arched "Landhotel-Gasthof", the crown and the
 * Fraktur "Zur Krone" – redrawn as a vector so it stays sharp at every size.
 */
export function Logo({ tone = "dark", className }: { tone?: "dark" | "light"; compact?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 300 222"
      role="img"
      aria-label="Landhotel-Gasthof Zur Krone"
      className={cn("block h-[3.65rem] w-auto", className)}
      style={{ color: tone === "light" ? LIGHT_GOLD : BRAND_GOLD }}
      fill="currentColor"
    >
      <defs>
        <path id={`arc-${id}`} d="M 14 54 Q 150 -4 286 54" />
      </defs>
      <text fontSize={31} stroke="currentColor" strokeWidth={1.25} textAnchor="middle" style={{ fontFamily: "var(--font-goudy), Georgia, serif" }}>
        <textPath href={`#arc-${id}`} startOffset="50%">
          Landhotel-Gasthof
        </textPath>
      </text>
      {/* crown sits clearly above the lettering (the K must not touch the ring) */}
      <g transform="translate(0 -18) scale(0.96) translate(6 0)">
        <CrownShape maskId={`crown-${id}`} />
      </g>
      <text
        x={150}
        y={214}
        fontSize={78}
        textAnchor="middle"
        stroke="currentColor"
        strokeWidth={2}
        transform="translate(150 0) scale(0.78 1) translate(-150 0)"
        style={{ fontFamily: "var(--font-fraktur), Georgia, serif" }}
      >
        Zur Krone
      </text>
    </svg>
  );
}
