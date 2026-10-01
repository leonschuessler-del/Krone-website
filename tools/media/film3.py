"""Scroll-film frames v3: same shots/segments as v2, but processed at 2560x1440
and exported as two sets: desktop 1920x1080 (16:9) and mobile 810x1440 (9:16
centre crop) – phones no longer upscale a 1600-px strip 3x.
usage: python3 film3.py <chapter> [...]   (REUSE=1 reuses tmp3-<cid> frames)"""
import json, os, sys, glob, shutil
import numpy as np, cv2
from PIL import Image, ImageFilter, ImageOps
import film as v2   # tools/media/film.py: PLAN, LOOK, HLG, helpers

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = "/home/user/Krone-website/public/media/tour/frames"
MANIFEST = "/home/user/Krone-website/src/generated/tour-frames.json"
IW, IH = 2560, 1440
SETS = {"d": (1920, 1080), "m": (810, 1440)}
PACK = 6            # must match src/features/home/tour-player.ts
STEP = 9.0
Q = {"d": 58, "m": 64}
QCH = {"intro": {"d": 50, "m": 56}, "finale": {"d": 50, "m": 56}}
SHARP = ImageFilter.UnsharpMask(radius=1.1, percent=55, threshold=2)


def emit(cid, imgs, mx=0.5):
    d = f"{OUT}/{cid}"
    shutil.rmtree(d, ignore_errors=True)
    n = len(imgs)
    for key, (w, h) in SETS.items():
        os.makedirs(f"{d}/{key}")
        q = QCH.get(cid, Q)[key]
        frames = []
        for im in imgs:
            if key == "m":
                cw = int(im.height * w / h)
                x0 = int(min(max(0, im.width * mx - cw / 2), im.width - cw))
                im = im.crop((x0, 0, x0 + cw, im.height))
            frames.append(im.resize((w, h), Image.LANCZOS).filter(SHARP))
        for p in range(0, n, PACK):
            part = frames[p:p + PACK]
            sheet = Image.new("RGB", (w, h * len(part)))
            for k, f in enumerate(part): sheet.paste(f, (0, k * h))
            sheet.save(f"{d}/{key}/p{p // PACK:02d}.webp", quality=q, method=6)
        frames[0].save(f"{d}/{key}/poster.webp", quality=82, method=6)
    man = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}
    man[cid] = n
    json.dump(dict(sorted(man.items())), open(MANIFEST, "w"), indent=2)
    sz = {k: sum(os.path.getsize(x) for x in glob.glob(f"{d}/{k}/*.webp")) / 1e6 for k in SETS}
    print(cid, n, "frames", {k: f"{v:.1f} MB" for k, v in sz.items()}, flush=True)


