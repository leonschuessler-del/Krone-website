import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { siteConfig } from "@/config/site";

export interface Crumb {
  label: string;
  href?: string;
}

/** Breadcrumb navigation + BreadcrumbList structured data. */
export function Breadcrumbs({ items, tone = "light" }: { items: Crumb[]; tone?: "light" | "dark" }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: new URL(c.href, siteConfig.url).toString() } : {}),
    })),
  };
  return (
    <nav aria-label="Brotkrumen" className={tone === "dark" ? "text-paper/70" : "text-muted"}>
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {items.map((c, i) => (
          <li key={c.label} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden />}
            {c.href && i < items.length - 1 ? (
              <Link href={c.href} className={tone === "dark" ? "hover:text-paper" : "hover:text-ink"}>
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className={tone === "dark" ? "text-paper" : "text-ink"}>
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </nav>
  );
}
