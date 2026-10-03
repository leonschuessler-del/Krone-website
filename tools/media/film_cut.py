#!/usr/bin/env python3
"""Imagefilm „Zur Krone“ – reproduzierbarer Schnitt für den Hero der Startseite.

Ergebnis: public/media/hero/krone-film.mp4 (1920×1080, 30 fps, stumm, Loop),
          public/media/hero/krone-film-720.mp4 (1280×720) und poster.webp (erstes Bild).
Nur echtes Material des Betreibers (Drohne DJI, iPhone 4K HLG). Keine KI-Bilder,
kein Stock, kein Text, keine Musik. Die Rohdateien liegen nicht im Repository.

Aufruf (Originale liegen in einem Ordner neben dem Katalog, siehe docs/MEDIA.md):

    KRONE_ORIGINALS=/pfad/zu/originals python3 tools/media/film_cut.py            # alle Stufen
    KRONE_ORIGINALS=... python3 tools/media/film_cut.py neutral 03 07             # nur Shots 03+07
    KRONE_ORIGINALS=... python3 tools/media/film_cut.py grade assemble encode check

Stufen (jede Stufe kann einzeln wiederholt werden, Zwischenergebnisse liegen in
KRONE_FILM_WORK, Standard: /tmp/krone-film-work):

  neutral   je Shot: 4K-Original → Ausschnitt (-ss/-t) → 2112×1188 (Lanczos)
            → iPhone-HLG nach BT.709 (zscale/tonemap mobius) → vidstab 2-Pass bei
            Handaufnahmen → Zeitlupe/Tempo-Rampe (setpts, Quellen mit 60/120 fps)
            → 30 fps → libx264 crf 16 (work/neutral/NN.mp4). Teuerste Stufe
            (HEVC-4K-Dekodierung), ein Clip nach dem anderen.
  measure   mittlere Luma, mittleres RGB, Farbe der hellen Bildteile je Shot
            (work/measure.json) – Grundlage für die Angleichung.
  grade     Angleichung VOR dem gemeinsamen Look: Weißabgleich (colorchannelmixer,
            helle Bildteile neutral, Grau-Welt-Anteil) und Belichtung (eq gamma,
            teilweise Richtung Ziel-Luma), sanfter Push-in (cv2, subpixelgenau)
            auf 1920×1080, dann der Krone-Look aus docs/MEDIA.md
            (hqdn3d, eq, colorbalance, curves, unsharp, vignette)
            → work/graded/NN.mp4 (crf 16).
  assemble  eine xfade-Kette über alle Shots (filter_complex). Loop-Nahtstelle:
            der letzte Shot blendet in eine Kopie der ersten LOOP_HEAD Sekunden von
            Shot 1; anschließend werden genau diese LOOP_HEAD Sekunden vorne
            abgeschnitten, so dass Bild N direkt vor Bild 0 der nächsten
            Wiederholung liegt (kein Sprung) → work/master.mp4 (crf 16).
  encode    Master → krone-film.mp4 (≤ 30 MB) und krone-film-720.mp4 (≤ 14 MB): libx264
            preset slow, 2-Pass mit Bitrate aus der Zielgröße (maxrate 6M bzw. 2.6M als
            Obergrenze), GOP 60, faststart; poster.webp = erstes Bild (WebP q82).
  check     Kontaktbogen 1 fps (work/final-sheet.png), Nahtstellen-Vergleich
            (letztes vs. erstes Bild), Luma je Shot → work/check.json.
"""
from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
FF = os.environ.get(
    "KRONE_FFMPEG",
    "/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2",
)
ORIG = Path(os.environ.get("KRONE_ORIGINALS", HERE / "../icloud2/originals")).resolve()
WORK = Path(os.environ.get("KRONE_FILM_WORK", "/tmp/krone-film-work")).resolve()
OUT_DIR = REPO / "public/media/hero"

FPS = 30
IW, IH = 2112, 1188          # neutrale Zwischenstufe (10 % Reserve für den Push-in)
OW, OH = 1920, 1080
LOOP_HEAD = 1.5              # Sekunden von Shot 1, die als Loop-Nahtstelle ans Ende wandern (≥ LOOP_XF-Dauer)
THREADS = "4"

