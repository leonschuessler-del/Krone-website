/**
 * Replacement for src/server/db/client.ts in the browser demo:
 * the real PostgreSQL (PGlite / WASM) runs inside the viewer's browser,
 * migrated with the project's SQL migrations and seeded with the demo data.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/server/db/schema";
import { MIGRATIONS } from "./migrations.generated";

type Database = ReturnType<typeof drizzle<typeof schema>>;

export const MIGRATIONS_FOLDER = "";
export const bootProgress = { loaded: 0, total: 0, listeners: new Set<() => void>() };

async function fetchGz(name: string): Promise<ArrayBuffer> {
  // binary blobs are published with a .wasm name (a served type); they are gzip data
  const res = await fetch(new URL(`pg/${name}.gz.wasm`, document.baseURI));
  if (!res.ok || !res.body) throw new Error(`${name}: ${res.status}`);
  const total = Number(res.headers.get("content-length") ?? 0);
  bootProgress.total += total;
  const reader = res.body.getReader();
  const counted = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      const { done, value } = await reader.read();
      if (done) return ctrl.close();
      bootProgress.loaded += value.byteLength;
      bootProgress.listeners.forEach((fn) => fn());
      ctrl.enqueue(value);
    },
  });
  return new Response(counted.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
}

async function create(): Promise<Database> {
  const [pgliteWasmModule, initdbWasmModule, fsBundle] = await Promise.all([
    fetchGz("pglite").then((b) => WebAssembly.compile(b)),
    fetchGz("initdb").then((b) => WebAssembly.compile(b)),
    fetchGz("pglite-data").then((b) => new Blob([b])),
  ]);
  const btree_gist = {
    name: "btree_gist",
    setup: async () => ({ bundlePath: new URL("pg/btree_gist.tar.gz.wasm", document.baseURI) }),
  };
  const client = await PGlite.create({ pgliteWasmModule, initdbWasmModule, fsBundle, extensions: { btree_gist } });
  for (const file of MIGRATIONS) {
    for (const stmt of file.split("--> statement-breakpoint")) {
      if (stmt.trim()) await client.exec(stmt);
    }
  }
  const db = drizzle(client, { schema });
  const { ensureSeeded } = await import("@/server/db/seed");
  await ensureSeeded(db as never);
  return db;
}

let promise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  return (promise ??= create());
}
export function getDbKind() {
  return "pglite" as const;
}
export async function closeDb() {}
