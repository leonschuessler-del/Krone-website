# Browser-Demo (Vorschau-Link ohne Server)

Baut die **komplette Website als statische Vorschau**, die ohne Server im Browser
läuft. So kann sie z. B. als Claude-Artifact-Link oder auf jedem statischen
Hosting geteilt werden:

- Die Startseite (Scroll-Rundgang, Grundriss, Abschnitte) ist **sofort** als
  Schnappschuss sichtbar (`snapshot/`).
- Im Hintergrund startet die **echte App**: dieselben Seiten, Komponenten,
  API-Route-Handler und Services wie auf dem Server. Die PostgreSQL-Datenbank
  läuft als WASM (PGlite) im Browser, mit denselben Migrationen (inkl.
  Exclusion-Constraint gegen Doppelbuchungen) und denselben Demo-Daten (`app/`).
  Sobald sie bereit ist (ca. 3–6 s), übernimmt sie die Seite an derselben
  Scroll-Position.
- Kann die Engine in einem Browser nicht starten, bleibt der Schnappschuss
  nutzbar. Kalender und Buchung zeigen dann einen Hinweis.

Alle Buchungen bleiben im Browser des Betrachters. Nach dem Neuladen ist wieder
alles auf dem Demo-Ausgangsstand. Es gibt keinen Admin-Bereich, keine
E-Mails und keine Zahlungen.

## Bauen

```bash
npm run build
PGLITE_IN_MEMORY=1 npx next start -p 3200 &     # Quelle für den Schnappschuss
npm run demo:browser                             # = node tools/browser-demo/build.mjs http://localhost:3200
```

Ergebnis in `tools/browser-demo/dist/`:

| Datei | Zweck |
|---|---|
| `index-content.html` | Seiteninhalt ohne `<html>/<head>/<body>` (für Claude-Artifacts, die das Gerüst selbst ergänzen) |
| `index.html` | vollständiges Dokument (lokal testen, statisches Hosting) |
| `pg/*.gz.wasm` | Datenbank-Engine (gzip, wird im Browser entpackt; `.wasm`-Endung nur als ausgelieferter Dateityp) |
| `media/`, `map/base.svg` | Bilder, Filme, Lageplan |

Lokal ansehen: `cd tools/browser-demo/dist && python3 -m http.server 3300` →
<http://localhost:3300/index.html>

## Testen

```bash
npx tsx tools/browser-demo/test/flow.mts http://localhost:3300/index.html /tmp   # Karte, Kalender, Buchung bis Bestätigung, Doppelbuchungsschutz
node tools/browser-demo/test/fallback.mjs http://localhost:3300/index.html        # Engine blockiert/langsam → Schnappschuss bleibt nutzbar
```

## Wie es funktioniert

- `build.mjs` bündelt `app/main.tsx` mit esbuild. Aliase ersetzen die
  Server-/Next-Module durch kleine Browser-Varianten (`app/shims/`):
  `next/link`, `next/image`, `next/navigation`, `next/server`, `node:crypto`
  (Token + SHA-256) und die DB-Anbindung (`app/browser-db.ts`).
- Server Components werden im Browser aufgelöst (`resolveTree` in
  `app/main.tsx`). Module mit `"use client"` werden beim Bündeln markiert und
  normal von React gerendert.
- `fetch("/api/…")` wird auf die echten Route-Handler umgeleitet (`app/api.ts`).
- Routing läuft in-memory. Die aktuelle Seite steht im Hash (`#!/buchen?…`),
  damit relative Asset-Pfade stabil bleiben und Zurück/Vor funktionieren.
