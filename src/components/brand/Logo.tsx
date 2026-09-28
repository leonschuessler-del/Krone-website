import { cn } from "@/lib/cn";

/**
 * Typographic word mark with a crown signet.
 * Placeholder until the official logo file is provided
 * (drop it into /public/media/brand/logo.svg and swap this component).
 */
export function CrownMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 44" aria-hidden="true" className={cn("h-7 w-auto", className)} fill="none">
      <path
        d="M6 34 3 12l14 10L32 4l15 18 14-10-3 22z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M8 39h48" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="3" cy="11" r="2.4" fill="currentColor" />
      <circle cx="32" cy="3.4" r="2.6" fill="currentColor" />
      <circle cx="61" cy="11" r="2.4" fill="currentColor" />
      <circle cx="17.5" cy="28" r="1.6" fill="currentColor" />
      <circle cx="32" cy="27" r="2" fill="currentColor" />
      <circle cx="46.5" cy="28" r="1.6" fill="currentColor" />
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
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <CrownMark className={cn("h-7 shrink-0", tone === "light" ? "text-gold-light" : "text-gold")} />
      <span className="flex flex-col leading-none">
        {!compact && (
          <span
            className={cn(
              "mb-1 text-[0.58rem] font-semibold uppercase tracking-[0.32em]",
              tone === "light" ? "text-gold-light/90" : "text-gold-dark",
            )}
          >
            Landhotel · Gasthof
          </span>
        )}
        <span
          className={cn(
            "font-serif text-[1.35rem] font-semibold uppercase tracking-[0.2em]",
            tone === "light" ? "text-paper" : "text-ink",
          )}
        >
          Zur Krone
        </span>
      </span>
    </span>
  );
}
