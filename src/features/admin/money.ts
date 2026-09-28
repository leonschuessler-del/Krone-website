/**
 * Euro input helpers for admin forms. Money is stored in integer cents;
 * an EMPTY input means "unknown" (null) – never 0.
 */

export function centsToEuroInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const euros = cents / 100;
  return Number.isInteger(euros) ? String(euros) : euros.toFixed(2).replace(".", ",");
}

/** Accepts "120", "120,5", "1.200,00", "1200.50", "120 €". */
export function parseEuroInput(value: string): { ok: true; cents: number | null } | { ok: false; error: string } {
  const raw = value.replace(/€|eur/gi, "").replace(/\s/g, "");
  if (raw === "") return { ok: true, cents: null };
  let normalized = raw;
  if (raw.includes(",")) normalized = raw.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) normalized = raw.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return { ok: false, error: "Bitte Betrag in Euro angeben, z. B. 120 oder 89,50" };
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isFinite(cents) || cents > 100_000_000) return { ok: false, error: "Betrag zu groß" };
  return { ok: true, cents };
}

export function parseIntInput(value: string, options: { min?: number; max?: number } = {}): { ok: true; value: number | null } | { ok: false; error: string } {
  const raw = value.trim();
  if (raw === "") return { ok: true, value: null };
  if (!/^-?\d+$/.test(raw)) return { ok: false, error: "Bitte ganze Zahl eingeben" };
  const n = Number(raw);
  if (options.min !== undefined && n < options.min) return { ok: false, error: `Mindestens ${options.min}` };
  if (options.max !== undefined && n > options.max) return { ok: false, error: `Höchstens ${options.max}` };
  return { ok: true, value: n };
}
