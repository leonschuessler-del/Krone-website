import { Plus } from "lucide-react";
import type { FaqItem } from "@/content/faq";

/** FAQ accordion using native <details> – works without JavaScript. */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-sand border-y border-sand">
      {items.map((item) => (
        <details key={item.id} className="group py-1" name="faq">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 font-serif text-xl text-ink marker:hidden md:text-2xl [&::-webkit-details-marker]:hidden">
            {item.question}
            <Plus className="h-5 w-5 shrink-0 text-gold-dark transition-transform duration-300 group-open:rotate-45" aria-hidden />
          </summary>
          <div className="max-w-3xl pb-6 text-[1.02rem] leading-relaxed text-ink-soft">
            <p>{item.answer}</p>
            {item.needsVerification && <p className="mt-2 text-xs uppercase tracking-wider text-muted">Details folgen</p>}
          </div>
        </details>
      ))}
    </div>
  );
}
