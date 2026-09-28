# Medien: Hotel

Hier die echten Medien dieses Bereichs ablegen (Dateinamen exakt so verwenden):

| Datei            | Zweck                                  | Empfehlung                    |
|------------------|----------------------------------------|-------------------------------|
| hero.webp        | Titelbild (Karte, Karten, Detailseite) | 2400×1600 px, WebP, < 400 KB  |
| gallery-01.webp  | Galerie-Bild 1                         | 2000×1333 px, WebP            |
| gallery-02.webp  | Galerie-Bild 2                         | 2000×1333 px, WebP            |
| gallery-03.webp  | Galerie-Bild 3 (weitere: gallery-04 …) | 2000×1333 px, WebP            |
| tour.mp4         | Optionales Raum-Video                  | 1920×1080, H.264, < 15 MB     |
| poster.webp      | Standbild für das Video                | 1920×1080 px, WebP            |

Fehlende Dateien werden automatisch durch neutrale Platzhalter ersetzt – es
erscheinen weder kaputte Bilder noch leere schwarze Videoflächen.

Nach dem Hinzufügen den Dev-Server bzw. Build neu starten (das Media-Manifest
`src/generated/media-manifest.json` wird dabei automatisch aktualisiert).

Nur echte, freigegebene Aufnahmen der Krone verwenden. Alternativtexte
(alt) werden in `src/content/media.ts` gepflegt.
