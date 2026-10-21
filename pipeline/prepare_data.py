"""Build the static data assets the website loads.

Usage:
    git clone --depth=1 https://github.com/srigas/CWRU_Bearing_NumPy.git data-cache/CWRU_Bearing_NumPy
    python pipeline/prepare_data.py --raw data-cache/CWRU_Bearing_NumPy/Data

Writes:
    public/data/recordings.json     recording metadata + window/split definition
    public/data/signals/<id>.i16    10 s of 16-bit little-endian samples per recording
    public/data/reference.json      sklearn accuracies on the same features and split
    tests/fixtures/parity.json      feature values the TypeScript port must reproduce
"""
import argparse
import json
import os

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler

from common import CLASSES, FRAME, FS, HOP, N_SAMPLES, RECORDINGS, SPLITS, load_recording, quantize, window_starts
from features import ALL_FEATURES, all_features

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "data")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default=os.path.join(ROOT, "data-cache", "CWRU_Bearing_NumPy", "Data"))
    args = ap.parse_args()
    os.makedirs(os.path.join(OUT, "signals"), exist_ok=True)

    meta, X, y, split, src = [], [], [], [], []
    for rid, fname, cls, size in RECORDINGS:
        q, scale = quantize(load_recording(args.raw, fname))
        q.astype("<i2").tofile(os.path.join(OUT, "signals", f"{rid}.i16"))
        x = q.astype(np.float64) * scale
        meta.append({"id": rid, "source": fname, "cls": cls, "size": size, "scale": scale,
                     "rms": float(np.sqrt(np.mean(x ** 2)))})
        for s, sp in window_starts():
            X.append(all_features(x[s:s + FRAME]))
            y.append(CLASSES.index(cls))
            split.append(sp)
            src.append((rid, s))
        print(f"{rid:8s} {fname:24s} {cls:11s} rms={meta[-1]['rms']:.3f} g")

    X, y, split = np.array(X), np.array(y), np.array(split)
    print("\nwindows per class:", {c: int((y == i).sum()) for i, c in enumerate(CLASSES)})
    print("windows per split:", {s: int((split == s).sum()) for s, _, _ in SPLITS})

    with open(os.path.join(OUT, "recordings.json"), "w") as f:
        json.dump({"fs": FS, "nSamples": N_SAMPLES, "frame": FRAME, "hop": HOP, "classes": CLASSES,
                   "splits": [{"name": n, "from": a, "to": b} for n, a, b in SPLITS],
                   "recordings": meta}, f, indent=1)

    # Reference models: fit on train+val, report on the held-out test block.
    fit = split != "test"
    scaler = StandardScaler().fit(X[fit])
    Xf, Xt = scaler.transform(X[fit]), scaler.transform(X[~fit])
    ref = {}
    for name, model in [
        ("logistic", LogisticRegression(max_iter=2000, class_weight="balanced")),
        ("mlp", MLPClassifier(hidden_layer_sizes=(128, 64), early_stopping=True, random_state=42, max_iter=500)),
    ]:
        model.fit(Xf, y[fit])
        pred = model.predict(Xt)
        ref[name] = {"accuracy": round(float(accuracy_score(y[~fit], pred)), 4),
                     "confusion": confusion_matrix(y[~fit], pred).tolist()}
        print(f"{name:9s} test accuracy {ref[name]['accuracy']:.3f}")
    with open(os.path.join(OUT, "reference.json"), "w") as f:
        json.dump(ref, f, indent=1)

    # Parity fixture: a few windows from every recording.
    picks = [i for i in range(len(src)) if src[i][1] in (0, 40 * HOP, 100 * HOP)]
    os.makedirs(os.path.join(ROOT, "tests", "fixtures"), exist_ok=True)
    with open(os.path.join(ROOT, "tests", "fixtures", "parity.json"), "w") as f:
        json.dump({"features": ALL_FEATURES,
                   "cases": [{"id": src[i][0], "start": src[i][1], "values": X[i].tolist()} for i in picks]}, f)


if __name__ == "__main__":
    main()
