"""Cinematic, consistent grade for all website photos.
Per image: auto levels (percentile stretch) → gray-world white balance blended toward a warm
target → luminance normalisation → Krone LOOK (contrast, saturation, warm/cool split, S-curve)
→ gentle vignette → output-size-aware sharpening. Same look for every image, so the gallery
reads as one series. usage: grade3.py <src> <out.webp> <w> <h> [cx cy]  (cx,cy = crop focus 0..1)"""
import sys, json, subprocess, os
import numpy as np
from PIL import Image, ImageOps, ImageFilter
import pillow_heif, imageio_ffmpeg
pillow_heif.register_heif_opener()
FF = imageio_ffmpeg.get_ffmpeg_exe()
IC = os.environ.get("KRONE_ORIGINALS", os.path.join(os.path.dirname(os.path.abspath(__file__)), "../icloud2/"))  # catalog.json + originals/ (not in git)
cat = {i["id"]: i for i in json.load(open(IC + "catalog.json"))["items"]}
LOOK = ("eq=contrast=1.08:saturation=1.08:gamma=0.98,"
        "colorbalance=rs=0.03:bs=-0.03:rm=0.02:bm=-0.04:rh=0.01:bh=-0.04,"
        "curves=all='0/0.015 0.2/0.17 0.5/0.5 0.8/0.84 1/0.985'")

def load(src):
    if src.startswith("F"):
        im = ImageOps.exif_transpose(Image.open(IC + "originals/" + cat[src]["file"]))
    elif "@" in src:  # video frame V22@37.0
        vid, t = src.split("@"); it = cat[vid]
        hdr = "arib-std-b67" in subprocess.run([FF, "-hide_banner", "-i", IC + "originals/" + it["file"]], capture_output=True, text=True).stderr
        tm = "zscale=tin=arib-std-b67:min=bt2020nc:pin=bt2020:t=linear:npl=200,format=gbrpf32le,zscale=p=bt709,tonemap=mobius:param=0.35:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p," if hdr else ""
        tmp = "/tmp/frame.png"
        subprocess.run([FF, "-loglevel", "error", "-ss", t, "-i", IC + "originals/" + it["file"], "-frames:v", "1", "-vf", tm + "format=rgb24", "-y", tmp], check=True)
        im = Image.open(tmp)
    else:
        im = ImageOps.exif_transpose(Image.open(src))
    return im.convert("RGB")

def normalise(im):
    a = np.asarray(im).astype(np.float32) / 255
    # auto levels on luminance percentiles
    lum = a @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    lo, hi = np.percentile(lum, 0.4), np.percentile(lum, 99.6)
    a = np.clip((a - lo) / max(1e-3, hi - lo), 0, 1)
    # gray-world white balance, blended 60 % toward neutral with a slight warm bias
    mean = a.reshape(-1, 3).mean(0)
    target = np.array([1.02, 1.0, 0.97], np.float32) * mean.mean()
    gain = 1 + 0.6 * (target / np.maximum(mean, 1e-3) - 1)
    a = np.clip(a * gain, 0, 1)
    # luminance normalisation toward 0.46 (gamma), keeps highlights
    m = (a @ np.array([0.2126, 0.7152, 0.0722], np.float32)).mean()
    g = np.log(0.46) / np.log(max(0.05, min(0.95, m)))
    g = float(np.clip(g, 0.75, 1.35))
    a = np.power(a, g)
    return Image.fromarray((a * 255).round().astype(np.uint8))

def main(src, out, w, h, cx=0.5, cy=0.5):
    im = normalise(load(src))
    # crop to aspect around the focus point, at ≥ 1.25× output for clean downscale
    W, H = im.size; ar = w / h
    cw, ch = (W, int(W / ar)) if W / H > ar else (int(H * ar), H)
    if W / H > ar: cw = int(H * ar)
    else: ch = int(W / ar)
    x0 = int(min(max(0, cx * W - cw / 2), W - cw)); y0 = int(min(max(0, cy * H - ch / 2), H - ch))
    im = im.crop((x0, y0, x0 + cw, y0 + ch))
    big = (max(w, int(w * 1.25)), max(h, int(h * 1.25)))
    im = im.resize(big, Image.LANCZOS) if im.width < big[0] else im.resize(big, Image.LANCZOS)
    tmp_in, tmp_out = "/tmp/g_in.png", "/tmp/g_out.png"
    im.save(tmp_in)
    subprocess.run([FF, "-loglevel", "error", "-i", tmp_in, "-vf", f"{LOOK},hqdn3d=1.0:1.0:3:3,vignette=angle=PI/7.5:mode=forward,scale={w}:{h}:flags=lanczos", "-y", tmp_out], check=True)
    res = Image.open(tmp_out).convert("RGB").filter(ImageFilter.UnsharpMask(radius=1.0, percent=60, threshold=2))
    res.save(out, quality=84, method=6)
    print(out, f"{os.path.getsize(out)//1000} KB")

if __name__ == "__main__":
    a = sys.argv[1:]
    main(a[0], a[1], int(a[2]), int(a[3]), *(float(x) for x in a[4:6]))
