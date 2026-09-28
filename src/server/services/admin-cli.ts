import net from "node:net";
import path from "node:path";
import readline from "node:readline";

/**
 * Helpers for the maintenance scripts in /scripts (db:migrate, db:seed,
 * db:reset, admin:create). Not used by the web app.
 */

/** Loads .env / .env.local exactly like Next.js does. Call BEFORE importing app modules. */
export async function loadEnv(): Promise<void> {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", { info: () => {}, error: console.error });
}

export function parseArgs(argv: string[] = process.argv.slice(2)): { flags: Set<string>; values: Record<string, string> } {
  const flags = new Set<string>();
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq > -1) {
      values[a.slice(2, eq)] = a.slice(eq + 1);
    } else if (argv[i + 1] !== undefined && !argv[i + 1]!.startsWith("--")) {
      values[a.slice(2)] = argv[i + 1]!;
      i++;
    } else {
      flags.add(a.slice(2));
    }
  }
  return { flags, values };
}

export function embeddedDbDir(): string | null {
  if (process.env.DATABASE_URL) return null;
  return path.resolve(process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite"));
}

function portInUse(port: number, host = "127.0.0.1", timeoutMs = 400): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (v: boolean) => {
      socket.destroy();
      resolve(v);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

/**
 * The embedded PGlite database may only be opened by ONE process. When the
 * default data directory is used and a dev server seems to be running,
 * scripts abort (unless --force) to avoid corrupting the database.
 */
export async function guardEmbeddedDb(force: boolean): Promise<void> {
  if (process.env.DATABASE_URL || process.env.PGLITE_DATA_DIR || force) return;
  const port = Number(process.env.PORT ?? 3000);
  if (await portInUse(port)) {
    console.error(
      `\n✖ Auf Port ${port} läuft offenbar der Dev-Server. Die eingebettete Datenbank (./.data/pglite) darf nur von einem Prozess geöffnet werden.\n` +
        `  Bitte den Dev-Server stoppen und den Befehl erneut ausführen (oder mit --force erzwingen).\n`,
    );
    process.exit(1);
  }
}

/**
 * Line-based prompts on ONE readline interface (works interactively and with
 * piped input). Hidden prompts do not echo the typed characters on a TTY.
 */
export function createPrompter() {
  const tty = Boolean(process.stdin.isTTY);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: tty });
  let muted = false;
  const internal = rl as unknown as { _writeToOutput: (s: string) => void };
  const original = internal._writeToOutput.bind(rl);
  internal._writeToOutput = (s: string) => {
    if (!muted) original(s);
  };
  const buffered: string[] = [];
  const waiting: Array<(line: string | null) => void> = [];
  let closed = false;
  rl.on("line", (line) => {
    const next = waiting.shift();
    if (next) next(line);
    else buffered.push(line);
  });
  rl.on("close", () => {
    closed = true;
    while (waiting.length) waiting.shift()!(null);
  });

  async function ask(question: string, options: { hidden?: boolean } = {}): Promise<string> {
    process.stdout.write(question);
    muted = Boolean(options.hidden) && tty;
    const line = buffered.length ? buffered.shift()! : closed ? null : await new Promise<string | null>((resolve) => waiting.push(resolve));
    muted = false;
    if (options.hidden || !tty) process.stdout.write("\n");
    if (line === null) throw new Error("Eingabe abgebrochen.");
    return line.trim();
  }

  return { ask, close: () => rl.close() };
}

/**
 * Seeds idempotently: base data + first admin always (both idempotent), demo
 * data only when no demo seed blocks exist yet (they are time-relative
 * inserts and would collide with themselves on a second run).
 */
export async function runIdempotentSeed(demo: boolean): Promise<{ demoCreated: boolean }> {
  const { and, count, eq } = await import("drizzle-orm");
  const { getDb } = await import("../db/client");
  const { seedDatabase } = await import("../db/seed");
  const { availabilityBlocks } = await import("../db/schema");
  const db = await getDb();
  const [row] = await db
    .select({ n: count() })
    .from(availabilityBlocks)
    .where(and(eq(availabilityBlocks.isDemo, true), eq(availabilityBlocks.createdBy, "seed")));
  const demoPresent = Number(row?.n ?? 0) > 0;
  await seedDatabase(db, { demo: demo && !demoPresent });
  return { demoCreated: demo && !demoPresent };
}

export function describeTarget(): string {
  const url = process.env.DATABASE_URL;
  if (url) {
    try {
      const u = new URL(url);
      return `PostgreSQL ${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname}`;
    } catch {
      return "PostgreSQL (DATABASE_URL)";
    }
  }
  const dir = embeddedDbDir()!;
  const rel = path.relative(process.cwd(), dir);
  return `eingebettete Datenbank (PGlite) ${rel && !rel.startsWith("..") ? rel : dir}`;
}
