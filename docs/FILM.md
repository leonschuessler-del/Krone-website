# Imagefilm (Hero der Startseite)

`public/media/hero/krone-film.mp4` – 72.6 s, 1920×1080, 30 fps, stumm, nahtloser Loop
(28.4 MB; `krone-film-720.mp4` 1280×720 13.3 MB für Viewports < 768 px;
`poster.webp` = erstes Bild). Ausschließlich Originalaufnahmen des Betreibers vom 30.09.2026
(Drohne DJI, iPhone 4K HLG). Keine KI-Bilder, kein Stockmaterial, keine Texteinblendungen, keine Musik.
Es sind keine Personen zu sehen; Passagen mit Personen, Spiegelungen von Personen, Kartons oder
Kisten wurden beim Schnitt ausgelassen (siehe unten). Prüfung: Sichtkontrolle jedes Shots über
Kontaktbögen (1–4 fps, bei Verdacht Vollauflösung) und des fertigen Films (1 und 2 fps) sowie eine
Gesichtssuche mit OpenCV YuNet (5 fps, 1920×1080, Score ≥ 0,5): 21 Kandidaten mit niedrigem Score,
alle als Fehlalarme verifiziert (Holzfigur an der Wand der Gaststube, Chafing-Dish, Äste hinter Glas,
Autodach von oben, Übergangsbilder).

Erzeugt mit `tools/media/film_cut.py` (Shotliste, Korrekturen, Übergänge, Loop, Encodes in einer Datei).

## Shotliste

| # | Shot | Quelle | In–Out (Original) | Zeigt | Tempo | Übergang hinein | Dauer | Beginn im Film |
|---|---|---|---|---|---|---|---|---|
| 1 | `anflug` | `dji_150512_53` | 43.5–52.3 s | Drohnen-Anflug über Leidersbach, Sinkflug auf die Fassade „Zur Krone“ | Echtzeit | — (Filmanfang) | 9.3 s | 0.0 s |
| 2 | `fassade` | `dji_150708_54` | 1.0–6.5 s | Fassade mit Schriftzug „Landhotel-Gasthof Zur Krone“, Sinkflug zum Eingang | Echtzeit | fade 1.0 s | 5.5 s | 6.8 s |
| 3 | `tuer` | `dji_152822_66` | 0.6–6.3 s | Durch die Eingangstür in die Gaststube: Rundleuchten, gedeckte Tische | Echtzeit | zoomin 0.9 s | 5.7 s | 11.4 s |
| 4 | `theke` | `dji_151110_55` | 27.4–29.6 s | Theke: Wandspruch, runder Tresen, Blick in die Gaststube (leicht verlangsamt) | 1.5× Zeitlupe (minterpolate) | smoothleft 0.8 s | 3.3 s | 16.3 s |
| 5 | `nebenzimmer` | `dji_150708_54` | 90.0–95.5 s | Nebenzimmer: lange Tafeln und Kachelofen | Echtzeit | dissolve 0.8 s | 5.5 s | 18.8 s |
| 6 | `wintergarten` | `dji_151644_56` | 53.5–61.5 s | Hero-Moment: Flug durch den Wintergarten, durch die Tür hinaus zur Sandsteinmauer | Echtzeit | circleopen 1.0 s | 8.0 s | 23.3 s |
| 7 | `hof` | `dji_152336_63` | 94.0–99.0 s | Biergarten unter der Weinlaube, Glasdach und Wintergarten | Echtzeit | fade 0.9 s | 5.0 s | 30.4 s |
| 8 | `kueche` | `IMG_4803.MOV` | 3.0–5.6 s | Küche: Herdblock unter der Haube (Zeitlupe) | 2× Zeitlupe, vidstab | wipetl 0.8 s | 5.2 s | 34.6 s |
| 9 | `fruehstueck` | `dji_152932_68` | 24.2–26.8 s | Frühstücksbuffet (leicht verlangsamt) | 1.4× Zeitlupe (minterpolate) | fade 0.8 s | 3.6 s | 39.0 s |
| 10 | `treppe` | `IMG_4880.MOV` | 2.0–4.6 s | Treppenhaus: Kugelleuchten, schmiedeeisernes Geländer (Zeitlupe) | 2× Zeitlupe, vidstab | hblur 0.8 s | 5.2 s | 41.8 s |
| 11 | `flur` | `IMG_4874.MOV` | 7.2–9.2 s | Hotelflur (Zeitlupe) | 2× Zeitlupe, vidstab | smoothleft 0.8 s | 4.0 s | 46.2 s |
| 12 | `zimmer-tuer` | `IMG_4868.MOV` | 4.0–8.0 s | Die Tür geht auf: modernes Zimmer (Zeitlupe) | 1.5× Zeitlupe (minterpolate), vidstab | fade 0.9 s | 6.0 s | 49.3 s |
| 13 | `zimmer-bad` | `IMG_4869.MOV` | 10.8–12.8 s | Modernes Zimmer: Bett am Fenster (Zeitlupe) | 2× Zeitlupe, vidstab | smoothup 0.8 s | 4.0 s | 54.5 s |
| 14 | `zimmer-klassisch` | `IMG_4870.MOV` | 4.0–6.3 s | Klassisches Zimmer, Fahrt übers Bett (Zeitlupe) | 2× Zeitlupe, vidstab | radial 0.8 s | 4.6 s | 57.7 s |
| 15 | `kreis` | `dji_151754_57` | 40.0–46.0 s | Kreisflug über Haus und Ort | Echtzeit | fade 1.0 s | 6.0 s | 61.3 s |
| 16 | `dach` | `dji_152108_62` | 76.0–82.0 s | Senkrecht von oben: Dach, Hof, Nachbarschaft | Echtzeit | smoothup 1.0 s | 6.0 s | 66.3 s |
| – | Loop-Nahtstelle | `dji_150512_53` (Kopie der ersten 1.5 s von Shot 1) | | zurück zum Anflug | | fade 1.2 s | | 72.6 s (Ende) |

