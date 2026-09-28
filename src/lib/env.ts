/**
 * Typed access to environment configuration. Server-only values must never be
 * imported into client components (they are read lazily here).
 */

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export const env = {
  get demoMode(): boolean {
    return bool(process.env.DEMO_MODE ?? process.env.NEXT_PUBLIC_DEMO_MODE, true);
  },
  get databaseUrl(): string | undefined {
    return process.env.DATABASE_URL || undefined;
  },
  get authSecret(): string | undefined {
    return process.env.AUTH_SECRET || undefined;
  },
  get paymentProvider(): "demo" | "stripe" | "none" {
    const v = (process.env.PAYMENT_PROVIDER ?? "demo").toLowerCase();
    return v === "stripe" || v === "none" ? v : "demo";
  },
  get emailProvider(): "preview" | "resend" {
    return (process.env.EMAIL_PROVIDER ?? "preview").toLowerCase() === "resend" ? "resend" : "preview";
  },
  get siteUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
};
