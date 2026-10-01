import { cn } from "@/lib/cn";

/**
 * Brand mark of the Krone, redrawn after the lettering painted on the façade
 * (Hauptstraße 106): Fraktur "Zur Krone" with a royal crown above the "K".
 * Crown: three arches with pearls, orb with cross, jewelled band.
 * Replace with the official vector file once available.
 */
export function CrownMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 120 92" className={cn("h-7 w-auto", className)} fill="none" role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <g stroke="currentColor" strokeWidth={3.4} strokeLinejoin="round" strokeLinecap="round">
        {/* orb with cross */}
        <path d="M60 4v11M55 8.5h10" />
        <circle cx="60" cy="21" r="6" fill="currentColor" fillOpacity={0.14} />
        {/* outer arches */}
        <path d="M21 66C11 48 11 30 25 27c13-3 24 8 35 4" />
        <path d="M99 66c10-18 10-36-4-39-13-3-24 8-35 4" />
        {/* inner arches */}
        <path d="M40 63c-4-14-1-24 8-25 7-1 10 3 12-7" />
        <path d="M80 63c4-14 1-24-8-25-7-1-10 3-12-7" />
        <path d="M60 31v31" />
        {/* jewelled band */}
        <path d="M18 66c27-7 57-7 84 0l-2 12c-26-6-54-6-80 0z" fill="currentColor" fillOpacity={0.14} />
        <path d="M23 87c24-6 50-6 74 0" />
      </g>
      <g fill="currentColor">
        <circle cx="25" cy="27" r="3" />
        <circle cx="48" cy="38" r="2.6" />
        <circle cx="72" cy="38" r="2.6" />
        <circle cx="95" cy="27" r="3" />
        <ellipse cx="36" cy="71.5" rx="3" ry="2.2" />
        <ellipse cx="48" cy="70" rx="2.4" ry="2" />
        <ellipse cx="60" cy="69.5" rx="3.6" ry="2.6" />
        <ellipse cx="72" cy="70" rx="2.4" ry="2" />
        <ellipse cx="84" cy="71.5" rx="3" ry="2.2" />
      </g>
    </svg>
  );
}

export function Logo({
  tone = "dark",
  compact = false,
  className,
}: {
  tone?: "dark" | "light";
  compact?: boolean;
  className?: string;
}) {
  const ink = tone === "light" ? "text-paper" : "text-[#5e2a2e]";
  return (
    <span className={cn("inline-flex flex-col items-start leading-none", className)} aria-label="Landhotel Gasthof Zur Krone">
      <span aria-hidden="true" className={cn("relative whitespace-nowrap font-fraktur text-[1.9rem] leading-none tracking-[0.01em]", ink)} style={{ fontFamily: "var(--font-fraktur)" }}>
        Zur{" "}
        <span className="relative inline-block">
          <CrownMark className={cn("absolute bottom-[84%] left-1/2 h-[0.54em] -translate-x-1/2", tone === "light" ? "text-gold-light" : "text-[#8a6a2f]")} />K
        </span>
        rone
      </span>
      {!compact && (
        <span
          aria-hidden="true"
          className={cn("mt-1 pl-0.5 text-[0.52rem] font-semibold uppercase tracking-[0.42em]", tone === "light" ? "text-gold-light/90" : "text-gold-dark")}
        >
          Landhotel · Gasthof
        </span>
      )}
    </span>
  );
}
