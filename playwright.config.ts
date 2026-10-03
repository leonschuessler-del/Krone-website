import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against a production build with a fresh in-memory demo
 * database (PGlite), so they never touch local development data.
 *   npm run test:e2e
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    // E2E_SKIP_BUILD=1 reuses the existing .next build (local runs after `next build`)
    command: process.env.E2E_SKIP_BUILD ? `npx next start -p ${PORT}` : `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 600_000,
    reuseExistingServer: false,
    env: {
      PGLITE_IN_MEMORY: "1",
      DEMO_MODE: "true",
      PAYMENT_PROVIDER: "demo",
      EMAIL_PROVIDER: "preview",
      RATE_LIMIT_DISABLED: "1",
      AUTH_SECRET: "e2e-only-secret-0123456789abcdef0123456789abcdef",
      SEED_ADMIN_EMAIL: "admin@krone.local",
      SEED_ADMIN_PASSWORD: "krone-e2e-password",
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
    },
  },
});
