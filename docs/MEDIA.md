# Medien – Herkunft, Bearbeitung, Austausch

Alle Bilder und Videos der Website stammen aus den Original-Aufnahmen des
Betreibers (Drohne DJI, 4K, und iPhone, 4K HDR/HLG, September 2026; einzelne
ältere Fotos, z. B. Alte Wirtschaft und Bühne mit Dekoration). Die Rohdateien
liegen **nicht** im Repository.

## Einheitlicher Look

Jede Datei durchläuft dieselbe Kette (ffmpeg):

1. iPhone-HDR (HLG, BT.2020) → Tone-Mapping nach SDR/BT.709
   (`zscale … npl=400, tonemap=mobius`), Drohnenmaterial ist bereits SDR.
2. Leichte Rauschminderung (`hqdn3d`), Farbe & Kontrast:
   `eq=contrast=1.07:saturation=1.10:gamma=0.97`, warme Mitten/Lichter
   (`colorbalance`), sanfte S-Kurve (`curves`), Schärfen (`unsharp`),
   dezente Vignette.
3. Fotos: dasselbe Grading, 2400×1600 (Titelbild) bzw. 2000×1333 (Galerie), WebP.
   Standbilder aus Videos werden automatisch aus 7 Kandidaten um den
   gewählten Zeitpunkt als schärfstes Bild ausgewählt.

Hochrechnen über die Aufnahmeauflösung (4K) hinaus ist bewusst nicht erfolgt –
es bringt keine zusätzliche Schärfe, nur größere Dateien.

## Dateien

| Ort | Inhalt |
|---|---|
| `public/media/tour/frames/<kapitel>/{d,m}/pNN.webp`, `poster.webp` | Scroll-Film: 40–200 Einzelbilder je Kapitel, je 6 in einer Datei. `d/` = 1920×1080 (Querformat), `m/` = 810×1440 (Hochformat-Ausschnitt fürs Handy). Erzeugt mit `tools/media/film3.py` (Verarbeitung in 2560×1440). Der Player zeigt immer nur scharfe Vollbilder: fehlt ein Bild noch, bleibt das nächste fertige Bild stehen, nie eine unscharfe Vorschau. Anzahl je Kapitel in `src/generated/tour-frames.json` |
| `public/media/<bereich>/hero.webp`, `gallery-NN.webp` | Titel- und Galeriebilder je Bereich |
| `public/media/<bereich>/tour.mp4`, `poster.webp` | Raumvideo auf der Detailseite (1920×1080) |
| `public/media/property/gallery-NN.webp` | Außen-/Drohnenbilder |
| `public/media/hero/krone-film.mp4`, `krone-film-720.mp4`, `poster.webp` | Imagefilm für den Hero der Startseite (72,6 s, 1920×1080 bzw. 1280×720 für Handys, 30 fps, stumm, nahtloser Loop). 16 Shots aus Drohnen- und iPhone-Material, Schnitt und Grading reproduzierbar mit `tools/media/film_cut.py`, Shotliste in `docs/FILM.md` |
| `public/media/hero/krone-property-tour.mp4` | Anflug (älterer Hero-Clip, Fallback wenn `krone-film.mp4` fehlt) |
| `public/media/floorplan/aerial-*.webp` | Drohnenfoto senkrecht von oben (Karte): ganzes Grundstück inkl. Hof und Parkplatz; Nachbargebäude entsättigt, abgedunkelt und schraffiert |
| `public/media/hotel/grundriss-og.svg` | Grundriss Obergeschoss (nach Bauplan) |
| `public/media/history/*.webp` | Historie-Streifen der Startseite: zwei Ausschnitte aus dem Leuchtbild (Fachwerkhaus, Krone mit Eder-Bräu-Schild), zwei Fotos der Aufstockung (Scan des Betreibers), siehe README im Ordner |

## Zuordnung Kapitel → Quelle

