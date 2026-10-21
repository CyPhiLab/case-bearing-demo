"""Train the 1D CNN on raw vibration windows and export its weights for TensorFlow.js.

Usage:
    python pipeline/train_cnn.py --raw data-cache/CWRU_Bearing_NumPy/Data

Same recordings and time-based split as prepare_data.py. Training windows are random
crops from the training part of each recording (data augmentation without leakage).

Writes:
    public/data/cnn/model.json   architecture, input normalisation, weight manifest, test metrics
    public/data/cnn/weights.bin  float32 weights, in Keras layer order
    tests/fixtures/cnn.json      a few windows with expected class probabilities
"""
import argparse
import json
import os

import numpy as np
import torch
from torch import nn

from common import CLASSES, FRAME, HOP, N_SAMPLES, RECORDINGS, SPLITS, load_recording, quantize, window_starts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "data", "cnn")

# (filters, kernel, dropout) per conv block, as in the course notebook
CONV = [(16, 32, 0.1), (32, 16, 0.1), (64, 8, 0.2)]
DENSE = 32


class CNN(nn.Module):
    def __init__(self):
        super().__init__()
        layers, cin = [], 1
        for f, k, p in CONV:
            layers += [nn.Conv1d(cin, f, k), nn.ReLU(), nn.BatchNorm1d(f), nn.MaxPool1d(2), nn.Dropout(p)]
            cin = f
        self.features = nn.Sequential(*layers)
        self.head = nn.Sequential(nn.Linear(cin, DENSE), nn.ReLU(), nn.BatchNorm1d(DENSE), nn.Dropout(0.3),
                                  nn.Linear(DENSE, len(CLASSES)))

    def forward(self, x):
        return self.head(self.features(x).mean(dim=2))


def region(name):
    a, b = next((a, b) for n, a, b in SPLITS if n == name)
    return int(round(a * N_SAMPLES)), int(round(b * N_SAMPLES))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default=os.path.join(ROOT, "data-cache", "CWRU_Bearing_NumPy", "Data"))
    ap.add_argument("--epochs", type=int, default=30)
    args = ap.parse_args()
    torch.manual_seed(0)
    rng = np.random.default_rng(0)

    sigs, labels = [], []
    for rid, fname, cls, _ in RECORDINGS:
        q, scale = quantize(load_recording(args.raw, fname))
        sigs.append(q.astype(np.float64) * scale)   # identical to what the website decodes
        labels.append(CLASSES.index(cls))
    labels = np.array(labels)
    lo, hi = region("train")
    mean = float(np.mean([s[lo:hi].mean() for s in sigs]))
    std = float(np.sqrt(np.mean([((s[lo:hi] - mean) ** 2).mean() for s in sigs])))

    def fixed(split):
        X, y = [], []
        for s, lab in zip(sigs, labels):
            for st, sp in window_starts():
                if sp == split:
                    X.append(s[st:st + FRAME]); y.append(lab)
        return torch.tensor((np.array(X) - mean) / std, dtype=torch.float32)[:, None], torch.tensor(y)

    Xv, yv = fixed("val")
    Xt, yt = fixed("test")
    by_class = [np.flatnonzero(labels == c) for c in range(len(CLASSES))]

    def batch(n=64):
        # class-balanced: pick a class, then a recording of that class, then a random crop
        cls = rng.integers(0, len(CLASSES), n)
        recs = [rng.choice(by_class[c]) for c in cls]
        starts = rng.integers(lo, hi - FRAME, n)
        X = np.stack([sigs[r][s:s + FRAME] for r, s in zip(recs, starts)])
        return torch.tensor((X - mean) / std, dtype=torch.float32)[:, None], torch.tensor(labels[recs])

    model = CNN()
    opt = torch.optim.Adam(model.parameters(), lr=3e-3)
    lossf = nn.CrossEntropyLoss()
    best, best_state, history = -1, None, []
    for ep in range(args.epochs):
        model.train()
        tl = 0.0
        for _ in range(40):
            xb, yb = batch()
            opt.zero_grad()
            loss = lossf(model(xb), yb)
            loss.backward()
            opt.step()
            tl += loss.item() / 40
        model.eval()
        with torch.no_grad():
            out = model(Xv)
            vl = lossf(out, yv).item()
            va = (out.argmax(1) == yv).float().mean().item()
        history.append({"epoch": ep + 1, "loss": round(tl, 4), "valLoss": round(vl, 4), "valAcc": round(va, 4)})
        print(f"epoch {ep + 1:2d} loss {tl:.4f} val_loss {vl:.4f} val_acc {va:.3f}")
        if va > best or (va == best and vl < min(h["valLoss"] for h in history[:-1])):
            best, best_state = va, {k: v.clone() for k, v in model.state_dict().items()}
    model.load_state_dict(best_state)
    model.eval()
    with torch.no_grad():
        probs = torch.softmax(model(Xt), 1).numpy()
    pred = probs.argmax(1)
    acc = float((pred == yt.numpy()).mean())
    conf = np.zeros((len(CLASSES), len(CLASSES)), int)
    for a, p in zip(yt.numpy(), pred):
        conf[a, p] += 1
    print(f"test accuracy {acc:.4f}\n{conf}")

    # Export in Keras order: Conv1D kernel (k, in, out); BatchNorm gamma, beta, mean, var; Dense (in, out).
    sd = {k: v.numpy() for k, v in model.state_dict().items()}
    tensors, manifest = [], []

    def add(name, arr):
        arr = np.ascontiguousarray(arr, dtype="<f4")
        manifest.append({"name": name, "shape": list(arr.shape)})
        tensors.append(arr.ravel())

    def bn(prefix, name):
        for part in ("weight", "bias", "running_mean", "running_var"):
            add(f"{name}.{part}", sd[f"{prefix}.{part}"])

    for i in range(len(CONV)):
        c, b = 5 * i, 5 * i + 2
        add(f"conv{i + 1}.kernel", sd[f"features.{c}.weight"].transpose(2, 1, 0))
        add(f"conv{i + 1}.bias", sd[f"features.{c}.bias"])
        bn(f"features.{b}", f"bn{i + 1}")
    add("dense1.kernel", sd["head.0.weight"].T)
    add("dense1.bias", sd["head.0.bias"])
    bn("head.2", "bn4")
    add("dense2.kernel", sd["head.4.weight"].T)
    add("dense2.bias", sd["head.4.bias"])

    os.makedirs(OUT, exist_ok=True)
    np.concatenate(tensors).tofile(os.path.join(OUT, "weights.bin"))
    with open(os.path.join(OUT, "model.json"), "w") as f:
        json.dump({"frame": FRAME, "mean": mean, "std": std, "classes": CLASSES,
                   "conv": [{"filters": fl, "kernel": k, "dropout": p} for fl, k, p in CONV],
                   "dense": DENSE, "bnEpsilon": 1e-5, "weights": manifest,
                   "testAccuracy": round(acc, 4), "confusion": conf.tolist(), "history": history}, f, indent=1)

    # Parity fixture: first test window of every recording.
    cases = []
    for r, (rid, *_) in enumerate(RECORDINGS):
        st = next(s for s, sp in window_starts() if sp == "test")
        i = r * sum(1 for _, sp in window_starts() if sp == "test")
        cases.append({"id": rid, "start": st, "probs": probs[i].tolist()})
    with open(os.path.join(ROOT, "tests", "fixtures", "cnn.json"), "w") as f:
        json.dump({"cases": cases}, f)


if __name__ == "__main__":
    main()
