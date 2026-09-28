// Builds the full browser demo (static first paint + real app with in-browser PostgreSQL).
// usage: node build.mjs <baseUrl-of-running-prod-server>
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
const BASE = process.argv[2] ?? "http://localhost:3200";
const OUT = path.join(here, "dist");
const SNAPSHOT = path.join(here, "snapshot");
const SNAP_OUT = path.join(here, "dist-snapshot");

// 0) static snapshot parts (first paint + fallback)
execFileSync("node", [path.join(SNAPSHOT, "build-snapshot.mjs"), BASE, path.join(SNAP_OUT, "krone-vorschau.html")], { stdio: "inherit" });
const parts = JSON.parse(fs.readFileSync(path.join(SNAP_OUT, "parts.json"), "utf8"));

// 1) migrations → module
const journal = JSON.parse(fs.readFileSync(path.join(ROOT, "drizzle/meta/_journal.json"), "utf8"));
const migrations = journal.entries.map((e) => fs.readFileSync(path.join(ROOT, "drizzle", `${e.tag}.sql`), "utf8"));
fs.writeFileSync(path.join(here, "app", "migrations.generated.ts"), `export const MIGRATIONS: string[] = ${JSON.stringify(migrations)};\n`);

// 2) bundle
const shim = (f) => path.join(here, "app", "shims", f);
const aliases = {
  "@/server/db/client": path.join(here, "app", "browser-db.ts"),
  "@/server/auth/password": shim("password.ts"),
  "next/link": shim("next-link.tsx"),
  "next/image": shim("next-image.tsx"),
  "next/navigation": shim("next-navigation.ts"),
  "next/server": shim("misc.ts"),
  "next/headers": shim("misc.ts"),
  "next/font/local": shim("misc.ts"),
  "server-only": shim("empty.ts"),
  "demo-jsx/jsx-runtime": shim("jsx-runtime.ts"),
  "demo-jsx/jsx-dev-runtime": shim("jsx-runtime.ts"),
  "node:crypto": shim("crypto.ts"),
  crypto: shim("crypto.ts"),
  "node:util": shim("misc.ts"),
  util: shim("misc.ts"),
};
const emptyModules = /^(node:)?(fs|fs\/promises|path|url|module|os|child_process|worker_threads|stream|zlib|net|tls|http|https|perf_hooks|async_hooks|events|buffer|string_decoder|readline|v8|vm|assert|process)$/;

const demoPlugin = {
  name: "krone-demo",
  setup(b) {
    b.onResolve({ filter: /.*/ }, (args) => {
      if (aliases[args.path]) return { path: aliases[args.path] };
      if (emptyModules.test(args.path)) return { path: shim("empty.ts") };
      if (args.path.endsWith(".css")) return { path: args.path, namespace: "empty-css" };
      return undefined;
    });
    b.onLoad({ filter: /.*/, namespace: "empty-css" }, () => ({ contents: "", loader: "js" }));
    // mark exports of "use client" modules so the in-browser RSC resolver renders them as client components
    b.onLoad({ filter: /\/src\/.*\.(tsx|ts)$/ }, async (args) => {
      const src = await fs.promises.readFile(args.path, "utf8");
      if (!/^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(src)) return undefined;
      const names = new Set();
      for (const m of src.matchAll(/export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Z]\w*)/g)) names.add(m[1]);
      for (const m of src.matchAll(/export\s+const\s+([A-Z]\w*)\s*=/g)) names.add(m[1]);
      const marks = [...names].map((n) => `try { if (typeof ${n} === "function" || typeof ${n} === "object") ${n}.$$client = true; } catch {}`).join("\n");
      return { contents: `${src}\n;${marks}\n`, loader: args.path.endsWith("x") ? "tsx" : "ts" };
    });
  },
};

const env = {
  NODE_ENV: "production",
  DEMO_MODE: "true",
  NEXT_PUBLIC_DEMO_MODE: "true",
  PAYMENT_PROVIDER: "demo",
  EMAIL_PROVIDER: "preview",
  NEXT_PUBLIC_SITE_URL: "https://krone.preview",
  RATE_LIMIT_DISABLED: "1",
  // the demo has no admin area; a fixed account keeps the seed quiet
  SEED_ADMIN_EMAIL: "demo@krone.preview",
  SEED_ADMIN_PASSWORD: "browser-demo-only",
};
const result = await build({
  entryPoints: [path.join(here, "app", "main.tsx")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  write: false,
  jsx: "automatic",
  jsxImportSource: "demo-jsx",
  tsconfig: path.join(ROOT, "tsconfig.json"),
  absWorkingDir: ROOT,
  nodePaths: [path.join(ROOT, "node_modules")],
  define: { "process.env": JSON.stringify(env), "process.env.NODE_ENV": '"production"', global: "globalThis" },
  plugins: [demoPlugin],
  logLevel: "warning",
  legalComments: "none",
});
const appJs = result.outputFiles[0].text;

// 3) assets
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "pg"), { recursive: true });
const pgDist = path.join(ROOT, "node_modules/@electric-sql/pglite/dist");
// published under .wasm names (a served type); the content is gzip, unpacked in the browser
for (const [f, name] of [["pglite.wasm", "pglite"], ["initdb.wasm", "initdb"], ["pglite.data", "pglite-data"]]) {
  fs.writeFileSync(path.join(OUT, "pg", `${name}.gz.wasm`), zlib.gzipSync(fs.readFileSync(path.join(pgDist, f)), { level: 9 }));
}
fs.copyFileSync(path.join(pgDist, "btree_gist.tar.gz"), path.join(OUT, "pg", "btree_gist.tar.gz.wasm"));
fs.cpSync(path.join(ROOT, "public/media"), path.join(OUT, "media"), { recursive: true, filter: (src) => !src.endsWith(".md") });
fs.mkdirSync(path.join(OUT, "map"), { recursive: true });
fs.writeFileSync(path.join(OUT, "map/base.svg"), Buffer.from(await (await fetch(new URL("/map/base.svg", BASE))).arrayBuffer()));

// 4) page: static first paint (#static) + live app (#app, takes over when ready)
const appScript = `<script type="module">${appJs.replace(/<\/script/gi, "<\\/script")}</script>`;
const body = [
  `<title>${parts.title}</title>`,
  `<meta name="robots" content="noindex">`,
  parts.rootClasses,
  parts.styles,
  `<style>${parts.previewCss}\n#app[hidden]{display:none!important}</style>`,
  `<div id="app" hidden></div>`,
  `<div id="static">${parts.bodyHtml}${parts.pill}</div>`,
  parts.scripts,
  appScript,
].join("\n");
fs.writeFileSync(path.join(OUT, "index-content.html"), body);
// local test page (full document)
fs.writeFileSync(
  path.join(OUT, "index.html"),
  `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>${body}</body></html>`,
);
const size = (p) => (fs.statSync(p).size / 1024 / 1024).toFixed(2);
console.log("page", size(path.join(OUT, "index-content.html")), "MB; app.js", (appJs.length / 1024 / 1024).toFixed(2), "MB");
