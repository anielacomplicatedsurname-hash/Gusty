"""Trace brand artwork from the founder's PDF images into SVG, without redrawing.

Usage (needs poppler-utils, potrace, Python with Pillow and numpy, and svgo):
  WORK=$(mktemp -d); mkdir -p $WORK/pdfimg $WORK/trace_tmp
  pdfimages -png -f 18 -l 19 docs/reference/gusty-founding-directive.pdf $WORK/pdfimg/img
  python3 scripts/brand/trace.py $WORK $WORK/raw
  npx svgo --config scripts/brand/svgo.config.cjs -f $WORK/raw/logo -o public/brand/logo
  npx svgo --config scripts/brand/svgo.config.cjs -f $WORK/raw/symbols -o public/brand/symbols

Crop boxes are in source-image pixels and stop above the printed labels. The "Gustyyy" lockup on
the symbol page is intentionally not traced (the brand name is Gusty).
"""
import subprocess, sys, os, re
import numpy as np
from PIL import Image, ImageFilter

S = sys.argv[1]            # scratchpad
OUT = sys.argv[2]          # output dir
IMG = f"{S}/pdfimg"
os.makedirs(OUT, exist_ok=True)
tmp = f"{S}/trace_tmp"; os.makedirs(tmp, exist_ok=True)

# name: (source image, (x0,y0,x1,y1) generous region that excludes labels)
ASSETS = {
  "logo/gusty-hey":        ("img-000", (95, 90, 480, 310)),
  "logo/gusty-primary":    ("img-000", (280, 315, 1240, 645)),
  "logo/gusty-stacked":    ("img-000", (165, 715, 475, 996)),
  "logo/gusty-icon":       ("img-000", (600, 745, 845, 996)),
  "logo/gusty-wordmark":   ("img-000", (960, 785, 1325, 996)),
  "symbols/leafy-sprig":   ("img-002", (55, 420, 270, 662)),
  "symbols/star":          ("img-002", (335, 430, 565, 662)),
  "symbols/open-hands":    ("img-002", (595, 470, 855, 662)),
  "symbols/clover":        ("img-002", (895, 425, 1125, 662)),
  "symbols/raindrop":      ("img-002", (1220, 440, 1375, 662)),
  "symbols/sprout":        ("img-002", (50, 780, 250, 962)),
  "symbols/tree":          ("img-002", (262, 750, 478, 962)),
  "symbols/flower":        ("img-002", (505, 770, 685, 962)),
  "symbols/spark":         ("img-002", (728, 760, 940, 962)),
  "symbols/organic-burst": ("img-002", (950, 775, 1185, 962)),
  "symbols/two-waves":     ("img-002", (1205, 800, 1405, 962)),
  "symbols/horizon-hill":  ("img-003", (60, 285, 385, 460)),
  "symbols/path":          ("img-003", (435, 230, 660, 495)),
  "symbols/bridge":        ("img-003", (720, 305, 1055, 455)),
  "symbols/house":         ("img-003", (90, 625, 335, 860)),
  "symbols/bench":         ("img-003", (395, 680, 715, 860)),
  "symbols/leaf-cluster":  ("img-003", (755, 610, 1040, 875)),
  "symbols/bud":           ("img-003", (220, 1005, 465, 1255)),
  "symbols/gathering":     ("img-003", (595, 1020, 915, 1250)),
}

SCALE = 4
for name, (src, box) in ASSETS.items():
    im = Image.open(f"{IMG}/{src}.png").convert("L").crop(box)
    a = np.array(im)
    dark = a < 128
    ys, xs = np.where(dark)
    if len(xs) == 0:
        print("EMPTY", name); continue
    pad = 4
    if xs.min()==0 or ys.min()==0 or xs.max()==a.shape[1]-1 or ys.max()==a.shape[0]-1: print("TOUCHES EDGE", name)
    x0, x1 = max(xs.min()-pad, 0), min(xs.max()+pad+1, a.shape[1])
    y0, y1 = max(ys.min()-pad, 0), min(ys.max()+pad+1, a.shape[0])
    im = im.crop((x0, y0, x1, y1))
    # Upscale smoothly, then threshold at the midpoint so edges stay where the artist drew them.
    big = im.resize((im.width*SCALE, im.height*SCALE), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
    bw = big.point(lambda v: 0 if v < 128 else 255, "1")
    pbm = f"{tmp}/{name.replace('/', '_')}.pbm"
    bw.save(pbm)
    svg = f"{OUT}/{name}.svg"
    os.makedirs(os.path.dirname(svg), exist_ok=True)
    subprocess.run(["potrace", pbm, "-s", "-o", svg, "--turdsize", "40",
                    "--alphamax", "1.0", "--opttolerance", "0.2", "--flat"], check=True)
    print(f"{name}: {x1-x0}x{y1-y0}px source")
