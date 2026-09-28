import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { LoginForm } from "@/features/admin/LoginForm";
import { env } from "@/lib/env";
import { getAdminSession } from "@/server/auth/admin-session";
import { getSessionKey, safeAdminRedirect } from "@/server/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Anmeldung" };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string; abgemeldet?: string }> }) {
  const sp = await searchParams;
  const next = safeAdminRedirect(sp.next);
  const admin = await getAdminSession();
  if (admin) redirect(next);
  const configured = getSessionKey() !== null;

  return (
    <div className="panel-dark relative grid min-h-dvh place-items-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #d8bb7e 1px, transparent 0)", backgroundSize: "28px 28px" }}
      />
      <div className="relative w-full max-w-[26rem]">
        <div className="mb-8 flex justify-center">
          <Logo tone="light" />
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-paper p-7 text-ink shadow-lift sm:p-9">
          <p className="eyebrow">Interner Bereich</p>
          <h1 className="mt-2 font-serif text-3xl">Anmeldung Verwaltung</h1>
          <p className="mt-2 text-sm text-muted">Bitte melden Sie sich mit Ihrer E-Mail-Adresse und Ihrem Passwort an.</p>
          {sp.abgemeldet && (
            <p className="mt-4 rounded-lg border border-success/25 bg-success-pale px-3 py-2 text-sm text-success" role="status">
              Sie wurden erfolgreich abgemeldet.
            </p>
          )}
          {!configured && (
            <p className="mt-4 rounded-lg border border-danger/30 bg-danger-pale px-3 py-2 text-sm text-danger" role="alert">
              Die Anmeldung ist deaktiviert: Auf dem Server ist kein AUTH_SECRET konfiguriert.
            </p>
          )}
          <LoginForm next={next} disabled={!configured} />
        </div>
        {env.demoMode && <p className="mt-6 text-center text-xs uppercase tracking-[0.2em] text-gold-light/70">DEMO-Modus aktiv</p>}
      </div>
    </div>
  );
}
