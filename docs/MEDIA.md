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
| `public/media/tour/<kapitel>.mp4/.jpg` | Scroll-Film (1600×900, 24 fps, Keyframe alle 10 Bilder → flüssiges Scrubbing) |
| `public/media/<bereich>/hero.webp`, `gallery-NN.webp` | Titel- und Galeriebilder je Bereich |
| `public/media/<bereich>/tour.mp4`, `poster.webp` | Raumvideo auf der Detailseite (1920×1080) |
| `public/media/property/gallery-NN.webp` | Außen-/Drohnenbilder |
| `public/media/hero/krone-property-tour.mp4` | Anflug (Fallback für „reduzierte Bewegung“) |
| `public/media/floorplan/aerial-*.webp` | Drohnenfoto senkrecht von oben (Karte) |
| `public/media/hotel/grundriss-og.svg` | Grundriss Obergeschoss (nach Bauplan) |

## Zuordnung Kapitel → Quelle

| Kapitel | Quelle (Sortierungs-Nr.) |
|---|---|
| Anflug | V01 (Drohne, 0:10–0:52) |
| Biergarten | V07 (Drohne, 1:03–1:39) |
| Wintergarten | V18 (iPhone) |
| Hauptrestaurant | V04 (Drohne, 0:06–0:30) |
| Nebenzimmer | V27 (iPhone) |
| Bühne | V22 (iPhone, 0:31–0:40) |
| Küche | V35 (iPhone) |
| Alte Wirtschaft | Fotos F028/F029 (2018, langsame Kamerafahrt) |
| Hotel | V40 (iPhone) |
| Blick von oben | V06 (Drohne, rückwärts) → Drohnenfoto F054 |

Austausch: Datei gleichen Namens ersetzen, `npm run dev`/`build` neu starten
(das Media-Manifest wird automatisch erzeugt).