| Kapitel | Quelle (Sortierungs-Nr.) |
|---|---|
| Anflug | V01 (Drohne, 0:23–0:52) |
| Hauptrestaurant | V04 (Drohne, 0:06–0:30) |
| Nebenzimmer | V27 (iPhone) |
| Bühne | V22 (iPhone, 0:33–0:41) |
| Wintergarten | V04 (Drohne, 0:49–1:00, bis zur Gartentür) |
| Biergarten | Drohnenfoto F122 (Kamerafahrt) |
| Küche | retuschiertes Küchenbild (Kamerafahrt) |
| Alte Wirtschaft | Foto F028 (Kamerafahrt) |
| Hotel | V40 (iPhone, 0:06–0:16) |
| Blick von oben | V06 (Drohne, 1:00–1:37 rückwärts) → Drohnenfoto F054 |

Einzelbilder neu erzeugen: `tools/media/film.py <kapitel>` (Originale nicht im
Repo; Ordner per `KRONE_ORIGINALS`). Ablauf je Kapitel:
1. Ausschnitt direkt aus dem 4K-Original (iPhone-HLG → BT.709 tonemapped)
2. Stabilisierung in zwei Durchgängen (vidstab, starke Glättung, Auto-Zoom)
3. Einheitlicher Look, 1600×900, leichte Schärfung
4. Bildauswahl nach gleichmäßiger Bewegung (Kamerapfad aus Verschiebung, Drehung
   und Vorwärtsfahrt): jeder Scroll-Schritt zeigt gleich viel Bewegung
   Anzahl der Bilder folgt der Bewegung (≈2 % Bildbreite pro Schritt, 40–200),
   bei jedem Bild das schärfste der Nachbarbilder (Bewegungsunschärfe)
5. WebP q≈72; Anzahl je Kapitel in `src/config/tour.ts` (40, Drohne 48)
Biergarten, Küche und Alte Wirtschaft sind ruhige Kamerafahrten über Fotos
(F122, retuschiertes Küchenbild, F028).

## Bildbereinigung

Raumfotos (Titel- und Galeriebilder) wurden retuschiert: lose Gegenstände wie
Mülleimer, Kisten, Verpackungen, Lebensmittel, Tücher, Aschenbecher und Kabel
entfernt; Raum, Möbel, Geräte, Licht und Perspektive bleiben unverändert.
Werkzeug: KI-Bildbearbeitung (Gemini 3 Pro Image über ElevenLabs), jedes
Ergebnis im Vorher/Nachher-Vergleich geprüft. Die Originale bleiben beim
Betreiber.

## Raumgrößen (Richtwerte)

`src/content/space-estimates.ts`: Grundfläche je Bereich aus der Drohnenaufnahme
(DJI FC3170, 91 m Flughöhe, ≈3,1 cm/Pixel auf Traufhöhe), Außenmaß, auf 10 m²
gerundet; Sitzplätze als Faustwert (≈1,5 m² je Gast auf ~85 % der Fläche).
Echte Werte aus dem Admin (`areaSqm`, `capacitySeated`) haben Vorrang.

Austausch: Datei gleichen Namens ersetzen, `npm run dev`/`build` neu starten
(das Media-Manifest wird automatisch erzeugt).


## Grundstücksgrenze der Karte

Die farbige Fläche der Karte ist das Grundstück, wie es der Eigentümer auf dem Drohnenfoto F054 lila eingezeichnet hat (`tools/media/plot_outline.py` → `plotOutline` in `src/config/floorplan.ts`). Außerhalb ist das Foto entsättigt und abgedunkelt.


## Fotos (Titelbilder, Galerien)

`tools/media/grade3.py <quelle> <ziel.webp> <breite> <höhe> [cx cy]` gradet jedes Foto gleich: Tonwerte (Perzentil-Spreizung), Weißabgleich mit leicht warmer Tendenz, Helligkeits-Normalisierung, Krone-Look (Kontrast, Sättigung, warm/kühl, S-Kurve), Vignette, Schärfung auf Ausgabegröße. Quelle: Katalog-ID (`F044`), Videobild (`V22@37.0`) oder Dateipfad. Dadurch wirken alle Bilder wie eine Serie.

Zuordnung (10/2026): Nebenzimmer-Titel F044, Bühne V22 @ 37 s, Wintergarten F013, Hotel F035 (+ F038, F037, F036, F039, F115, F030), Biergarten: fünf Fotos des Betreibers, „Die Krone in Bildern“: F120, F001, F013, F043, F047, F035.
