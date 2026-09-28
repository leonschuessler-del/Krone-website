import type { ReactNode } from "react";
import { BOOKING_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/domain/booking";
import type { BookingStatus, PaymentStatus } from "@/domain/types";
import { cn } from "@/lib/cn";
import { BOOKING_STATUS_TONE, PAYMENT_STATUS_TONE, type Tone } from "./labels";

/**
 * Presentational building blocks of the admin (no client hooks – usable in
 * server and client components).
 */

export const inputClass =
  "w-full rounded-lg border border-stone bg-white px-3 py-2 text-[0.95rem] text-ink shadow-[inset_0_1px_1px_rgb(35_30_27/0.04)] " +
  "transition-[border-color,box-shadow] duration-150 placeholder:text-taupe focus:border-gold focus:outline-none focus:ring-3 focus:ring-gold/20 " +
  "disabled:bg-cream/60 disabled:text-muted aria-[invalid=true]:border-danger";

export const labelClass = "mb-1 block text-[0.8rem] font-semibold text-ink-soft";
export const hintClass = "mt-1 text-xs text-muted";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-1.5 font-serif text-[2rem] leading-tight text-ink lining-nums md:text-[2.35rem]">{title}</h1>
        {description && <div className="mt-2 max-w-3xl text-[0.95rem] text-muted">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("card-surface overflow-hidden", className)}>
      {(title || actions) && (
        <div className="flex flex-col gap-3 border-b border-sand/70 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="font-serif text-[1.35rem] leading-tight text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("px-5 py-4", bodyClassName)}>{children}</div>
    </section>
  );
}

const TONES: Record<Tone, string> = {
  neutral: "bg-sand/60 text-ink-soft ring-stone/60",
  gold: "bg-gold-pale text-gold-dark ring-gold/35",
  success: "bg-success-pale text-success ring-success/25",
  warning: "bg-warning-pale text-warning ring-warning/30",
  danger: "bg-danger-pale text-danger ring-danger/25",
  info: "bg-[#e3eaf1] text-[#3c5a78] ring-[#4f6d8a]/25",
  dark: "bg-ink text-paper ring-ink",
};

export function Badge({ tone = "neutral", children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", TONES[tone], className)}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge tone={BOOKING_STATUS_TONE[status]} className="status-badge">
      {BOOKING_STATUS_LABEL[status]}
    </Badge>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT_STATUS_TONE[status]}>{PAYMENT_STATUS_LABEL[status]}</Badge>;
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge tone="warning" className={cn("uppercase tracking-wider", className)} title="Demo-Datensatz">
      Demo
    </Badge>
  );
}

export function SpaceDot({ color, className, title }: { color: string; className?: string; title?: string }) {
  return <span title={title} aria-hidden={title ? undefined : true} className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white", className)} style={{ background: color }} />;
}

export function SpaceChips({ spaces, compact = false }: { spaces: Array<{ spaceId: string; name: string; code: string; color: string }>; compact?: boolean }) {
  if (spaces.length === 0) return <span className="text-muted">–</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {spaces.map((s) => (
        <li key={s.spaceId} className="inline-flex items-center gap-1.5 rounded-full bg-cream px-2 py-0.5 text-xs font-semibold text-ink-soft" title={s.name}>
          <SpaceDot color={s.color} className="ring-0" />
          {compact ? s.code : s.name}
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="text-gold">{icon}</div>}
      <p className="font-serif text-xl text-ink">{title}</p>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function KpiCard({ label, value, hint, href, tone = "neutral", icon }: { label: string; value: number | string; hint?: string; href?: string; tone?: Tone; icon?: ReactNode }) {
  const accent: Record<Tone, string> = {
    neutral: "from-stone/50",
    gold: "from-gold/60",
    success: "from-success/50",
    warning: "from-warning/55",
    danger: "from-danger/50",
    info: "from-[#4f6d8a]/50",
    dark: "from-ink/50",
  };
  const body = (
    <div className="card-surface group relative h-full overflow-hidden p-5 transition-shadow hover:shadow-lift">
      <span className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r to-transparent", accent[tone])} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
        {icon && <span className="text-gold">{icon}</span>}
      </div>
      <p className="mt-3 font-serif text-[2.6rem] font-semibold leading-none text-ink lining-nums tabular-nums">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  );
  return href ? (
    <a href={href} className="block h-full rounded-[var(--radius-card)]">
      {body}
    </a>
  ) : (
    body
  );
}

export function DataList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("grid gap-x-6 gap-y-3.5 sm:grid-cols-2", className)}>{children}</dl>;
}

export function DataItem({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="mt-0.5 text-[0.95rem] text-ink">{children}</dd>
    </div>
  );
}

export function Notice({ tone = "warning", children, className }: { tone?: "warning" | "info" | "danger" | "success"; children: ReactNode; className?: string }) {
  const styles = {
    warning: "border-warning/30 bg-warning-pale text-[#5d4413]",
    info: "border-[#4f6d8a]/25 bg-[#eef2f6] text-[#2f4a63]",
    danger: "border-danger/30 bg-danger-pale text-danger",
    success: "border-success/30 bg-success-pale text-success",
  } as const;
  return <div className={cn("rounded-xl border px-4 py-3 text-sm", styles[tone], className)}>{children}</div>;
}

export const tableClass = "w-full border-collapse text-left text-sm";
export const thClass = "whitespace-nowrap border-b border-sand px-3 py-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted first:pl-5 last:pr-5";
export const tdClass = "border-b border-sand/60 px-3 py-3 align-top first:pl-5 last:pr-5";
