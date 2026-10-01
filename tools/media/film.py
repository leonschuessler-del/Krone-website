"""Scroll-film frames v2: 4K original → (HLG tonemap) → vidstab 2-pass → grade → 1600x900
→ motion-equalised selection of N frames → WebP.  usage: python3 film.py <chapter> [...]"""
import json, os, subprocess, sys, glob, shutil
import numpy as np, cv2
from PIL import Image
import imageio_ffmpeg, pillow_heif
pillow_heif.register_heif_opener()
FF = imageio_ffmpeg.get_ffmpeg_exe()
HERE = os.path.dirname(os.path.abspath(__file__))
IC = os.environ.get("KRONE_ORIGINALS", os.path.join(HERE, "../icloud2/"))  # folder with catalog.json + originals/ (not in git)
cat = {i["id"]: i for i in json.load(open(IC + "catalog.json"))["items"]}
OUT = "/home/user/Krone-website/public/media/tour/frames"
W, H = 1600, 900
HLG = "zscale=tin=arib-std-b67:min=bt2020nc:pin=bt2020:t=linear:npl=400,format=gbrpf32le,zscale=p=bt709,tonemap=mobius:param=0.35:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
LOOK = ("eq=contrast=1.07:saturation=1.10:gamma=0.97,"
        "colorbalance=rs=0.02:bs=-0.02:rm=0.03:bm=-0.03:rh=0.02:bh=-0.03,"
        "curves=all='0/0.02 0.25/0.22 0.5/0.5 0.75/0.79 1/0.98'")

# chapter → source + segment (seconds) + options
PLAN = {
    "intro":         dict(vid="V01", start=23, end=52, n=48, smoothing=60),
    "restaurant":    dict(vid="V04", start=6, end=30, n=40, smoothing=45),
    "side-room":     dict(vid="V27", start=0, end=6, n=40, smoothing=30),
    "stage":         dict(vid="V22", start=33, end=41, n=40, smoothing=30),
    "winter-garden": dict(vid="V18", start=0, end=6, n=40, smoothing=30),
    "hotel":         dict(vid="V40", start=6.5, end=16, n=40, smoothing=40),
    "beer-garden":   dict(kb="F122", n=40, z=(1.0, 1.22), c0=(0.5, 0.55), c1=(0.47, 0.62)),
    "old-tavern":    dict(kb="F028", n=40, z=(1.0, 1.16), c0=(0.5, 0.5), c1=(0.56, 0.54)),
    "kitchen":       dict(kb="@" + os.environ.get("KRONE_KITCHEN_CLEAN", "k_clean1.png"), graded=True, n=40, z=(1.0, 1.14), c0=(0.5, 0.52), c1=(0.53, 0.52)),
    "finale":        dict(vid="V06", start=60, end=97, n=48, smoothing=60, reverse=True),
}

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print(r.stderr[-1500:]); raise SystemExit(1)
    return r

def is_hlg(path):
    return "arib-std-b67" in subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True).stderr

