# Browser-Demo (Vorschau-Link ohne Server)

Es gibt zwei Varianten:

1. **Vorschau-Link (empfohlen, wird als Claude-Artifact geteilt)** – `snapshot/`:
   statische Schnappschüsse der **Eventlocation-Seiten** plus `runtime.ts`.
   Seit 10/2026 gibt es nur noch die Eventlocation (`src/config/scope.ts`,
   `ARCHIV.md`); Hotel, Aktuelles/Angebote und Umgebung sind archiviert und
   nicht Teil der Vorschau.
   Läuft in **jedem** Browser und in eingebetteten Viewern, auch wenn dort
   WebAssembly oder Video-Spulen gesperrt sind:

   | Datei | Seite |
   |---|---|
   | `index.html` | `/` – Startseite = Eventlocation (Scroll-Rundgang, Raumplaner, Räume, Galerie-Auszug, Ablauf, FAQ) |
   | `bereiche.html` | `/bereiche` – alle Räume |
   | `galerie.html` | `/galerie` |
   | `faq.html` | `/faq` |
   | `kontakt.html` | `/kontakt` (Karte mit dem Haus) |

   - Scroll-Rundgang mit demselben Bildsequenz-Player wie die Website
     (`src/features/home/tour-player.ts`); der Hero-Film läuft in der
     720p-Fassung (`krone-film-720.mp4`, Artifact-Grenze 15 MB je Datei)
   - Raumdetails (`/bereiche/<slug>`) öffnen sich als Dialog mit Galerie,
     Fläche/Plätzen (Richtwerte) und Auswahl; `/bereiche/hotel` springt zum
     Abschnitt „Die ganze Etage“ (`index.html#hotel`)
   - `/buchen` öffnet den Anfrage-Dialog (gewählte Räume werden übernommen):
     Räume → Termin (Kalender und Prüfung mit der echten Domänenlogik
     `src/domain/availability.ts` auf dem Demo-Szenario, Doppelbuchungsschutz)
     → Zusatzleistungen → Angaben → Anfragenummer. Anfragen bleiben im Browser
     (localStorage).
   - **Keine Preise** (`siteScope.showPrices = false`): Räume und
     Zusatzleistungen stehen „auf Anfrage“, es gibt keine Summen, Rabatte,
     Anzahlungen oder Kautionsbeträge. Die Seitendaten enthalten keine
     Preisfelder (Zusatzleistungen nur mit Name und Beschreibung).
   - **Nur Anfragen** (`siteScope.requestOnly = true`): kein verbindliches
     Buchen, keine Zahlung. Die Hotel-Buchungsmaschine
     (`snapshot/preview-engine.tsx`) gehört zur archivierten Hotelseite und
     wird nicht mehr eingebunden (Datei bleibt erhalten).
   - Links auf archivierte Seiten führen nicht ins Leere: `/hotel…` → Hauptseite
     (`siteScope.mainSiteUrl`, z. B. krone-landhotel.de), `/aktuelles` →
     Startseite, `/sehenswuerdigkeiten` → Startseite/Kontakt, `/eventlocation`
     → Startseite. Rechtstexte öffnen als Ebene.

   ```bash
   npm run build && PGLITE_IN_MEMORY=1 npx next start -p 3200 &
   node tools/browser-demo/snapshot/build-snapshot.mjs http://localhost:3200
   # → dist-snapshot/index.html, bereiche.html, galerie.html, faq.html, kontakt.html
   #   dist-snapshot/krone-vorschau.html (= index.html)
   #   dist-snapshot/artifact/zur-krone-vorschau.html (Startseite ohne <html>-Gerüst) + übrige Seiten
   ```
   Die Dateien laden Bilder und Filme relativ aus `media/…` – beim Teilen
   `public/media` (und `public/brand`, `public/map`) mit veröffentlichen.

   **Preis-Prüfung:** Nach dem Schreiben durchsucht der Build sichtbaren Text,
   Seitendaten und Rechtstexte nach €-Beträgen, „Euro“, Prozentangaben und
   Währungsformaten. Fundstellen werden ausgegeben und der Lauf endet mit
   Exit-Code 1 (Dateien liegen trotzdem zur Kontrolle vor). Bewusst
   überspringen: `SNAPSHOT_ALLOW_PRICES=1`.
   Nur einzelne Seiten bauen: `SNAPSHOT_ONLY=index.html,galerie.html`.
   Seiten früherer Builds, die es nicht mehr gibt (hotel.html, aktuelles.html …),
   verschiebt ein vollständiger Lauf nach `dist-snapshot/_alt/` bzw.
   `dist-snapshot/artifact/_alt/` – sie werden nicht gelöscht, aber auch nicht
   mehr versehentlich veröffentlicht.

2. **Volle App im Browser** (unten): echte Seiten + PostgreSQL als WASM.
   Braucht WebAssembly; in manchen eingebetteten Viewern blockiert.

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
