"use client";

import { Loader2, LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { adminApi } from "./api-client";
import { inputClass, labelClass } from "./ui";

export function LoginForm({ next, disabled = false }: { next: string; disabled?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!email.trim() || !password) {
      setError("Bitte E-Mail-Adresse und Passwort eingeben.");
      return;
    }
    setBusy(true);
    const res = await adminApi("/api/admin/login", { method: "POST", body: { email, password } });
    if (res.ok) {
      window.location.assign(next);
      return;
    }
    setBusy(false);
    setPassword("");
    setError(res.message);
  }

  return (
    // method=post: even a submit before hydration never puts the password into the URL
    <form onSubmit={onSubmit} method="post" action="/api/admin/login" className="mt-6 space-y-4" noValidate>
      <div>
        <label htmlFor="login-email" className={labelClass}>
          E-Mail-Adresse
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div>
        <label htmlFor="login-password" className={labelClass}>
          Passwort
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger-pale px-3 py-2 text-sm text-danger" role="alert" data-testid="login-error">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" className="w-full" disabled={busy || disabled}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        Anmelden
      </Button>
    </form>
  );
}