# iPhone HLG (BT.2020) → SDR BT.709 – identisch zu docs/MEDIA.md / tools/media/film.py
HLG = (
    "zscale=tin=arib-std-b67:min=bt2020nc:pin=bt2020:t=linear:npl=400,format=gbrpf32le,"
    "zscale=p=bt709,tonemap=mobius:param=0.35:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
)
# gemeinsamer Krone-Look (Reihenfolge wie in docs/MEDIA.md). Farboperationen (colorbalance,
# curves) laufen in RGB, der Rest in YUV – die Umrechnungen sind explizit BT.709.
TO_RGB = "scale=in_color_matrix=bt709:in_range=tv:flags=bicubic,format=gbrp"
TO_YUV = "scale=out_color_matrix=bt709:out_range=tv:flags=bicubic,format=yuv420p"
LOOK = (
    "hqdn3d=1.2:1.2:3:3,eq=contrast=1.07:saturation=1.10:gamma=0.97,"
    + TO_RGB
    + ",colorbalance=rs=0.02:bs=-0.02:rm=0.03:bm=-0.03:rh=0.02:bh=-0.03,"
    "curves=all='0/0.02 0.25/0.22 0.5/0.5 0.75/0.79 1/0.98',"
    + TO_YUV
    + ",unsharp=5:5:0.55:5:5:0,vignette=angle=PI/7:mode=forward"
)
COLOR_TAGS = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709"]

# Angleichung: Ziel-Luma (0–1, Mittelwert des Bildes) und Stärken
TARGET_LUMA = 0.44
LUMA_STRENGTH = 0.6          # 0 = keine Angleichung, 1 = jeder Shot exakt auf Ziel
WB_STRENGTH = 0.7            # Anteil der gemessenen Farbstich-Korrektur (helle Bildteile)
WB_GREY_WEIGHT = 0.3         # Anteil Grau-Welt (gesamtes Bild) an der Messung
WB_CLAMP = (0.90, 1.10)
GAMMA_CLAMP = (0.80, 1.30)

DJI = "dji_fly_20260930_{}_hdrvideo.mp4"

