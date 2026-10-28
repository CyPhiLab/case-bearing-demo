"""Reference outputs from SciPy that the TypeScript filters (src/lib/dsp/filters.ts) must reproduce.

Usage:
    python pipeline/make_filter_fixture.py
Writes tests/fixtures/filters.json.
"""
import json
import os

import numpy as np
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FS = 1000.0
DESIGNS = [
    {"type": "lowpass", "order": 1, "fc": 50},
    {"type": "lowpass", "order": 4, "fc": 100},
    {"type": "lowpass", "order": 8, "fc": 120},
    {"type": "highpass", "order": 3, "fc": 40},
    {"type": "bandpass", "order": 4, "fc": [50, 150]},
    {"type": "bandstop", "order": 2, "fc": [55, 65]},
    {"type": "bandpass", "order": 1, "fc": [200, 300]},
]


def main():
    n = 512
    t = np.arange(n) / FS
    x = (np.sin(2 * np.pi * 10 * t) + 0.5 * np.sin(2 * np.pi * 60 * t + 0.3) + 0.3 * np.sin(2 * np.pi * 180 * t)
         + 0.2 * signal.chirp(t, 5, t[-1], 400) + 0.4)
    freqs = [1, 10, 30, 50, 60, 75, 100, 120, 150, 200, 250, 300, 400, 490]
    cases = []
    for d in DESIGNS:
        sos = signal.butter(d["order"], d["fc"], btype=d["type"], fs=FS, output="sos")
        w, h = signal.sosfreqz(sos, worN=np.array(freqs, float), fs=FS)
        cases.append({**d, "sos": sos.tolist(), "freqs": freqs, "mag": np.abs(h).tolist(),
                      "phase": np.unwrap(np.angle(h)).tolist(),
                      "sosfilt": signal.sosfilt(sos, x).tolist(), "sosfiltfilt": signal.sosfiltfilt(sos, x).tolist()})
    with open(os.path.join(ROOT, "tests", "fixtures", "filters.json"), "w") as f:
        json.dump({"fs": FS, "x": x.tolist(), "cases": cases}, f)
    print(f"wrote {len(cases)} filter cases")


if __name__ == "__main__":
    main()