Reihenfolge: Anflug → Fassade → Eingangstür/Gaststube → Theke → Nebenzimmer → Wintergarten (Durchflug
in den Biergarten) → Biergarten/Hof → Küche → Frühstücksbuffet → Treppenhaus → Flur → modernes Zimmer
(Tür geht auf) → modernes Zimmer → klassisches Zimmer → Kreisflug → Dach von oben → zurück zum Anflug.
Drohnenaufnahmen laufen in Echtzeit (sie sind bereits ruhig), die iPhone-Aufnahmen mit 60/120 fps als
2×-Zeitlupe – daraus entsteht der ruhige, schwebende Rhythmus. Zwei 30-fps-Quellen (Zimmertür, Theke)
und das Frühstücksbuffet werden mit `minterpolate` (Bewegungsinterpolation) leicht verlangsamt.
Ruhige Einstellungen bekommen einen sanften Push-in (bis 4 %), damit jedes Bild in Bewegung bleibt.

### Bewusst nicht verwendet

- `dji_150708_54` 20–33 s (Eingangstreppe): Personen laufen vorbei bzw. spiegeln sich im Fenster.
- `dji_152932_68` vor 24,2 s (Servicebereich): zwei Personen am Tisch im Hinterzimmer, Zapfanlage mit Kisten.
- `dji_152848_67` (Wintergarten): ab ~4 s Kartons auf der Bank → ersetzt durch den Durchflug in `dji_151644_56`.
- `IMG_4793` (Biergarten, Handy): Pergola/Mauer sind im Drohnen-Durchflug und im Hof-Shot enthalten; am Ende des Clips eine Person.
- `IMG_4786` (Theke, 120 fps): Zeitungsstapel und Flaschen auf dem Tresen.
- `IMG_4876` (Treppenhaus): Hochformat.
- `IMG_4869` 0–3 s (Bad): Spiegel.

## Grading

1. **Neutral**: 4K-Original → 2112×1188 (Lanczos, 10 % Reserve für den Push-in). iPhone-HLG (BT.2020,
   arib-std-b67) → BT.709 mit `zscale … npl=400, tonemap=mobius:param=0.35`, Drohne ist bereits SDR.
   Handaufnahmen: `vidstabdetect` (shakiness 6) + `vidstabtransform` (smoothing ≈ 1 s Quellzeit,
   optzoom 1), dann `setpts` (Zeitlupe) und `fps=30`. libx264 crf 16.
2. **Messung** je Shot: mittlere Luma, mittleres RGB und die Farbe der hellen Bildteile (Perzentil 92–98 %).
3. **Angleichung** (vor dem gemeinsamen Look): Weißabgleich über `colorchannelmixer` (Rot-/Blau-Gain aus
   den hellen Bildteilen, 30 % Grau-Welt-Anteil, 70 % der gemessenen Abweichung,
   begrenzt auf ±10 %) und Belichtung über `eq=gamma` (60 % Richtung Ziel-Luma 0.44).
   Dadurch sitzen Drohnen-Außen- und iPhone-Innenaufnahmen in einer Palette: warm, natürlich, Weiß bleibt weiß.
4. **Krone-Look** (identisch zu `docs/MEDIA.md`): `hqdn3d=1.2:1.2:3:3`, `eq=contrast=1.07:saturation=1.10:gamma=0.97`,
   `colorbalance` (warme Mitten/Lichter), S-Kurve `curves`, `unsharp=5:5:0.55`, `vignette=angle=PI/7`.
5. Push-in/Pan subpixelgenau mit OpenCV (Lanczos) auf 1920×1080.

Luma je Shot (Mittelwert 0–1; „neutral“ = nach Tonemapping, „graded“ = fertig):

