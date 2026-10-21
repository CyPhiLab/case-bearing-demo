"""Build the Paderborn (KAt Bearing DataCenter) assets: machined vs. real bearing damage.

Data: C. Lessmeier, J. K. Kimotho, D. Zimmer, W. Sextro, "Condition Monitoring of Bearing Damage in
Electromechanical Drive Systems by Using Motor Current Signals of Electric Motors: A Benchmark Data
Set for Data-Driven Classification," PHM Europe 2016. https://mb.uni-paderborn.de/kat/datacenter
License: CC BY-NC 4.0 (non-commercial use with attribution).

Usage (downloads ~3 GB of .rar archives once, then extracts only what it needs; needs `unar`):
    python pipeline/prepare_paderborn.py
or, with archives you downloaded yourself:
    python pipeline/prepare_paderborn.py --rar-dir /path/to/rars

Writes public/data/pu/recordings.json and public/data/pu/signals/<bearing>.i16: 4 s of vibration
per bearing at operating point N15_M07_F10 (1500 rpm, 0.7 Nm, 1000 N), resampled 64 kHz -> 12 kHz.
"""
import argparse
import json
import os
import subprocess
import urllib.request

import numpy as np
import scipy.io as sio
from scipy.signal import resample_poly

from common import FRAME, HOP, SPLITS, quantize

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "data", "pu")
URL = "https://groups.uni-paderborn.de/kat/BearingDataCenter/{}.rar"
SETTING = "N15_M07_F10"
FS_IN, FS = 64000, 12000
CLASSES = ["Normal", "Ball", "Inner Race", "Outer Race"]  # same indices/colors as CWRU (no ball faults here)

# bearing code, class, damage origin, how it was made (Lessmeier et al. 2016, Tables 4-5)
BEARINGS = [
    ("K001", "Normal", "none", "healthy, run-in"),
    ("K002", "Normal", "none", "healthy, run-in"),
    ("K003", "Normal", "none", "healthy, run-in"),
    ("KA01", "Outer Race", "machined", "EDM notch"),
    ("KA03", "Outer Race", "machined", "electric engraver"),
    ("KA07", "Outer Race", "machined", "drilling"),
    ("KI01", "Inner Race", "machined", "EDM notch"),
    ("KI03", "Inner Race", "machined", "electric engraver"),
    ("KI07", "Inner Race", "machined", "electric engraver"),
    ("KA04", "Outer Race", "real", "fatigue pitting"),
    ("KA15", "Outer Race", "real", "plastic deformation (indentations)"),
    ("KA16", "Outer Race", "real", "fatigue pitting"),
    ("KA22", "Outer Race", "real", "fatigue pitting"),
    ("KA30", "Outer Race", "real", "plastic deformation (indentations)"),
    ("KI04", "Inner Race", "real", "fatigue pitting"),
    ("KI14", "Inner Race", "real", "fatigue pitting"),
    ("KI16", "Inner Race", "real", "fatigue pitting"),
    ("KI18", "Inner Race", "real", "fatigue pitting"),
    ("KI21", "Inner Race", "real", "fatigue pitting"),
]


def fetch(code, rar_dir, extract_dir):
    mat = os.path.join(extract_dir, code, f"{SETTING}_{code}_1.mat")
    if os.path.exists(mat):
        return mat
    rar = os.path.join(rar_dir, f"{code}.rar")
    if not os.path.exists(rar):
        print(f"downloading {code}.rar …")
        urllib.request.urlretrieve(URL.format(code), rar)
    subprocess.run(["unar", "-q", "-f", "-o", extract_dir, rar, f"{code}/{SETTING}_{code}_1.mat"], check=True)
    return mat


def load_vibration(path):
    m = sio.loadmat(path, squeeze_me=True, struct_as_record=False)
    rec = m[[k for k in m if not k.startswith("__")][0]]
    ch = next(y for y in rec.Y if y.Name == "vibration_1")
    return np.asarray(ch.Data, dtype=np.float64).ravel()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rar-dir", default=os.path.join(ROOT, "data-cache", "pu"))
    args = ap.parse_args()
    extract_dir = os.path.join(args.rar_dir, "x")
    os.makedirs(extract_dir, exist_ok=True)
    os.makedirs(os.path.join(OUT, "signals"), exist_ok=True)

    meta = []
    for code, cls, damage, method in BEARINGS:
        x = load_vibration(fetch(code, args.rar_dir, extract_dir))
        x = resample_poly(x - x.mean(), 3, 16)[: 4 * FS]  # 64 kHz -> 12 kHz, anti-aliased
        q, scale = quantize(x)
        q.astype("<i2").tofile(os.path.join(OUT, "signals", f"{code}.i16"))
        kind = {"none": "Healthy", "machined": "machined", "real": "real"}[damage]
        label = f"{code} · {kind}" if damage == "none" else f"{code} · {cls}, {kind}"
        meta.append({"id": code, "source": f"{SETTING}_{code}_1.mat", "cls": cls, "size": 0, "scale": scale,
                     "rms": float(np.sqrt(np.mean((q * scale) ** 2))), "label": label, "damage": damage,
                     "method": method})
        print(f"{code:5s} {cls:11s} {damage:9s} rms={meta[-1]['rms']:.3f}")

    with open(os.path.join(OUT, "recordings.json"), "w") as f:
        json.dump({"fs": FS, "nSamples": 4 * FS, "frame": FRAME, "hop": HOP, "classes": CLASSES,
                   "splits": [{"name": n, "from": a, "to": b} for n, a, b in SPLITS],
                   "bearing": {"model": "6203 deep-groove ball bearing", "balls": 8, "ballDiameter_mm": 6.75, "pitchDiameter_mm": 28.55,
                               "rpm": 1500},
                   "recordings": meta}, f, indent=1)


if __name__ == "__main__":
    main()
