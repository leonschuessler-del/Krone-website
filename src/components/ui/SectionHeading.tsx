import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SectionHeading({
  eyebrow,
  title,
  children,
  align = "left",
  tone = "light",
  id,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
  align?: "left" | "center";
  tone?: "light" | "dark";
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && (
        <p className={cn("eyebrow flex items-center gap-3", align === "center" && "justify-center", tone === "dark" && "!text-gold-light")}>
          <span className="gold-rule" aria-hidden /> {eyebrow}
        </p>
      )}
      <h2 id={id} className={cn("mt-5 text-[2.5rem] leading-[1.04] md:text-[3.5rem]", tone === "dark" ? "text-paper" : "text-ink")}>
        {title}
      </h2>
      {children && <div className={cn("mt-6 max-w-2xl text-[1.0625rem] leading-[1.75]", tone === "dark" ? "text-paper/70" : "text-ink-soft")}>{children}</div>}
    </div>
  );
}
