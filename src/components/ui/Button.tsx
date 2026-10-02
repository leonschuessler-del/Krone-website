import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "gold" | "secondary" | "ghost" | "dark" | "light" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-none btn-lux whitespace-nowrap " +
  "transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-[var(--ease-out-soft)] " +
  "disabled:pointer-events-none disabled:opacity-45 active:translate-y-px select-none";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-gold-dark",
  gold: "bg-gold text-paper hover:bg-gold-dark",
  secondary: "border border-ink/35 bg-transparent text-ink hover:border-ink hover:bg-ink hover:text-paper",
  ghost: "text-ink hover:bg-ink/5",
  dark: "border border-paper/45 bg-transparent text-paper hover:bg-paper hover:text-ink",
  light: "bg-paper text-ink hover:bg-white",
  danger: "border border-danger/30 bg-danger-pale text-danger hover:border-danger/60",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4",
  md: "h-12 px-6",
  lg: "h-14 px-8",
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
