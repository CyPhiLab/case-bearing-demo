"""Feature extraction, ported from the original course notebook.

These definitions are mirrored exactly in src/lib/dsp/features.ts; the
parity fixture written by prepare_data.py keeps the two in sync.
"""
import numpy as np
from scipy.stats import skew, kurtosis

TIME_FEATURES = [
    "t_mean", "t_std", "t_rms", "t_peak2peak", "t_maxabs",
    "t_skew", "t_kurt", "t_crest", "t_impulse", "t_shape", "t_clearance",
]
N_BANDS = 4
FREQ_FEATURES = ["f_centroid", "f_spread", "f_peak_idx"] + [f"f_band{i}" for i in range(N_BANDS)]
ALL_FEATURES = TIME_FEATURES + FREQ_FEATURES


def _safe_div(a, b, eps=1e-12):
    return a / (b + eps)


def time_features(x):
    x = np.asarray(x, dtype=np.float64)
    x_abs = np.abs(x)
    mean_ = np.mean(x)
    std_ = np.std(x, ddof=1)
    rms_ = np.sqrt(np.mean(x * x))
    p2p_ = np.ptp(x)
    maxabs_ = np.max(x_abs)
    skew_ = skew(x, bias=False)
    kurt_ = kurtosis(x, fisher=True, bias=False)
    mean_abs = np.mean(x_abs)
    mean_sqrt_abs = np.mean(np.sqrt(x_abs + 1e-12))
    crest = _safe_div(maxabs_, rms_)
    impulse = _safe_div(maxabs_, mean_abs)
    shape = _safe_div(rms_, mean_abs)
    clearance = _safe_div(maxabs_, mean_sqrt_abs ** 2)
    return [mean_, std_, rms_, p2p_, maxabs_, skew_, kurt_, crest, impulse, shape, clearance]


def freq_features(x, nb=N_BANDS):
    x = np.asarray(x, dtype=np.float64)
    N = len(x)
    P = np.abs(np.fft.rfft(x * np.hanning(N))) ** 2
    k = np.arange(len(P))
    w = P / (np.sum(P) + 1e-12)
    centroid = float(np.sum(k * w)) / max(len(P) - 1, 1)
    spread = float(np.sqrt(np.sum(((k - np.sum(k * w)) ** 2) * w))) / max(len(P) - 1, 1)
    peak_idx_norm = int(np.argmax(P)) / max(len(P) - 1, 1)
    edges = np.linspace(0, len(P) - 1, nb + 1, dtype=int)
    totalP = np.sum(P) + 1e-12
    bands = [float(np.sum(P[edges[i]:edges[i + 1]]) / totalP) for i in range(nb)]
    return [centroid, spread, peak_idx_norm] + bands


def all_features(x):
    return time_features(x) + freq_features(x)
