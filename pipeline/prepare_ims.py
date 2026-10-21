"""Build the NASA/IMS run-to-failure assets (test 2: bearing 1 develops an outer-race failure).

Usage:
    python pipeline/prepare_ims.py --raw data-cache/ims/2nd_test

Get the raw data from the NASA Prognostics Data Repository (IMS bearings, "4. Bearings.zip"),
e.g. https://phm-datasets.s3.amazonaws.com/NASA/4.+Bearings.zip -> IMS.7z -> 2nd_test.rar.

Writes:
    public/data/ims/trend.json     health indicators for all 4 bearings over the whole test, plus the
                                   18 CWRU features of bearing 1 (resampled to 12 kHz) for every snapshot
    public/data/ims/snap_<i>.i16   1-s raw snapshots of bearing 1 at selected moments of its life
"""
import argparse
import datetime as dt
import json
import os

import numpy as np
from scipy.signal import resample_poly
from scipy.stats import kurtosis

from common import FRAME, quantize
from features import all_features

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "data", "ims")

FS = 20480
# Rexnord ZA-2115 double-row roller bearing (Qiu et al., 2006), shaft at 2000 rpm
GEOM = {"model": "Rexnord ZA-2115", "elements": 16, "elementDiameter": 0.331, "pitchDiameter": 2.815,
        "contactAngleDeg": 15.17, "rpm": 2000}
ENV_BAND = (2000, 8000)
SNAPSHOTS = [0, 150, 300, 450, 520, 545, 570, 600, 650, 700, 750, 850, 930, 960, 975, 981]


def bpfo():
    fr = GEOM["rpm"] / 60
    r = GEOM["elementDiameter"] / GEOM["pitchDiameter"] * np.cos(np.deg2rad(GEOM["contactAngleDeg"]))
    return GEOM["elements"] / 2 * fr * (1 - r)


def envelope_at(x, f0, band=ENV_BAND):
    """Envelope-spectrum amplitude at f0 (max within ±3 Hz): the classic outer-race health indicator."""
    n = len(x)
    X = np.fft.fft(x - x.mean())
    f = np.fft.fftfreq(n, 1 / FS)
    X[(f < band[0]) | (f > band[1])] = 0
    env = np.abs(np.fft.ifft(2 * X))
    w = np.hanning(n)
    A = np.abs(np.fft.rfft((env - env.mean()) * w)) * 2 / w.sum()
    F = np.fft.rfftfreq(n, 1 / FS)
    return float(A[(F > f0 - 3) & (F < f0 + 3)].max())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default=os.path.join(ROOT, "data-cache", "ims", "2nd_test"))
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)

    files = sorted(os.listdir(args.raw))
    stamp = lambda f: dt.datetime.strptime(f, "%Y.%m.%d.%H.%M.%S")
    t0 = stamp(files[0])
    f_bpfo = bpfo()
    hours, ind, feats = [], {k: [[] for _ in range(4)] for k in ("rms", "kurtosis", "crest", "envBPFO")}, []
    kept = []
    for i, f in enumerate(files):
        x = np.loadtxt(os.path.join(args.raw, f))
        if np.sqrt((x ** 2).mean()) < 0.01:  # the final file is recorded after the rig stopped
            print(f"skipping {f}: sensor flat")
            continue
        kept.append(i)
        hours.append(round((stamp(f) - t0).total_seconds() / 3600, 3))
        for b in range(4):
            s = x[:, b]
            rms = float(np.sqrt((s ** 2).mean()))
            ind["rms"][b].append(round(rms, 5))
            ind["kurtosis"][b].append(round(float(kurtosis(s)), 4))
            ind["crest"][b].append(round(float(np.abs(s).max() / rms), 4))
            ind["envBPFO"][b].append(round(envelope_at(s, f_bpfo), 6))
        # what the CWRU-trained models see: bearing 1 resampled to 12 kHz, first 2048-sample window
        y12 = resample_poly(x[:, 0], 75, 128)
        feats.append([float(f"{v:.6g}") for v in all_features(y12[:FRAME])])
        if i % 100 == 0:
            print(f"{i:4d} {f} rms1={ind['rms'][0][-1]:.3f} env={ind['envBPFO'][0][-1]:.4f}")

    snaps = []
    for k in SNAPSHOTS:
        x = np.loadtxt(os.path.join(args.raw, files[k]))[:, 0]
        q, scale = quantize(x)
        q.astype("<i2").tofile(os.path.join(OUT, f"snap_{k}.i16"))
        snaps.append({"index": k, "file": files[k], "hours": round((stamp(files[k]) - t0).total_seconds() / 3600, 3),
                      "scale": scale})

    with open(os.path.join(OUT, "trend.json"), "w") as fh:
        json.dump({"fs": FS, "geometry": GEOM, "bpfo": f_bpfo, "envBand": ENV_BAND, "start": files[0],
                   "failedBearing": 0, "hours": hours, "snapshotIndex": kept, "indicators": ind,
                   "features12k": feats, "snapshots": snaps}, fh, separators=(",", ":"))
    print(f"{len(kept)} snapshots, BPFO {f_bpfo:.1f} Hz, {len(snaps)} raw snapshots written")


if __name__ == "__main__":
    main()
