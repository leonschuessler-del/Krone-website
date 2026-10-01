"""Find the calmest segment per candidate video: equal motion, low jerk."""
import json, subprocess, sys, numpy as np, cv2, imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
import os
IC = os.environ.get("KRONE_ORIGINALS", "originals-folder/")
cat = {i["id"]: i for i in json.load(open(IC + "catalog.json"))["items"]}
W, H, FPS = 480, 270, 15

def series(vid):
    p = subprocess.run([FF, "-loglevel", "error", "-i", IC + "originals/" + cat[vid]["file"], "-vf", f"fps={FPS},scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True)
    fr = np.frombuffer(p.stdout, np.uint8).reshape(-1, H, W)
    out = []
    for a, b in zip(fr, fr[1:]):
        pts = cv2.goodFeaturesToTrack(a, 300, 0.01, 6); m = None
        if pts is not None and len(pts) > 20:
            n, st, _ = cv2.calcOpticalFlowPyrLK(a, b, pts, None); ok = st.reshape(-1) == 1
            if ok.sum() > 20: m, _ = cv2.estimateAffinePartial2D(pts[ok], n[ok], method=cv2.RANSAC, ransacReprojThreshold=1.5)
        out.append([0, 0, 0, 0] if m is None else [m[0, 2], m[1, 2], np.arctan2(m[1, 0], m[0, 0]) * W / 2, np.log(np.hypot(m[0, 0], m[1, 0])) * W / 2])
    return np.array(out)

def best(vid, target, minlen=3, maxlen=None):
    s = series(vid)
    np.save(f"/tmp/an_{vid}.npy", s)
    mag = np.linalg.norm(s, axis=1)
    # jitter = high-frequency part of the path (difference to a smoothed version)
    k = np.ones(9) / 9
    smooth = np.stack([np.convolve(s[:, j], k, mode="same") for j in range(4)], 1)
    hf = np.linalg.norm(s - smooth, axis=1)
    res = []
    n = len(mag)
    maxlen = maxlen or n / FPS
    for a in range(0, n - int(minlen * FPS), 3):
        c = np.cumsum(mag[a:])
        e = a + int(np.searchsorted(c, target))
        if e >= n or (e - a) / FPS < minlen or (e - a) / FPS > maxlen: continue
        seg = slice(a, e)
        score = hf[seg].mean() / max(1e-6, mag[seg].mean()) + 0.5 * mag[seg].std() / max(1e-6, mag[seg].mean())
        res.append((score, a / FPS, e / FPS, hf[seg].mean(), mag[seg].mean()))
    res.sort()
    return res[:3], n / FPS

if __name__ == "__main__":
    target = float(sys.argv[1])  # total motion in px (480 wide) for the chapter
    for vid in sys.argv[2:]:
        r, dur = best(vid, target)
        print(vid, f"dur {dur:.0f}s", [(round(x[1], 1), round(x[2], 1), round(x[0], 3)) for x in r], flush=True)
