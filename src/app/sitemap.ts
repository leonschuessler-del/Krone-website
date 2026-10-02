import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { spaceSeeds } from "@/content/spaces";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/$/, "");
  const now = new Date();
  const staticRoutes = ["", "/hotel", "/eventlocation", "/sehenswuerdigkeiten", "/aktuelles", "/bereiche", "/galerie", "/buchen", "/kontakt", "/faq", "/impressum", "/datenschutz", "/agb", "/mietbedingungen", "/hausordnung"];
  return [
    ...staticRoutes.map((path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : ["/hotel", "/eventlocation"].includes(path) ? 0.9 : path === "/bereiche" ? 0.7 : 0.5,
    })),
    ...spaceSeeds
      .filter((s) => s.active && s.id !== "hotel")
      .map((s) => ({ url: `${base}/bereiche/${s.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
