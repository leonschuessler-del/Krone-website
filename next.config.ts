import type { NextConfig } from "next";

/**
 * Security headers applied to every response.
 * CSP is intentionally strict: no third-party scripts are loaded by default
 * (privacy by design). If Stripe.js or an analytics provider is added later,
 * extend the directives here.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // PGlite (embedded Postgres, WASM) and node-postgres must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // SQL migrations and the embedded database's WASM files are read at runtime.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**/*", "./node_modules/@electric-sql/pglite/dist/**/*"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 828, 1080, 1366, 1600, 1920, 2560],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/media/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
