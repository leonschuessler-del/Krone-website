# Demo-Medien (Beispielbilder & Testfilme)

**Achtung: Alle Dateien in diesem Ordner sind automatisch erzeugte
Illustrationen – keine Fotos und keine Filmaufnahmen der „Zur Krone“.**

Sie dienen nur dazu, schon jetzt zu zeigen, wie die Website mit Bildern und
Videos wirkt, solange noch keine echten Aufnahmen vorliegen. Jedes Bild trägt
unten rechts den eingebrannten Hinweis **„BEISPIELBILD · Illustration“**, die
Rundgang-Videos den Hinweis **„BEISPIELFILM · Illustration“**, der Startseiten-
Film den Hinweis **„TESTFILM – Platzhalter“**. So kann nichts davon mit einem
echten Foto des Hauses verwechselt werden.

## Wann werden diese Dateien angezeigt?

Nur als **Fallback**: Die Website verwendet zuerst die echten Medien aus
`public/media/<bereich>/` (z. B. `public/media/restaurant/hero.webp`).
Fehlt dort eine Datei, kann stattdessen die gleichnamige Demo-Datei aus
`public/media/_demo/<bereich>/` gezeigt werden.

**Echte Medien haben immer Vorrang:** Sobald z. B.
`public/media/restaurant/hero.webp` existiert, wird das Demo-Bild für diese
Stelle automatisch nicht mehr verwendet. Es muss dafür nichts gelöscht werden.
(Nach dem Hinzufügen echter Dateien Dev-Server bzw. Build neu starten – das
Media-Manifest wird dabei aktualisiert.)

## Inhalt

| Ordner | Dateien |
|--------|---------|
| `restaurant/`, `kitchen/`, `side-room/`, `stage/`, `old-tavern/`, `winter-garden/`, `beer-garden/`, `hotel/` | `hero.webp`, `gallery-01.webp` … `gallery-03.webp` (1600×1067), `tour.webm` (1280×720, VP8, ca. 10 s, loopfähig), `poster.webp` (erstes Bild des Films) |
| `property/` | `gallery-01.webp` … `gallery-04.webp` – Außenansichten (Fassade, Eingang, Abendstimmung, Garten) |
| `hero/` | `krone-property-tour.webm` (virtueller „Drohnenflug“ über den stilisierten Lageplan, loopfähig) und `poster.webp` |

Hinweis: Safari/iOS spielen WebM (VP8) teils nicht ab. In diesem Fall zeigt die
Website das jeweilige `poster.webp` als Standbild.

## Neu erzeugen

Alle Dateien werden reproduzierbar (gleiches Ergebnis bei jedem Lauf) aus Code
erzeugt – ohne Internet, ohne Stockfotos:

```bash
npm run media:demo
# nur einzelne Bereiche:
npm run media:demo -- --only restaurant,hotel
# ohne Videos (schneller):
npm run media:demo -- --skip-video
```

Voraussetzungen: installierte Dev-Abhängigkeiten (Playwright-Chromium, sharp)
und ein ffmpeg mit libvpx (z. B. das von Playwright mitgelieferte;
alternativ Pfad per `FFMPEG_PATH` setzen).

Der Generator liegt in `scripts/demo-media/` (Szenen je Bereich in
`scripts/demo-media/scenes/`, Filme in `scripts/demo-media/video/`).
Der Startseiten-Testfilm nutzt den eigenen stilisierten Lageplan
(`src/features/map/render-base-map.ts`) sowie die Flächen aus
`src/config/floorplan.ts` – ändern sich diese, einfach neu erzeugen.

## Entfernen

Werden keine Demo-Medien mehr benötigt, kann der Ordner `public/media/_demo/`
komplett gelöscht werden.
