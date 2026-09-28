# Imagefilm / Scroll-Rundgang

Die Startseite zeigt einen **scrollgesteuerten Rundgang** durch alle Räume
(siehe `src/config/tour.ts`). Solange kein Film vorhanden ist, wird er aus der
Grundstücksgrafik und den Raumbildern erzeugt (Storyboard-Modus).

## Echten Film einsetzen (Video-Modus)

1. Film ablegen: `krone-property-tour.mp4` (16:9, 1920×1080, stumm) und
   `poster.webp` (erstes Bild).
2. Für flüssiges Scrollen („Scrubbing“) mit kurzem Keyframe-Abstand kodieren:

   ```bash
   ffmpeg -i film.mov -c:v libx264 -preset slow -crf 22 -g 8 -keyint_min 8 \
          -pix_fmt yuv420p -movflags +faststart -an krone-property-tour.mp4
   ```

   Zielgröße: möglichst < 25 MB (z. B. 45–70 s, 1080p).
3. In `src/config/tour.ts`: `video.enabled = true`, `video.duration` (Sekunden)
   und bei jedem Kapitel `videoTime` = Startsekunde des Raums im Film setzen.

## Dramaturgie (Empfehlung)

Drohnenflug → gesamte Immobilie → Zoom Richtung Gebäude → Restaurant → (Theke)
→ Bühne → Nebenzimmer → Alte Wirtschaft → Küche → Wintergarten → Biergarten →
Hotel → Rückkehr zur Vogelperspektive (senkrechte Draufsicht). Endet der Film in
der Draufsicht, geht er nahtlos in den interaktiven Grundriss über.