def kenburns(cid, p):
    if p["kb"].startswith("@"):
        im = Image.open(p["kb"][1:]).convert("RGB")
    else:
        im = ImageOps.exif_transpose(Image.open(v2.IC + "originals/" + v2.cat[p["kb"]]["file"])).convert("RGB")
    tmp = f"{HERE}/tmp3-{cid}"; os.makedirs(tmp, exist_ok=True)
    if not p.get("graded"):
        im.save(f"{tmp}/src.png")
        v2.run([v2.FF, "-loglevel", "error", "-i", f"{tmp}/src.png", "-vf", v2.LOOK, "-y", f"{tmp}/g.png"])
        im = Image.open(f"{tmp}/g.png").convert("RGB")
    w, h = im.size
    if w / h > 16 / 9:
        cw = int(h * 16 / 9); im = im.crop(((w - cw) // 2, 0, (w - cw) // 2 + cw, h))
    else:
        ch = int(w * 9 / 16); im = im.crop((0, (h - ch) // 2, w, (h - ch) // 2 + ch))
    if im.width < IW * 1.25:
        im = im.resize((int(IW * 1.25), int(IW * 1.25 * 9 / 16)), Image.LANCZOS)
    n = p["n"]; z0, z1 = p["z"]
    out = []
    for k in range(n):
        t = k / (n - 1); e = t * t * (3 - 2 * t) * 0.6 + t * 0.4
        z = z0 + (z1 - z0) * e
        cx = (p["c0"][0] + (p["c1"][0] - p["c0"][0]) * e) * im.width
        cy = (p["c0"][1] + (p["c1"][1] - p["c0"][1]) * e) * im.height
        cw, ch = im.width / z, im.height / z
        x0 = min(max(0, cx - cw / 2), im.width - cw); y0 = min(max(0, cy - ch / 2), im.height - ch)
        out.append(im.crop((x0, y0, x0 + cw, y0 + ch)).resize((IW, IH), Image.LANCZOS))
    shutil.rmtree(tmp, ignore_errors=True)
    emit(cid, out, p.get("mx", 0.5))


def video(cid, p):
    src = v2.IC + "originals/" + v2.cat[p["vid"]]["file"]
    tmp = f"{HERE}/tmp3-{cid}"
    if not (os.environ.get("REUSE") and glob.glob(f"{tmp}/*.jpg")):
        shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
        base = (v2.HLG + "," if v2.is_hlg(src) else "") + f"scale={IW}:{IH}:force_original_aspect_ratio=increase:flags=lanczos,crop={IW}:{IH}"
        seg = ["-ss", str(p["start"]), "-t", str(p["end"] - p["start"]), "-i", src]
        trf = f"{tmp}/t.trf"
        v2.run([v2.FF, "-loglevel", "error", *seg, "-an", "-vf", f"{base},vidstabdetect=shakiness=7:accuracy=15:stepsize=6:result={trf}", "-f", "null", "-"])
        vf = (f"{base},vidstabtransform=input={trf}:smoothing={p['smoothing']}:optzoom=1:zoomspeed=0.15:interpol=bicubic:crop=black,"
              f"hqdn3d=1.2:1.2:3:3,{v2.LOOK}")
        v2.run([v2.FF, "-loglevel", "error", *seg, "-an", "-vf", vf, "-q:v", "3", f"{tmp}/%05d.jpg"])
    frames = sorted(glob.glob(f"{tmp}/*.jpg"))
    if p.get("reverse"):
        frames = frames[::-1]
    steps, wpx = v2.affine_steps(frames)
    half = wpx / 2
    mag = np.sqrt(steps[:, 0] ** 2 + steps[:, 1] ** 2 + (steps[:, 2] * half) ** 2 + (steps[:, 3] * half) ** 2)
    mag = v2._gauss(mag[:, None], 3.0)[:, 0] + 1e-3
    cum = np.cumsum(mag); cum = (cum - cum[0]) / (cum[-1] - cum[0])
    total = float(mag.sum() - mag[0])
    n = p.get("n") or int(np.clip(round(total / STEP), 40, 200))
    picks = [int(np.argmin(np.abs(cum - k / (n - 1)))) for k in range(n)]
    sharp = {}
    def sharpness(i):
        if i not in sharp:
            g = cv2.imread(frames[i], cv2.IMREAD_REDUCED_GRAYSCALE_4)
            sharp[i] = float(cv2.Laplacian(g, cv2.CV_32F).var())
        return sharp[i]
    rad = max(1, int(len(frames) / n / 2))
    out = []
    for i in picks:
        lo = max(0, i - rad, out[-1] + 1 if out else 0); hi = min(len(frames) - 1, i + rad)
        out.append(max(range(lo, max(lo, hi) + 1), key=lambda j: sharpness(j) * (1 - 0.08 * abs(j - i) / rad)))
    emit(cid, [Image.open(frames[i]).convert("RGB") for i in out], p.get("mx", 0.5))


if __name__ == "__main__":
    for cid in sys.argv[1:]:
        p = v2.PLAN[cid]
        (kenburns if "kb" in p else video)(cid, p)
