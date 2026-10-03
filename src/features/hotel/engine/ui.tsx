"use client";

import { Check, ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Building blocks of the booking engine – the look of the big hotel booking
 * engines (pill buttons, boxed fields, dropdown controls) in the Krone palette.
 */

type PillVariant = "primary" | "dark" | "outline" | "ghost" | "gold";
const pillVariants: Record<PillVariant, string> = {
  primary: "bg-gold-dark text-paper hover:bg-ink",
  gold: "bg-gold text-ink hover:bg-gold-dark hover:text-paper",
  dark: "bg-anthracite text-paper hover:bg-gold-dark",
  outline: "border border-ink/30 bg-white text-ink hover:border-ink hover:bg-ink hover:text-paper",
  ghost: "text-ink hover:bg-ink/5",
};
const pillSizes = { sm: "h-9 px-4 text-[0.66rem]", md: "h-11 px-6 text-[0.7rem]", lg: "h-12 px-8 text-[0.72rem]" };

export function Pill({ variant = "primary", size = "md", className, children, type = "button", ...props }: { variant?: PillVariant; size?: keyof typeof pillSizes } & ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium uppercase tracking-[0.18em] transition-[background-color,color,border-color,transform,box-shadow] duration-200 ease-[var(--ease-out-soft)] hover:shadow-[0_10px_24px_-12px_rgb(27_24_22/0.45)] active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
        pillVariants[variant],
        pillSizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Underlined text action like "BEARBEITEN · ENTFERNEN" / "LÖSCHEN". */
export function TextAction({ className, children, type = "button", ...props }: ComponentProps<"button">) {
  return (
    <button type={type} className={cn("text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-gold-dark underline-offset-4 hover:text-ink hover:underline disabled:opacity-40", className)} {...props}>
      {children}
    </button>
  );
}

/** Dropdown control "Sortieren nach: Niedrigster Preis ▾" with a floating menu. */
export function Dropdown({ label, value, open, onToggle, children, className, testId }: { label: string; value?: string; open: boolean; onToggle: () => void; children: ReactNode; className?: string; testId?: string }) {
  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="true"
        data-testid={testId}
        className={cn("flex h-11 items-center gap-2 border bg-white px-4 text-sm text-ink-soft transition-colors hover:border-ink/40", open ? "border-ink" : "border-sand")}
      >
        <span>
          {label}
          {value ? <span className="text-ink">: {value}</span> : null}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-gold-dark transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && <div className="absolute left-0 top-[calc(100%+4px)] z-30 min-w-[14rem] border border-sand bg-white py-1 shadow-[var(--shadow-lift)]">{children}</div>}
    </div>
  );
}

export function MenuItem({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={active} onClick={onClick} className={cn("flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-cream", active ? "bg-cream font-semibold text-ink" : "text-ink-soft")}>
      {children}
      {active && <Check className="h-4 w-4 text-gold-dark" aria-hidden />}
    </button>
  );
}

/** Boxed search field: icon, small label, value – the three fields of the search bar. */
export function FieldBox({ icon, label, value, active, onClick, testId }: { icon: ReactNode; label: string; value: string; active?: boolean; onClick: () => void; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      data-testid={testId}
      className={cn("flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-cream/70", active ? "bg-cream/80 ring-1 ring-inset ring-gold" : "")}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center text-gold-dark">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[0.62rem] font-medium uppercase tracking-[0.22em] text-muted">{label}</span>
        <span className="block truncate font-serif text-[1.15rem] leading-tight text-ink">{value}</span>
      </span>
    </button>
  );
}

/** Text input with the label inside the box (the engine's form look). */
export function TextField({ label, required, className, id, hint, ...props }: { label: string; hint?: string } & ComponentProps<"input">) {
  const inputId = id ?? `f-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <label htmlFor={inputId} className={cn("block", className)}>
      <span className="relative block border border-stone bg-white focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/25">
        <span className="pointer-events-none absolute left-3 top-1.5 text-[0.62rem] font-medium uppercase tracking-[0.18em] text-muted">
          {label}
          {required && <span className="text-danger"> *</span>}
        </span>
        <input id={inputId} required={required} className="h-14 w-full bg-transparent px-3 pb-1.5 pt-5 text-[0.95rem] text-ink outline-none placeholder:text-stone" {...props} />
      </span>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function CheckRow({ checked, onChange, children, testId }: { checked: boolean; onChange: () => void; children: ReactNode; testId?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1.5 text-sm text-ink-soft hover:text-ink">
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" data-testid={testId} />
      <span className={cn("grid h-5 w-5 shrink-0 place-items-center border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-gold", checked ? "border-gold-dark bg-gold-dark text-paper" : "border-stone bg-white")} aria-hidden>
        {checked && <Check className="h-3.5 w-3.5" />}
      </span>
      {children}
    </label>
  );
}

export function RadioRow({ checked, onChange, children, name }: { checked: boolean; onChange: () => void; children: ReactNode; name: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1.5 text-sm text-ink-soft hover:text-ink">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="peer sr-only" />
      <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-gold", checked ? "border-gold-dark" : "border-stone bg-white")} aria-hidden>
        {checked && <span className="h-2.5 w-2.5 rounded-full bg-gold-dark" />}
      </span>
      {children}
    </label>
  );
}

/** − n + counter used for guests and extras. */
export function Stepper({ value, min = 0, max = 99, onChange, label, size = "md" }: { value: number; min?: number; max?: number; onChange: (n: number) => void; label: string; size?: "sm" | "md" }) {
  const btn = cn("grid shrink-0 place-items-center rounded-full border border-stone bg-white text-ink transition-colors hover:border-ink disabled:opacity-30 disabled:hover:border-stone", size === "md" ? "h-10 w-10" : "h-8 w-8");
  return (
    <span className="inline-flex items-center gap-3" role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`${label} weniger`}>
        −
      </button>
      <span className={cn("min-w-[1.5ch] text-center font-serif tabular-nums", size === "md" ? "text-2xl" : "text-lg")} aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`${label} mehr`}>
        +
      </button>
    </span>
  );
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