| Shot | Luma neutral | Luma graded | RGB neutral | helle Bildteile RGB |
|---|---|---|---|---|
| `anflug` | 0.467 | 0.364 | 0.48 0.47 0.46 | 0.82 0.82 0.79 |
| `fassade` | 0.495 | 0.381 | 0.50 0.49 0.48 | 0.81 0.78 0.73 |
| `tuer` | 0.411 | 0.353 | 0.49 0.40 0.31 | 0.87 0.85 0.82 |
| `theke` | 0.377 | 0.320 | 0.46 0.36 0.27 | 0.85 0.83 0.78 |
| `nebenzimmer` | 0.465 | 0.374 | 0.52 0.46 0.38 | 0.84 0.90 0.90 |
| `wintergarten` | 0.491 | 0.374 | 0.54 0.48 0.41 | 0.86 0.91 0.90 |
| `hof` | 0.436 | 0.350 | 0.46 0.44 0.34 | 0.92 0.86 0.64 |
| `kueche` | 0.482 | 0.376 | 0.51 0.48 0.44 | 0.85 0.83 0.78 |
| `fruehstueck` | 0.404 | 0.340 | 0.45 0.40 0.33 | 0.82 0.82 0.77 |
| `treppe` | 0.571 | 0.412 | 0.62 0.57 0.46 | 0.82 0.73 0.54 |
| `flur` | 0.540 | 0.398 | 0.60 0.53 0.48 | 0.89 0.82 0.77 |
| `zimmer-tuer` | 0.536 | 0.392 | 0.60 0.53 0.45 | 0.87 0.88 0.84 |
| `zimmer-bad` | 0.517 | 0.398 | 0.54 0.51 0.48 | 0.87 0.86 0.82 |
| `zimmer-klassisch` | 0.540 | 0.402 | 0.61 0.53 0.45 | 0.87 0.86 0.81 |
| `kreis` | 0.479 | 0.369 | 0.48 0.48 0.48 | 0.82 0.83 0.81 |
| `dach` | 0.481 | 0.373 | 0.50 0.48 0.45 | 0.87 0.88 0.87 |

## Übergänge und Loop

`xfade` in einer Filterkette über alle Shots (Übergang und Dauer stehen in der Shotliste): `fade`, `zoomin`,
`smoothleft`, `dissolve`, `circleopen`, `wipetl`, `hblur`, `smoothup`, `radial`. Dauer 0,8–1,2 s.

Loop-Nahtstelle: Der letzte Shot (Dach von oben) blendet mit `fade` (1.2 s) in eine Kopie der
ersten 1.5 s von Shot 1. Anschließend werden genau diese 1.5 s am Filmanfang abgeschnitten.
Das letzte Bild des Films ist damit Bild 44 des Anflugs, das erste Bild ist Bild 45 –
beim Zurückspringen entsteht ein normaler Bildschritt, kein Sprung.
Prüfung (`check`): mittlere Differenz letztes ↔ erstes Bild 19.25 (8-bit), normale
Bildschritte an derselben Stelle 17.80 / 17.36.

## Encodes

Master: `work/master.mp4` (libx264 crf 16, 1920×1080, 30 fps). Daraus:

- `krone-film.mp4`: libx264 `-preset slow`, 2-Pass, Bitrate aus der Zielgröße ≤ 30 MB
  (3173 kbit/s, maxrate ≤ 6 M), `-pix_fmt yuv420p -movflags +faststart -g 60 -an`.
- `krone-film-720.mp4`: dasselbe mit `scale=1280:720` (Lanczos), Ziel ≤ 14 MB (1480 kbit/s, maxrate ≤ 2,6 M).
- `poster.webp`: erstes Bild des Masters, WebP q82.

Warum 2-Pass statt crf 23: Mit `-crf 23 -maxrate 6M` ergibt der 72-s-Film ≈ 50 MB (Dach-, Baum- und
Pflasterdetails der Drohne sind teuer). Ein pauschal höherer crf (≥ 30) würde alle Shots gleich weich machen;
2-Pass verteilt das Budget: ruhige Innenräume geben ab, die Drohnenaufnahmen bekommen mehr.

## Neu rendern

```bash
KRONE_ORIGINALS=/pfad/zu/originals python3 tools/media/film_cut.py          # alle Stufen
KRONE_ORIGINALS=… python3 tools/media/film_cut.py neutral theke              # nur einen Shot neu
KRONE_ORIGINALS=… python3 tools/media/film_cut.py measure grade assemble encode check
```

Zwischenergebnisse liegen in `KRONE_FILM_WORK` (Standard `/tmp/krone-film-work`): `neutral/`, `graded/`,
`master.mp4`, `measure.json`, `timeline.json`, `check.json`, `final-sheet.png` (Kontaktbogen 1 fps).
Die Startseite nimmt `krone-film.mp4` automatisch (`getHeroVideo()` in `src/lib/media.ts`); unter 768 px
Breite lädt `HeroVideo.tsx` die 720p-Fassung. Das Media-Manifest wird bei `npm run dev`/`build` neu erzeugt.
