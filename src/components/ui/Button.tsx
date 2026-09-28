import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "gold" | "secondary" | "ghost" | "dark" | "light" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-[0.01em] whitespace-nowrap " +
  "transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-[var(--ease-out-soft)] " +
  "disabled:pointer-events-none disabled:opacity-45 active:translate-y-px select-none";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-soft shadow-[0_6px_18px_-8px_rgb(35_30_27/0.6)]",
  gold:
    "bg-gradient-to-b from-[#d4b06a] to-[#b8904a] text-anthracite hover:from-[#dcbb78] hover:to-[#c29a53] " +
    "shadow-[0_8px_20px_-10px_rgb(138_106_47/0.9),inset_0_1px_0_rgb(255_255_255/0.35)]",
  secondary: "border border-ink/20 bg-white/70 text-ink hover:border-ink/40 hover:bg-white",
  ghost: "text-ink hover:bg-ink/5",
  dark: "border border-white/15 bg-white/5 text-paper hover:bg-white/12 hover:border-white/30",
  light: "bg-paper text-ink hover:bg-white shadow-soft",
  danger: "border border-danger/30 bg-danger-pale text-danger hover:border-danger/60",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-13 px-7 text-base",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  type = "button",
  ...props
}: CommonProps & ComponentProps<"button">) {
  return (
    <button type={type} className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  href,
  ...props
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </Link>
  );
}
