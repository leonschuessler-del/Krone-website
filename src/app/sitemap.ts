import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { spaceSeeds } from "@/content/spaces";

/**
 * Event-only scope (10/2026): public event routes only. Archived pages (hotel,
 * offers, sights – see ARCHIV.md) and redirects (/eventlocation, /bereiche/hotel)
 * are not listed; /buchen and /buchung are excluded by robots.ts.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/$/, "");
  const now = new Date();
  const staticRoutes = ["", "/bereiche", "/galerie", "/kontakt", "/faq", "/impressum", "/datenschutz", "/agb", "/mietbedingungen", "/hausordnung"];
  return [
    ...staticRoutes.map((path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : path === "/bereiche" ? 0.8 : ["/galerie", "/kontakt", "/faq"].includes(path) ? 0.6 : 0.3,
    })),
    ...spaceSeeds
      .filter((s) => s.active && s.id !== "hotel")
      .map((s) => ({ url: `${base}/bereiche/${s.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
