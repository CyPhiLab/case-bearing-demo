"""Shared dataset definition for the pipeline scripts.

Selection (1 HP load, 1772 rpm, drive-end bearing, drive-end accelerometer, 12 kHz):
  * Normal baseline is only recorded at 48 kHz in CWRU, so it is decimated to 12 kHz
    (anti-aliased FIR) to match the fault recordings. Otherwise a classifier can
    "detect" Normal from the sampling rate alone.
  * Fault recordings are the *_DE12 files (drive-end bearing faults). The *_FE files are
    fan-end bearing faults, a different bearing, so they are left out.
  * Outer-race faults use the centred (@6) position, giving 3 recordings per fault class.
  * Every recording is trimmed to 10 s and split in time: the first 70% of the recording
    feeds training, the next 10% validation and the last 20% testing. Windows never
    straddle a boundary, so overlapping windows can't leak between splits.
"""
import os
import numpy as np
from scipy.signal import decimate

FS = 12000
N_SAMPLES = 120000          # 10 s per recording
FRAME = 2048
HOP = 1024                  # 50% overlap
SPLITS = (("train", 0.0, 0.7), ("val", 0.7, 0.8), ("test", 0.8, 1.0))
CLASSES = ["Normal", "Ball", "Inner Race", "Outer Race"]

RECORDINGS = [
    # id, file, class, defect size (mil)
    ("normal", "1772_Normal.npz", "Normal", 0),
    ("ball_7", "1772_B_7_DE12.npz", "Ball", 7),
    ("ball_14", "1772_B_14_DE12.npz", "Ball", 14),
    ("ball_21", "1772_B_21_DE12.npz", "Ball", 21),
    ("ir_7", "1772_IR_7_DE12.npz", "Inner Race", 7),
    ("ir_14", "1772_IR_14_DE12.npz", "Inner Race", 14),
    ("ir_21", "1772_IR_21_DE12.npz", "Inner Race", 21),
    ("or_7", "1772_OR@6_7_DE12.npz", "Outer Race", 7),
    ("or_14", "1772_OR@6_14_DE12.npz", "Outer Race", 14),
    ("or_21", "1772_OR@6_21_DE12.npz", "Outer Race", 21),
]


def load_recording(raw_root, fname):
    """Return the drive-end accelerometer signal (g) at 12 kHz, trimmed to 10 s."""
    with np.load(os.path.join(raw_root, "1772 RPM", fname)) as z:
        x = z["DE"].ravel().astype(np.float64)
    if "Normal" in fname:
        x = decimate(x, 4, ftype="fir", zero_phase=True)
    return x[:N_SAMPLES]


def quantize(x):
    """16-bit quantisation (what the DAQ stores anyway). Returns int16 codes and the scale."""
    scale = float(np.max(np.abs(x)) / 32767.0)
    q = np.round(x / scale).astype(np.int16)
    return q, scale


def window_starts(n=N_SAMPLES, frame=FRAME, hop=HOP):
    """Yield (start, split) for each window that lies entirely inside one split region."""
    out = []
    for name, a, b in SPLITS:
        lo, hi = int(round(a * n)), int(round(b * n))
        s = lo
        while s + frame <= hi:
            out.append((s, name))
            s += hop
    return out
