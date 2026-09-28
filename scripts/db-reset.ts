/**
 * npm run db:reset
 *
 * ⚠ Deletes ALL data and rebuilds the database (migrate + seed).
 *  - embedded PGlite: deletes ./.data/pglite (or PGLITE_DATA_DIR) and recreates it
 *  - PostgreSQL:      requires `--force`; drops and recreates the `public` schema
 *                     (plus drizzle's migration journal) – never run against production data!
 */
import fs from "node:fs";
import path from "node:path";
import { describeTarget, embeddedDbDir, guardEmbeddedDb, loadEnv, parseArgs, runIdempotentSeed } from "../src/server/services/admin-cli";

async function main() {
  await loadEnv();
  const { flags } = parseArgs();
  const force = flags.has("force");
  console.info(`→ Datenbank zurücksetzen: ${describeTarget()}`);

  const url = process.env.DATABASE_URL;
  if (!url) {
    await guardEmbeddedDb(force);
    const dir = embeddedDbDir()!;
    const cwd = path.resolve(process.cwd());
    if (dir === path.parse(dir).root || dir === cwd || (!dir.startsWith(cwd) && !process.env.PGLITE_DATA_DIR)) {
      throw new Error(`Unsicherer Datenbankpfad: ${dir}`);
    }
    fs.rmSync(dir, { recursive: true, force: true });
    const rel = path.relative(cwd, dir);
    console.info(`  ${rel && !rel.startsWith("..") ? rel : dir} gelöscht.`);
    // getDb() migrates the fresh embedded database and seeds it (DEMO_MODE decides about demo data)
    const { getDb, closeDb } = await import("../src/server/db/client");
    await getDb();
    await closeDb();
  } else {
    if (!force) {
      console.error("✖ Für PostgreSQL ist `--force` erforderlich (npm run db:reset -- --force). ALLE Daten werden gelöscht!");
      process.exit(1);
    }
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const { MIGRATIONS_FOLDER } = await import("../src/server/db/client");
    const pool = new Pool({ connectionString: url, max: 1, ssl: /sslmode=require|neon\.tech|supabase/.test(url) ? { rejectUnauthorized: false } : undefined });
    try {
      await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
      await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
      await pool.query("CREATE SCHEMA public");
      console.info("  Schema public neu angelegt.");
      await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
      console.info("  Migrationen angewendet.");
    } finally {
      await pool.end();
    }
    const { closeDb } = await import("../src/server/db/client");
    const { env } = await import("../src/lib/env");
    try {
      await runIdempotentSeed(env.demoMode);
    } finally {
      await closeDb();
    }
  }
  console.info("✔ Datenbank zurückgesetzt, migriert und befüllt.");
}

main().catch((err) => {
  const cause = (err as { cause?: { message?: string } })?.cause?.message;
  console.error("✖ Zurücksetzen fehlgeschlagen:", cause ?? (err instanceof Error ? err.message.split("\n")[0] : err));
  process.exit(1);
});
