# Hero-Film der Startseite

`krone-film.mp4` (1920×1080, 30 fps, stumm, ≈ 73 s, nahtloser Loop), `krone-film-720.mp4`
(1280×720 für Handys) und `poster.webp` (erstes Bild). Nur echtes Material des Betreibers
(Drohne, iPhone) – keine KI-Bilder, kein Stock. Schnitt, Grading und Encode sind mit
`tools/media/film_cut.py` reproduzierbar; Shotliste und Ablauf in `docs/FILM.md`.

`krone-property-tour.mp4` ist der ältere reine Anflug-Clip und dient nur noch als Fallback,
wenn `krone-film.mp4` fehlt (`src/lib/media.ts`, `getHeroVideo`).

Der Player (`src/features/home/HeroVideo.tsx`) lädt den Film erst, wenn der Hero sichtbar ist,
nimmt unter 768 px die 720p-Fassung und zeigt bei „Bewegung reduzieren“ oder Datensparmodus nur
das Poster.
