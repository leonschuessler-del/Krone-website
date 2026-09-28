/**
 * npm run db:seed
 *
 * Seeds base data (spaces, extras without prices, settings) and – when
 * DEMO_MODE=true – the clearly flagged demo data. Idempotent: running it
 * again only adds what is missing (demo availability blocks are created once).
 * Creates the first admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD when no
 * admin exists yet.
 */
import { describeTarget, guardEmbeddedDb, loadEnv, parseArgs, runIdempotentSeed } from "../src/server/services/admin-cli";

async function main() {
  await loadEnv();
  const { flags } = parseArgs();
  await guardEmbeddedDb(flags.has("force"));
  const { closeDb } = await import("../src/server/db/client");
  const { env } = await import("../src/lib/env");

  console.info(`→ Seed: ${describeTarget()} (DEMO_MODE=${env.demoMode ? "true" : "false"})`);
  try {
    const { demoCreated } = await runIdempotentSeed(env.demoMode);
    if (env.demoMode) console.info(demoCreated ? "  Demo-Daten angelegt." : "  Demo-Daten sind vorhanden (nicht erneut angelegt).");
    console.info("✔ Seed abgeschlossen.");
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  const cause = (err as { cause?: { message?: string } })?.cause?.message;
  const msg = err instanceof Error ? (err.message.split("\n")[0] ?? "") : String(err);
  console.error("✖ Seed fehlgeschlagen:", cause ?? msg);
  if (/relation .* does not exist/i.test(cause ?? msg)) console.error("  Tipp: zuerst `npm run db:migrate` ausführen.");
  process.exit(1);
});
