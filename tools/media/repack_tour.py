"""Re-encode an existing scroll-film frame set to a smaller size, keeping the
frame count and pack structure (PACK frames per vertical strip, pNN.webp +
poster.webp). Used to bring the phone set from 810x1440 down to 720x1280
without re-running the whole grading pipeline (tools/media/film3.py produces
the same sizes from the originals).

usage: python3 tools/media/repack_tour.py [set=m] [W H] [chapter ...]
       (run from the repo root; skips sets that already have the target size)
"""
import glob, json, os, sys
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
FRAMES = os.path.join(ROOT, "public/media/tour/frames")
MANIFEST = os.path.join(ROOT, "src/generated/tour-frames.json")
PACK = 6                      # must match src/features/home/tour-player.ts
Q = 66                        # pack quality (film3.py: Q["m"])
QCH = {"intro": 60, "finale": 60}
POSTER_Q = 82
# a light unsharp mask keeps the downscaled frames as crisp as the originals
SHARP = ImageFilter.UnsharpMask(radius=0.8, percent=35, threshold=2)


def repack(cid, key, W, H, count):
    d = os.path.join(FRAMES, cid, key)
    poster = Image.open(os.path.join(d, "poster.webp"))
    if poster.size == (W, H):
        print(cid, key, "already", W, "x", H)
        return
    sw, sh = poster.size
    packs = sorted(glob.glob(os.path.join(d, "p[0-9]*.webp")))
    assert len(packs) == -(-count // PACK), (cid, len(packs), count)
    before = sum(os.path.getsize(p) for p in packs)
    q = QCH.get(cid, Q)
    for i, path in enumerate(packs):
        im = Image.open(path).convert("RGB")
        rows = min(PACK, count - i * PACK)
        assert im.size == (sw, sh * rows), (path, im.size)
        sheet = Image.new("RGB", (W, H * rows))
        for k in range(rows):
            f = im.crop((0, k * sh, sw, (k + 1) * sh)).resize((W, H), Image.LANCZOS).filter(SHARP)
            sheet.paste(f, (0, k * H))
        sheet.save(path, quality=q, method=6)
    poster.convert("RGB").resize((W, H), Image.LANCZOS).filter(SHARP).save(os.path.join(d, "poster.webp"), quality=POSTER_Q, method=6)
    after = sum(os.path.getsize(p) for p in packs)
    print(f"{cid} {key}: {count} frames {sw}x{sh} -> {W}x{H}  {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB", flush=True)


if __name__ == "__main__":
    args = sys.argv[1:]
    key = args.pop(0) if args else "m"
    W, H = (int(args.pop(0)), int(args.pop(0))) if len(args) >= 2 and args[0].isdigit() else (720, 1280)
    counts = json.load(open(MANIFEST))
    for cid in args or sorted(counts):
        repack(cid, key, W, H, counts[cid])