# ---------------------------------------------------------------------------------------
# Shotliste. tin/tout = Sekunden im Original. speed = Zeitlupenfaktor (2 = halbe
# Geschwindigkeit; Quellen mit 60/120 fps bleiben dabei flüssig), ramp = (s0, s1) linearer
# Übergang des Faktors über den Ausschnitt. push = (Zoom Anfang, Zoom Ende) relativ zum
# vollen Bild (1.0 = ganzes Bild, max. 1.10 ohne Hochskalieren), pan = (x, y) in −1…1 (Lage des
# Ausschnitts, wirkt nur bei Zoom > 1).
# xf/xd = xfade-Übergang IN diesen Shot (Dauer s). stab = vidstab (Handaufnahmen).
# luma/wb = manuelle Feinkorrektur zusätzlich zur Messung (Gamma-Faktor, RGB-Gain-Faktoren).
# ---------------------------------------------------------------------------------------
SHOTS: list[dict] = [
    dict(id="anflug", src=DJI.format("150512_53_1790805800515"), tin=43.5, tout=52.3,
         push=(1.0, 1.0), xf="fade", xd=1.2,
         show="Drohnen-Anflug über Leidersbach, Sinkflug auf die Fassade „Zur Krone“"),
    dict(id="fassade", src=DJI.format("150708_54_1790805028733"), tin=1.0, tout=6.5,
         push=(1.0, 1.03), xf="fade", xd=1.0,
         show="Fassade mit Schriftzug „Landhotel-Gasthof Zur Krone“, Sinkflug zum Eingang"),
    dict(id="tuer", src=DJI.format("152822_66_1790803640999"), tin=0.6, tout=6.3,
         push=(1.04, 1.07), pan=(1.0, 0.0), xf="zoomin", xd=0.9,
         show="Durch die Eingangstür in die Gaststube: Rundleuchten, gedeckte Tische"),
    dict(id="theke", src=DJI.format("151110_55_1790805277415"), tin=27.4, tout=29.6, speed=1.5, interp=True,
         push=(1.0, 1.0), xf="smoothleft", xd=0.8,
         show="Theke: Wandspruch, runder Tresen, Blick in die Gaststube (leicht verlangsamt)"),
    dict(id="nebenzimmer", src=DJI.format("150708_54_1790805028733"), tin=90.0, tout=95.5,
         push=(1.0, 1.0), xf="dissolve", xd=0.8,
         show="Nebenzimmer: lange Tafeln und Kachelofen"),
    dict(id="wintergarten", src=DJI.format("151644_56_1790805405809"), tin=53.5, tout=61.5,
         push=(1.0, 1.0), xf="circleopen", xd=1.0,
         show="Hero-Moment: Flug durch den Wintergarten, durch die Tür hinaus zur Sandsteinmauer"),
    dict(id="hof", src=DJI.format("152336_63_1790804111886"), tin=94.0, tout=99.0,
         push=(1.0, 1.0), xf="fade", xd=0.9,
         show="Biergarten unter der Weinlaube, Glasdach und Wintergarten"),
    dict(id="kueche", src="IMG_4803.MOV", tin=3.0, tout=5.6, stab=True, speed=2.0,
         push=(1.0, 1.04), xf="wipetl", xd=0.8,
         show="Küche: Herdblock unter der Haube (Zeitlupe)"),
    dict(id="fruehstueck", src=DJI.format("152932_68_1790803489040"), tin=24.2, tout=26.75, speed=1.4, interp=True,
         push=(1.0, 1.03), xf="fade", xd=0.8,
         show="Frühstücksbuffet (leicht verlangsamt)"),
    dict(id="treppe", src="IMG_4880.MOV", tin=2.0, tout=4.6, stab=True, speed=2.0,
         push=(1.0, 1.03), xf="hblur", xd=0.8,
         show="Treppenhaus: Kugelleuchten, schmiedeeisernes Geländer (Zeitlupe)"),
    dict(id="flur", src="IMG_4874.MOV", tin=7.2, tout=9.2, stab=True, speed=2.0,
         push=(1.0, 1.0), xf="smoothleft", xd=0.8,
         show="Hotelflur (Zeitlupe)"),
    dict(id="zimmer-tuer", src="IMG_4868.MOV", tin=4.0, tout=8.0, stab=True, speed=1.5, interp=True,
         push=(1.0, 1.0), xf="fade", xd=0.9,
         show="Die Tür geht auf: modernes Zimmer (Zeitlupe)"),
    dict(id="zimmer-bad", src="IMG_4869.MOV", tin=10.8, tout=12.8, stab=True, speed=2.0,
         push=(1.0, 1.0), xf="smoothup", xd=0.8,
         show="Modernes Zimmer: Bett am Fenster (Zeitlupe)"),
    dict(id="zimmer-klassisch", src="IMG_4870.MOV", tin=4.0, tout=6.3, stab=True, speed=2.0,
         push=(1.0, 1.0), xf="radial", xd=0.8,
         show="Klassisches Zimmer, Fahrt übers Bett (Zeitlupe)"),
    dict(id="kreis", src=DJI.format("151754_57_1790804541663"), tin=40.0, tout=46.0,
         push=(1.0, 1.0), xf="fade", xd=1.0,
         show="Kreisflug über Haus und Ort"),
    dict(id="dach", src=DJI.format("152108_62_1790804374296"), tin=76.0, tout=82.0,
         push=(1.0, 1.0), xf="smoothup", xd=1.0,
         show="Senkrecht von oben: Dach, Hof, Nachbarschaft"),
]
LOOP_XF = ("fade", 1.2)      # Übergang vom letzten Shot zurück in den Anfang (Nahtstelle)


# ---------------------------------------------------------------------------------------
def run(cmd: list[str], text: bool = True) -> subprocess.CompletedProcess:
    r = subprocess.run(cmd, capture_output=True, text=text)
    if r.returncode:
        err = r.stderr if text else r.stderr.decode("utf-8", "replace")
        sys.stderr.write(err[-3000:] + "\n")
        raise SystemExit(f"Befehl fehlgeschlagen: {' '.join(cmd[:6])} …")
    return r


