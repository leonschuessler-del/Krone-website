import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/**
 * Database access.
 *
 *  - DATABASE_URL set  → PostgreSQL via node-postgres (production).
 *  - DATABASE_URL empty → embedded PostgreSQL (PGlite, WASM) – zero-setup
 *    local development / previews:
 *        local:   persisted in ./.data/pglite
 *        Vercel:  in-memory (re-created and demo-seeded on cold start)
 *    The embedded DB is migrated automatically and, in DEMO_MODE, seeded.
 *
 * Both drivers run the same SQL migrations from ./drizzle, including the
 * exclusion constraint that makes double bookings impossible.
 */

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

interface DbHolder {
  promise: Promise<Database> | null;
  close: (() => Promise<void>) | null;
  kind: "postgres" | "pglite" | null;
}

const globalForDb = globalThis as unknown as { __kroneDb?: DbHolder };
const holder: DbHolder = (globalForDb.__kroneDb ??= { promise: null, close: null, kind: null });

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

async function createPostgres(url: string): Promise<Database> {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    ssl: /sslmode=require|neon\.tech|supabase/.test(url) ? { rejectUnauthorized: false } : undefined,
  });
  holder.close = () => pool.end();
  holder.kind = "postgres";
  return drizzle(pool, { schema }) as unknown as Database;
}

async function createPglite(dataDir: string | undefined): Promise<Database> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { btree_gist } = await import("@electric-sql/pglite/contrib/btree_gist");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  if (dataDir) {
    const fs = await import("node:fs");
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const client = await PGlite.create(dataDir, { extensions: { btree_gist } });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  holder.close = () => client.close();
  holder.kind = "pglite";
  const typed = db as unknown as Database;
  const { ensureSeeded } = await import("./seed");
  await ensureSeeded(typed);
  return typed;
}

export function getDb(): Promise<Database> {
  if (!holder.promise) {
    const url = process.env.DATABASE_URL;
    if (url) {
      holder.promise = createPostgres(url);
    } else {
      const inMemory = process.env.VERCEL === "1" || process.env.PGLITE_IN_MEMORY === "1";
      const dir = inMemory ? undefined : (process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite"));
      holder.promise = createPglite(dir);
    }
    holder.promise.catch(() => {
      holder.promise = null;
    });
  }
  return holder.promise;
}

export function getDbKind(): DbHolder["kind"] {
  return holder.kind;
}

export async function closeDb(): Promise<void> {
  if (holder.close) await holder.close();
  holder.promise = null;
  holder.close = null;
  holder.kind = null;
}

/** For tests: create an isolated in-memory database (migrated, optionally seeded). */
export async function createTestDb(options: { seed?: boolean } = {}): Promise<{ db: Database; close: () => Promise<void> }> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { btree_gist } = await import("@electric-sql/pglite/contrib/btree_gist");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = await PGlite.create(undefined, { extensions: { btree_gist } });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  const typed = db as unknown as Database;
  if (options.seed !== false) {
    const { seedDatabase } = await import("./seed");
    await seedDatabase(typed, { demo: true });
  }
  return { db: typed, close: () => client.close() };
}