def kenburns(cid, p):
    from PIL import ImageOps
    tmp = f"{HERE}/tmp-{cid}"; os.makedirs(tmp, exist_ok=True)
    if p["kb"].startswith("@"):
        im = Image.open(p["kb"][1:]).convert("RGB")
    else:
        im = ImageOps.exif_transpose(Image.open(IC + "originals/" + cat[p["kb"]]["file"])).convert("RGB")
    if not p.get("graded"):
        im.save(f"{tmp}/src.png")
        run([FF, "-loglevel", "error", "-i", f"{tmp}/src.png", "-vf", f"{LOOK},unsharp=5:5:0.5:5:5:0,vignette=angle=PI/7:mode=forward", "-y", f"{tmp}/g.png"])
        im = Image.open(f"{tmp}/g.png").convert("RGB")
    # 16:9 base crop, upscale small sources so the push stays crisp
    w, h = im.size
    if w / h > 16 / 9:
        cw = int(h * 16 / 9); im = im.crop(((w - cw) // 2, 0, (w - cw) // 2 + cw, h))
    else:
        ch = int(w * 9 / 16); im = im.crop((0, (h - ch) // 2, w, (h - ch) // 2 + ch))
    if im.width < W * 1.4:
        im = im.resize((int(W * 1.4), int(W * 1.4 * 9 / 16)), Image.LANCZOS)
    n = p["n"]; z0, z1 = p["z"]
    d = f"{OUT}/{cid}"; os.makedirs(d, exist_ok=True)
    for f in glob.glob(d + "/*.webp"): os.remove(f)
    for k in range(n):
        t = k / (n - 1); e = t * t * (3 - 2 * t) * 0.6 + t * 0.4   # gentle ease, never stops
        z = z0 + (z1 - z0) * e
        cx = (p["c0"][0] + (p["c1"][0] - p["c0"][0]) * e) * im.width
        cy = (p["c0"][1] + (p["c1"][1] - p["c0"][1]) * e) * im.height
        cw, ch = im.width / z, im.height / z
        x0 = min(max(0, cx - cw / 2), im.width - cw); y0 = min(max(0, cy - ch / 2), im.height - ch)
        im.crop((x0, y0, x0 + cw, y0 + ch)).resize((W, H), Image.LANCZOS).save(f"{d}/{k:02d}.webp", quality=74, method=6)
    shutil.rmtree(tmp, ignore_errors=True)
    print(cid, "kenburns →", n, f"{sum(os.path.getsize(x) for x in glob.glob(d + '/*.webp'))/1e6:.1f} MB", flush=True)

def build(cid, p):
    if "kb" in p:
        return kenburns(cid, p)
    src = IC + "originals/" + cat[p["vid"]]["file"]
    tmp = f"{HERE}/tmp-{cid}"
    shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    base = (HLG + "," if is_hlg(src) else "") + "scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080"
    seg = ["-ss", str(p["start"]), "-t", str(p["end"] - p["start"]), "-i", src]
    trf = f"{tmp}/t.trf"
    run([FF, "-loglevel", "error", *seg, "-an", "-vf", f"{base},vidstabdetect=shakiness=7:accuracy=15:stepsize=6:result={trf}", "-f", "null", "-"])
    vf = (f"{base},vidstabtransform=input={trf}:smoothing={p['smoothing']}:optzoom=1:zoomspeed=0.15:interpol=bicubic:crop=black,"
          f"hqdn3d=1.5:1.5:3:3,{LOOK},scale={W}:{H}:flags=lanczos,unsharp=5:5:0.7:5:5:0,vignette=angle=PI/7:mode=forward")
    run([FF, "-loglevel", "error", *seg, "-an", "-vf", vf, "-q:v", "2", f"{tmp}/%05d.jpg"])
    frames = sorted(glob.glob(f"{tmp}/*.jpg"))
    if p.get("reverse"):
        frames = frames[::-1]
    # motion-equalised selection: equal visual motion per scroll step
    prev = None; motion = [0.0]
    for f in frames:
        g = cv2.cvtColor(cv2.resize(cv2.imread(f), (320, 180)), cv2.COLOR_BGR2GRAY).astype(np.float32)
        if prev is not None:
            flow = cv2.calcOpticalFlowFarneback(prev, g, None, 0.5, 3, 15, 3, 5, 1.2, 0)
            motion.append(float(np.median(np.linalg.norm(flow, axis=2))) + 0.02)
        prev = g
    cum = np.cumsum(motion); cum = cum / cum[-1]
    t = np.linspace(0, 1, len(frames))
    mix = 0.75 * cum + 0.25 * t                     # mostly motion, a bit of time
    n = p["n"]
    picks = [int(np.argmin(np.abs(mix - k / (n - 1)))) for k in range(n)]
    d = f"{OUT}/{cid}"; os.makedirs(d, exist_ok=True)
    for f in glob.glob(d + "/*.webp"): os.remove(f)
    for k, i in enumerate(picks):
        Image.open(frames[i]).convert("RGB").save(f"{d}/{k:02d}.webp", quality=72, method=6)
    size = sum(os.path.getsize(x) for x in glob.glob(d + "/*.webp"))
    shutil.rmtree(tmp, ignore_errors=True)
    print(cid, len(frames), "→", n, f"{size/1e6:.1f} MB", flush=True)

if __name__ == "__main__":
    for cid in sys.argv[1:]:
        build(cid, PLAN[cid])
