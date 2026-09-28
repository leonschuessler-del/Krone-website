import { renderBaseMapSvg } from "@/features/map/render-base-map";

// Rendered once at build time and served as a static, cacheable file.
export const dynamic = "force-static";

export function GET() {
  return new Response(renderBaseMapSvg(), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
