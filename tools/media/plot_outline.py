import cv2, json, numpy as np
import os
u = cv2.imread(os.environ.get("KRONE_PLOT_DRAWING", "plot-drawing.jpg"))  # owner's drawing on drone photo F054 (not in git)
hsv = cv2.cvtColor(u, cv2.COLOR_BGR2HSV)
mk = cv2.inRange(hsv, np.array((118, 40, 40)), np.array((165, 255, 255)))
ys, xs = np.nonzero(mk); P = np.stack([xs, ys], 1).astype(float)
est = [(600, 390), (640, 384), (760, 372), (842, 368), (960, 418), (1082, 478), (1120, 640), (1158, 800), (1226, 792), (1238, 880), (1250, 975),
       (990, 1005), (730, 1040), (720, 890), (708, 742), (605, 740), (604, 560)]
out = []
for x, y in est:
    d = np.hypot(P[:, 0] - x, P[:, 1] - y); near = P[d < 14]
    out.append(tuple(near.mean(0)) if len(near) else (x, y))
    if not len(near): print("no snap", x, y)
s = 1536 / 4000; X0, Y0, k = 700, 760, 2900 / 1536
vb = [[round((x / s - X0) / k, 1), round((y / s - Y0) / k, 1)] for x, y in out]
print(vb); json.dump(vb, open("plot_vb.json", "w"))
dbg = u.copy(); cv2.polylines(dbg, [np.int32(out).reshape(-1, 1, 2)], True, (0, 255, 255), 2); cv2.imwrite("dbg_crop.jpg", dbg[330:1070, 560:1290])
