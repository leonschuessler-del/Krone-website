/**
 * npm run db:migrate
 *
 * Applies the SQL migrations in ./drizzle.
 *  - DATABASE_URL set   → PostgreSQL (drizzle-orm/node-postgres/migrator)
 *  - DATABASE_URL empty → embedded PGlite in ./.data/pglite (migrated via getDb();
 *                         an empty database is seeded automatically)
 */
import { describeTarget, guardEmbeddedDb, loadEnv, parseArgs } from "../src/server/services/admin-cli";

async function main() {
  await loadEnv();
  const { flags } = parseArgs();
  const { MIGRATIONS_FOLDER } = await import("../src/server/db/client");
  console.info(`→ Migrationen anwenden: ${describeTarget()}`);

  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: url, max: 1, ssl: /sslmode=require|neon\.tech|supabase/.test(url) ? { rejectUnauthorized: false } : undefined });
    try {
      await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
    } finally {
      await pool.end();
    }
  } else {
    await guardEmbeddedDb(flags.has("force"));
    const { getDb, closeDb } = await import("../src/server/db/client");
    await getDb();
    await closeDb();
  }
  console.info("✔ Datenbank ist auf dem aktuellen Stand.");
}

main().catch((err) => {
  console.error("✖ Migration fehlgeschlagen:", (err as { cause?: { message?: string } })?.cause?.message ?? (err instanceof Error ? err.message.split("\n")[0] : err));
  process.exit(1);
});
