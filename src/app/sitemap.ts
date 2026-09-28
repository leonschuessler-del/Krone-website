import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { spaceSeeds } from "@/content/spaces";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/$/, "");
  const now = new Date();
  const staticRoutes = ["", "/bereiche", "/galerie", "/buchen", "/kontakt", "/faq", "/impressum", "/datenschutz", "/agb", "/mietbedingungen", "/hausordnung"];
  return [
    ...staticRoutes.map((path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : path === "/bereiche" ? 0.8 : 0.5,
    })),
    ...spaceSeeds
      .filter((s) => s.active)
      .map((s) => ({ url: `${base}/bereiche/${s.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