def probe(path: Path) -> str:
    return subprocess.run([FF, "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr


def is_hlg(path: Path) -> bool:
    return "arib-std-b67" in probe(path)


def src_fps(path: Path) -> float:
    import re
    m = re.search(r"(\d+(?:\.\d+)?) fps", probe(path))
    return float(m.group(1)) if m else 30.0


def count_frames(path: Path) -> int:
    import re
    r = subprocess.run([FF, "-hide_banner", "-threads", THREADS, "-i", str(path), "-map", "0:v", "-vsync", "passthrough",
                        "-f", "null", "-"], capture_output=True, text=True)
    m = re.findall(r"frame=\s*(\d+)", r.stderr)
    return int(m[-1]) if m else 0


def shot_by_id(sid: str) -> dict:
    for s in SHOTS:
        if s["id"] == sid:
            return s
    raise SystemExit(f"unbekannter Shot {sid}")


def speed_filter(shot: dict, duration: float) -> str:
    """setpts-Ausdruck für konstante Zeitlupe oder lineare Tempo-Rampe (T = Quellzeit)."""
    if "ramp" in shot:
        s0, s1 = shot["ramp"]
        return f"setpts='(T*{s0}+T*T*{(s1 - s0) / (2 * duration):.6f})/TB'"
    s = shot.get("speed", 1.0)
    return f"setpts={s}*PTS" if s != 1.0 else "setpts=PTS"


# ------------------------------------------------------------------ Stufe 1: neutral ---
def stage_neutral(ids: list[str]) -> None:
    (WORK / "neutral").mkdir(parents=True, exist_ok=True)
    for shot in SHOTS:
        if ids and shot["id"] not in ids:
            continue
        src = ORIG / shot["src"]
        out = WORK / "neutral" / f"{shot['id']}.mp4"
        dur = shot["tout"] - shot["tin"]
        seg = ["-ss", f"{shot['tin']:.3f}", "-t", f"{dur:.3f}", "-i", str(src), "-an"]
        base = f"scale={IW}:{IH}:force_original_aspect_ratio=increase:flags=lanczos,crop={IW}:{IH}"
        base += "," + (HLG if is_hlg(src) else "format=yuv420p")
        chain = [base]
        if shot.get("stab"):
            trf = WORK / "neutral" / f"{shot['id']}.trf"
            print(f"[neutral] {shot['id']} vidstabdetect …", flush=True)
            run([FF, "-loglevel", "error", "-threads", THREADS, *seg,
                 "-vf", f"{base},vidstabdetect=shakiness=6:accuracy=15:stepsize=6:result={trf}",
                 "-f", "null", "-"])
            smoothing = int(round(src_fps(src)))      # ≈ 1 s Quellzeit (~30 Bilder bei 30 fps)
            chain.append(f"vidstabtransform=input={trf}:smoothing={smoothing}:optzoom=1:zoomspeed=0.15"
                         f":interpol=bicubic:crop=black")
        if shot.get("interp"):
            # 30-fps-Quelle: Zwischenbilder berechnen, damit die Zeitlupe gleichmäßig bleibt
            chain.append(f"minterpolate=fps={FPS * shot.get('speed', 1.0):g}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1")
        chain += ["setpts=PTS-STARTPTS", speed_filter(shot, dur), f"fps={FPS}"]
        print(f"[neutral] {shot['id']} {shot['src']} {shot['tin']}–{shot['tout']} …", flush=True)
        run([FF, "-loglevel", "error", "-threads", THREADS, *seg, "-vf", ",".join(chain),
             "-c:v", "libx264", "-crf", "16", "-preset", "fast", "-pix_fmt", "yuv420p", "-g", "30",
             *COLOR_TAGS, "-y", str(out)])
        print(f"[neutral] {shot['id']} → {count_frames(out)} Bilder, {out.stat().st_size / 1e6:.1f} MB", flush=True)


# ------------------------------------------------------------------ Stufe 2: measure ---
def sample_frames(path: Path, fps: float = 3, w: int = 192, h: int = 108) -> np.ndarray:
    r = run([FF, "-loglevel", "error", "-i", str(path), "-vf",
             f"fps={fps},scale={w}:{h}:in_color_matrix=bt709:in_range=tv,format=rgb24",
             "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], text=False)
    return np.frombuffer(r.stdout, np.uint8).reshape(-1, h, w, 3).astype(np.float32) / 255.0


def luma(rgb: np.ndarray) -> np.ndarray:
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def measure(path: Path) -> dict:
    fr = sample_frames(path)
    y = luma(fr)
    mean_rgb = fr.reshape(-1, 3).mean(0)
    # helle Bildteile (oberste 8 % der Luma, ohne Clipping) – dort sollten Weißtöne neutral sein
    flat = fr.reshape(-1, 3); yf = y.reshape(-1)
    hi = np.quantile(yf, 0.92)
    sel = (yf >= hi) & (yf < 0.98)
    bright = flat[sel].mean(0) if sel.sum() > 50 else mean_rgb
    return dict(
        luma=float(y.mean()), rgb=[float(v) for v in mean_rgb], bright=[float(v) for v in bright],
        clip=float((yf >= 0.98).mean()), p05=float(np.quantile(yf, 0.05)), p95=float(np.quantile(yf, 0.95)),
    )


def stage_measure(ids: list[str]) -> None:
    mfile = WORK / "measure.json"
    data = json.load(open(mfile)) if mfile.exists() else {}
    for shot in SHOTS:
        if ids and shot["id"] not in ids:
            continue
        data[shot["id"]] = measure(WORK / "neutral" / f"{shot['id']}.mp4")
        m = data[shot["id"]]
        print(f"[measure] {shot['id']} luma {m['luma']:.3f} rgb {np.round(m['rgb'], 3)} bright {np.round(m['bright'], 3)} clip {m['clip']:.3f}")
    json.dump(data, open(mfile, "w"), indent=1)


def correction(m: dict, shot: dict) -> tuple[float, float, float, float]:
    """(gain_r, gain_b, gamma, brightness) aus der Messung – Weißabgleich an hellen Bildteilen
    plus Grau-Welt-Anteil, Belichtung teilweise Richtung Ziel-Luma."""
    br, gw = np.array(m["bright"]), np.array(m["rgb"])
    ref = (1 - WB_GREY_WEIGHT) * br / br[1] + WB_GREY_WEIGHT * gw / gw[1]   # Verhältnis zu Grün
    gr = float(np.clip(ref[0] ** (-WB_STRENGTH), *WB_CLAMP)) * shot.get("wb", (1, 1, 1))[0]
    gb = float(np.clip(ref[2] ** (-WB_STRENGTH), *WB_CLAMP)) * shot.get("wb", (1, 1, 1))[2]
    y = max(1e-3, m["luma"])
    target = y ** (1 - LUMA_STRENGTH) * TARGET_LUMA ** LUMA_STRENGTH
    gamma = float(np.clip(math.log(y) / math.log(target), *GAMMA_CLAMP)) * shot.get("luma", 1.0)
    return gr, gb, gamma, 0.0


# -------------------------------------------------------------------- Stufe 3: grade ---
def ease(t: float) -> float:
    s = t * t * (3 - 2 * t)
    return 0.7 * t + 0.3 * s     # fast linear, leicht weich an den Enden – steht nie still


def stage_grade(ids: list[str]) -> None:
    import cv2
    (WORK / "graded").mkdir(parents=True, exist_ok=True)
    meas = json.load(open(WORK / "measure.json"))
    for shot in SHOTS:
        if ids and shot["id"] not in ids:
            continue
        src = WORK / "neutral" / f"{shot['id']}.mp4"
        out = WORK / "graded" / f"{shot['id']}.mp4"
        n = count_frames(src)
        gr, gb, gamma, bright = correction(meas[shot["id"]], shot)
        pre = f"colorchannelmixer=rr={gr:.4f}:bb={gb:.4f},{TO_YUV},eq=gamma={gamma:.4f}:brightness={bright:.4f}"
        print(f"[grade] {shot['id']} gain_r {gr:.3f} gain_b {gb:.3f} gamma {gamma:.3f} ({n} Bilder)", flush=True)
        dec = subprocess.Popen(
            [FF, "-loglevel", "error", "-i", str(src), "-vf",
             "scale=in_color_matrix=bt709:in_range=tv,format=rgb24", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            stdout=subprocess.PIPE)
        enc = subprocess.Popen(
            [FF, "-loglevel", "error", "-threads", THREADS, "-f", "rawvideo", "-pix_fmt", "rgb24",
             "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-", "-vf", f"{pre},{LOOK}",
             "-c:v", "libx264", "-crf", "16", "-preset", "fast", "-pix_fmt", "yuv420p", "-g", "30",
             *COLOR_TAGS, "-y", str(out)],
            stdin=subprocess.PIPE)
        z0, z1 = shot.get("push", (1.0, 1.0))
        px, py = shot.get("pan", (0.0, 0.0))
        size = IW * IH * 3
        i = 0
        while True:
            buf = dec.stdout.read(size)
            if len(buf) < size:
                break
            frame = np.frombuffer(buf, np.uint8).reshape(IH, IW, 3)
            t = i / max(1, n - 1)
            z = z0 + (z1 - z0) * ease(min(1.0, t))
            s = (IW / OW) / z                      # Quellpixel je Ausgabepixel (≤ 1.1, nie hochskaliert)
            cx = IW / 2 + px * (IW - OW * s) / 2
            cy = IH / 2 + py * (IH - OH * s) / 2
            M = np.array([[s, 0, cx - s * OW / 2], [0, s, cy - s * OH / 2]], np.float64)
            outf = cv2.warpAffine(frame, M, (OW, OH), flags=cv2.INTER_LANCZOS4 | cv2.WARP_INVERSE_MAP,
                                  borderMode=cv2.BORDER_REFLECT101)
            enc.stdin.write(outf.tobytes())
            i += 1
        dec.stdout.close(); enc.stdin.close()
        dec.wait(); enc.wait()
        if enc.returncode or dec.returncode:
            raise SystemExit(f"grade {shot['id']} fehlgeschlagen")
        print(f"[grade] {shot['id']} → {count_frames(out)} Bilder, {out.stat().st_size / 1e6:.1f} MB", flush=True)


# ----------------------------------------------------------------- Stufe 4: assemble ---
def timeline() -> list[dict]:
    """Dauer je Shot (aus den Zwischen-Dateien), Position im fertigen Film."""
    rows, pos = [], 0.0
    for k, shot in enumerate(SHOTS):
        n = count_frames(WORK / "graded" / f"{shot['id']}.mp4")
        dur = n / FPS
        if k == 0:
            start = 0.0
        else:
            start = pos - shot["xd"]
        rows.append(dict(id=shot["id"], frames=n, dur=dur, start=start))
        pos = start + dur
    return rows


def stage_assemble() -> None:
    rows = timeline()
    inputs: list[str] = []
    for shot in SHOTS:
        inputs += ["-i", str(WORK / "graded" / f"{shot['id']}.mp4")]
    inputs += ["-i", str(WORK / "graded" / f"{SHOTS[0]['id']}.mp4")]       # Kopie für die Nahtstelle
    n = len(SHOTS)
    head = int(round(LOOP_HEAD * FPS))
    # trim verliert die Bildrate (xfade verlangt gleiche Raten auf beiden Eingängen) → fps setzen
    parts = [f"[{n}:v]trim=end_frame={head},setpts=PTS-STARTPTS,fps={FPS}[loop]"]
    parts += [f"[{k}:v]fps={FPS}[v{k}]" for k in range(n)]
    prev = "[v0]"
    pos = rows[0]["dur"]
    for k in range(1, n):
        shot, row = SHOTS[k], rows[k]
        off = pos - shot["xd"]
        parts.append(f"{prev}[v{k}]xfade=transition={shot['xf']}:duration={shot['xd']}:offset={off:.4f}[x{k}]")
        prev = f"[x{k}]"
        pos = off + row["dur"]
    xf, xd = LOOP_XF
    off = pos - xd
    parts.append(f"{prev}[loop]xfade=transition={xf}:duration={xd}:offset={off:.4f}[xl]")
    # die ersten LOOP_HEAD Sekunden fallen weg: Bild N (= Shot-1-Zeit LOOP_HEAD − 1/30) liegt
    # damit direkt vor Bild 0 (= Shot-1-Zeit LOOP_HEAD) → nahtloser Loop
    parts.append(f"[xl]trim=start_frame={head},setpts=PTS-STARTPTS[out]")
    total = off                                   # = Summe der Shots − Übergänge − Loop-Blende
    print(f"[assemble] {n} Shots, Film ≈ {total:.2f} s", flush=True)
    run([FF, "-loglevel", "error", "-threads", THREADS, *inputs, "-filter_complex", ";".join(parts),
         "-map", "[out]", "-c:v", "libx264", "-crf", "16", "-preset", "fast", "-pix_fmt", "yuv420p",
         "-r", str(FPS), *COLOR_TAGS, "-an", "-y", str(WORK / "master.mp4")])
    frames = count_frames(WORK / "master.mp4")
    print(f"[assemble] master.mp4: {frames} Bilder = {frames / FPS:.2f} s", flush=True)
    json.dump(dict(rows=rows, total=frames / FPS, loop_head=LOOP_HEAD), open(WORK / "timeline.json", "w"), indent=1)


# ------------------------------------------------------------------- Stufe 5: encode ---
# Die Zielgrößen (≤ 30 MB / ≤ 14 MB) sind bei ≈ 73 s detailreichem Drohnenmaterial mit crf 23 /
# maxrate 6M nicht erreichbar (≈ 50 MB). Deshalb 2-Pass mit Bitrate aus der Zielgröße: so verteilt
# x264 das Budget über den ganzen Film (ruhige Innenräume geben ab, Dach/Bäume bekommen mehr),
# statt dass ein hoher crf alles gleichmäßig weichzeichnet. Alle übrigen Parameter wie vorgegeben
# (preset slow, yuv420p, faststart, GOP 60, stumm).
def encode(dst: Path, maxrate_cap: str, scale: str | None, limit_mb: float) -> None:
    dur = count_frames(WORK / "master.mp4") / FPS
    budget = limit_mb * 1e6 * 0.96                         # 4 % Reserve für Container/Rundung
    cap = float(maxrate_cap.rstrip("M")) * 1e6
    for attempt in range(4):
        kbps = int(budget * 8 / dur / 1000)
        maxrate = int(min(cap, kbps * 1.5e3) / 1000)
        vf = ["-vf", scale] if scale else []
        common = [FF, "-loglevel", "error", "-threads", THREADS, "-y", "-i", str(WORK / "master.mp4"), *vf,
                  "-c:v", "libx264", "-preset", "slow", "-b:v", f"{kbps}k", "-maxrate", f"{maxrate}k",
                  "-bufsize", f"{2 * maxrate}k", "-pix_fmt", "yuv420p", "-g", "60", "-an", *COLOR_TAGS,
                  "-passlogfile", str(WORK / f"x264-{dst.stem}")]
        run([*common, "-pass", "1", "-f", "null", "/dev/null"])
        run([*common, "-pass", "2", "-movflags", "+faststart", str(dst)])
        mb = dst.stat().st_size / 1e6
        print(f"[encode] {dst.name}: 2-pass {kbps} kbit/s (max {maxrate}k) → {mb:.2f} MB", flush=True)
        if mb <= limit_mb:
            return
        budget *= limit_mb / mb * 0.98
    raise SystemExit(f"{dst.name} bleibt über {limit_mb} MB")


def stage_encode() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    encode(OUT_DIR / "krone-film.mp4", "6M", None, 30.0)
    encode(OUT_DIR / "krone-film-720.mp4", "2.6M", "scale=1280:720:flags=lanczos", 14.0)
    # Poster = erstes Bild des Films (aus dem Master, ungestört von der Endkompression)
    from PIL import Image
    r = run([FF, "-loglevel", "error", "-i", str(WORK / "master.mp4"), "-frames:v", "1", "-vf",
             "scale=in_color_matrix=bt709:in_range=tv,format=rgb24", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            text=False)
    im = Image.frombytes("RGB", (OW, OH), r.stdout)
    im.save(OUT_DIR / "poster.webp", quality=82, method=6)
    print(f"[encode] poster.webp {os.path.getsize(OUT_DIR / 'poster.webp') / 1e3:.0f} kB", flush=True)


# -------------------------------------------------------------------- Stufe 6: check ---
def stage_check() -> None:
    from PIL import Image, ImageDraw, ImageFont
    final = OUT_DIR / "krone-film.mp4"
    # Nahtstelle: letztes Bild vs. erstes Bild (sollte wie ein normaler Bildschritt aussehen)
    def frames_rgb(path: Path, vf: str, count: int) -> np.ndarray:
        r = run([FF, "-loglevel", "error", "-i", str(path), "-vf", vf + ",scale=in_color_matrix=bt709:in_range=tv,format=rgb24",
                 "-frames:v", str(count), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], text=False)
        return np.frombuffer(r.stdout, np.uint8).reshape(-1, OH, OW, 3).astype(np.float32)
    n = count_frames(final)
    first = frames_rgb(final, "select='lte(n\\,1)'", 2)
    last = frames_rgb(final, f"select='gte(n\\,{n - 2})'", 2)
    d_seam = float(np.abs(last[-1] - first[0]).mean())
    d_step = float(np.abs(first[1] - first[0]).mean())
    d_step2 = float(np.abs(last[1] - last[0]).mean())
    print(f"[check] {n} Bilder = {n / FPS:.2f} s; Nahtstelle |letztes−erstes| = {d_seam:.2f}, "
          f"normale Bildschritte {d_step:.2f} / {d_step2:.2f} (8-bit, Mittel)")
    # Luma je Shot (gegradete Zwischenstufen)
    lum = {}
    for shot in SHOTS:
        g = WORK / "graded" / f"{shot['id']}.mp4"
        if g.exists():
            lum[shot["id"]] = round(float(luma(sample_frames(g)).mean()), 3)
    print("[check] Luma je Shot (graded):", lum)
    # Kontaktbogen 1 fps
    tw, th, cols = 320, 180, 8
    r = run([FF, "-loglevel", "error", "-i", str(final), "-vf", f"fps=1,scale={tw}:{th}:in_color_matrix=bt709:in_range=tv,format=rgb24",
             "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], text=False)
    tiles = np.frombuffer(r.stdout, np.uint8).reshape(-1, th, tw, 3)
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw, rows * th), "black")
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.load_default(size=18)
    except TypeError:
        font = ImageFont.load_default()
    for k, t in enumerate(tiles):
        x, y = (k % cols) * tw, (k // cols) * th
        sheet.paste(Image.fromarray(t), (x, y))
        d.rectangle([x, y, x + 60, y + 22], fill=(0, 0, 0))
        d.text((x + 4, y + 2), f"{k:3d}s", fill=(255, 230, 120), font=font)
    sheet.save(WORK / "final-sheet.png")
    json.dump(dict(frames=n, seconds=n / FPS, seam_diff=d_seam, step_diff=[d_step, d_step2], luma=lum,
                   sizes={p.name: p.stat().st_size for p in OUT_DIR.glob("krone-film*.mp4")}),
              open(WORK / "check.json", "w"), indent=1)
    print(f"[check] Kontaktbogen → {WORK / 'final-sheet.png'}")


STAGES = {"neutral": stage_neutral, "measure": stage_measure, "grade": stage_grade,
          "assemble": stage_assemble, "encode": stage_encode, "check": stage_check}

if __name__ == "__main__":
    args = sys.argv[1:]
    stages = [a for a in args if a in STAGES] or list(STAGES)
    ids = [a for a in args if a not in STAGES]
    WORK.mkdir(parents=True, exist_ok=True)
    for st in stages:
        if st in ("neutral", "measure", "grade"):
            STAGES[st](ids)
        else:
            STAGES[st]()
