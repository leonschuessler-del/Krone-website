"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Accessible modal based on the native <dialog> element
 * (focus handling, Esc to close, inert background). Renders as a centered
 * panel on desktop and as a bottom sheet on small screens.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "lg",
  tone = "light",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
  tone?: "light" | "dark";
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-3xl p-0 shadow-lift backdrop:bg-anthracite/55 backdrop:backdrop-blur-[2px]",
        tone === "dark" ? "panel-dark text-paper" : "bg-paper text-ink",
        "sm:m-auto sm:rounded-3xl",
        size === "md" && "sm:max-w-lg",
        size === "lg" && "sm:max-w-3xl",
        size === "xl" && "sm:max-w-5xl",
        "open:animate-[fade-up_0.28s_var(--ease-out-soft)]",
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <header className={cn("flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-7 sm:py-5", tone === "dark" ? "border-white/10" : "border-sand")}>
            <div>
              <h2 id="dialog-title" className="font-serif text-2xl leading-tight">
                {title}
              </h2>
              {description && <p className={cn("mt-1 text-sm", tone === "dark" ? "text-paper/60" : "text-muted")}>{description}</p>}
            </div>
            <button type="button" onClick={onClose} className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", tone === "dark" ? "hover:bg-white/10" : "hover:bg-cream")} aria-label="Schließen">
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">{children}</div>
          {footer && <footer className="border-t border-sand bg-white/60 px-5 py-4 sm:px-7">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
