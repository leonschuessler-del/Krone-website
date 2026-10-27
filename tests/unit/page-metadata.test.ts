import { describe, expect, it } from "vitest";
import { pageMeta } from "@/lib/page-metadata";

describe("pageMeta", () => {
  it("builds a complete, page-specific OpenGraph set", () => {
    const m = pageMeta({ title: "Galerie", description: "Bilder", path: "/galerie" });
    expect(m.title).toBe("Galerie");
    expect(m.alternates).toEqual({ canonical: "/galerie" });
    expect(m.openGraph).toMatchObject({
      type: "website",
      locale: "de_DE",
      siteName: "Eventlocation Zur Krone Leidersbach",
      title: "Galerie · Eventlocation Zur Krone",
      description: "Bilder",
      url: "/galerie",
    });
    expect(m.openGraph?.images).toEqual([expect.objectContaining({ url: "/opengraph-image" })]);
  });

  it("keeps absolute titles and custom share data", () => {
    const m = pageMeta({ title: "Start", absolute: true, path: "/", ogTitle: "Teilen", images: ["/a.webp"] });
    expect(m.title).toEqual({ absolute: "Start" });
    expect(m.openGraph).toMatchObject({ title: "Teilen", images: ["/a.webp"] });
  });

  it("omits canonical and og:url for private, noindex pages", () => {
    const m = pageMeta({ title: "Ihre Anfrage", noindex: true, nofollow: true });
    expect(m.alternates).toBeUndefined();
    expect(m.openGraph).not.toHaveProperty("url");
    expect(m.robots).toEqual({ index: false, follow: false });
  });
});
