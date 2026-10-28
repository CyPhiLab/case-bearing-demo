# Listening to Bearings

An interactive, browser-based case study for the neural-networks unit of a measurements course. Students go from raw
accelerometer data recorded on the Case Western Reserve University (CWRU) bearing rig to a machine-learning diagnosis, and can
see and play with every step along the way.

Everything runs client-side. Logistic regression and the MLP **train live in the browser** (in a Web Worker). The 1D CNN is
trained offline and **runs live** with TensorFlow.js. The site is plain static files, hosted on GitHub Pages.

## What's on the page

| # | Section | Students can… | Builds on lecture |
|---|---------|---------------|-------------------|
| 1 | The bearing | Watch an animated bearing strike a defect (CWRU SKF 6205, IMS Rexnord ZA-2115 or Paderborn 6203), change rpm, and see BPFO/BPFI/BSF computed from geometry | – |
| 2 | Look & listen | Browse all 10 recordings, **listen to them** (with ¼-speed playback), zoom the waveform with expected impact spacing overlaid, view the spectrum and envelope spectrum with fault-frequency markers. Then step through a week-long **run-to-failure** test and watch the BPFO line appear, and compare **machined vs. real** damage | Data: plot your data |
| 3 | Windows | Slice a recording into windows, change window size and overlap, and see the count / resolution trade-offs | Data: how much data |
| 4 | Features | See all 18 features computed live for any window, with strip plots per class and a two-feature scatter, plus health indicators trended over the IMS bearings' life | Data: normalization |
| 5 | PCA | Project the 18-D feature space to 2-D (CWRU or Paderborn), hide labels, read the scree plot and loadings | NN: embedding / PCA |
| 6 | Logistic regression | Train it live in the PCA plane (≈74%, straight boundaries) and on all 18 features (≈100%), and inspect the coefficient heatmap | Regression: logistic regression |
| 7 | Neural network | Same PCA plane with an MLP (≈99%, curved boundaries), plus a full playground (layers, neurons, activation, learning rate, dropout, L2, training-set size, **mislabeled labels**) with a live network diagram and loss curves. "Make it overfit" memorizes bad labels (~99% train / ~75% test), and the "Fix: add L2" / "Fix: more data" buttons recover it | Data: bad labels, overfitting, regularization; NN: backprop, dropout |
| 8 | CNN | Feed raw test windows (optionally noisy) through the pretrained CNN, **step through a convolution** with the network's real filter, and see learned filters, their frequency responses and feature maps, plus a noise-robustness sweep | NN: types of networks |
| 9 | Diagnose | A "be the diagnostician" game against the three models, a stress test on an **unseen defect size** (accuracy collapses, showing out-of-distribution behavior), an **early-warning alarm** on the IMS run-to-failure data (anomaly detection, no labels), a **cross-machine test** (the CWRU models on the IMS bearing, showing domain shift), a **machined → real damage** test on Paderborn (~40% accuracy, ~60% once some real examples are added), a summary and takeaways | Intro: out of distribution |

**Two modes** (toggle at the top right, or link with `?mode=lecture`):

- **Self-paced**: the full text, plus "Predict, then reveal" prompts and multiple-choice checks.
- **Lecture**: larger type and chart labels, reading material hidden. PageDown/PageUp (what presentation clickers send) or ←/→ jump section to section.

There's also a light/dark/auto theme toggle.

## Second page: Signals Lab (`/signals/`)

A standalone page for the **Signals & Data** lecture at `https://<owner>.github.io/case-bearing-demo/signals/`. It shares only
building blocks (charts, theme, modes) with the bearing case study, and follows the slide order. Figliola & Beasley ch. 2 is cited
as a supplement through small "F&B Eq./Fig./Example" tags.

| # | Section | Students can… | Slides |
|---|---------|---------------|--------|
| 1 | What is a signal? | Follow animated measurement chains (phone call, laptop mic, machine vibration, thermometer) | 2 |
| 2 | Static and dynamic | Generate every waveform class of Table 2.1 with live parameters, then play "classify the signal" | 3–4 |
| 3 | Noise and interference | Add random noise, drift and 60 Hz hum to y = 2 + sin 2πt and see the time trace and the spectrum | 5 |
| 4 | Mean and RMS | Move the DC offset, amplitude and N, and watch ȳ, y_rms and y_rms² = ȳ² + σ² update (Ex. 2.1) | 6 |
| 5 | Fourier review | Fit a Fourier model to data (least squares, R²), build a square/sawtooth/triangle/rectified wave from sines (Ex. 2.4–2.5, Gibbs), find a spring–mass natural frequency and the first four modes of a cantilever beam (impact and sensor position, mode nodes), step through the 8-point DFT (Ex. 2.6–2.7), and explore leakage, windowing and zero-padding | 7 |
| 6 | Sampling | Sweep a sine past f_s/2 (with the spectral-image strip), **hear aliasing** on a sweep with and without an anti-aliasing filter, and quantize with 1–16 bits (SNR ≈ 6.02N + 1.76 dB) | 8 |
| 7 | Filters | Analog vs digital, LP/HP/BP/BS, SMA vs EMA (lag, √M noise reduction), Butterworth \|G\| for n = 1–8, and a **filter lab** on any clip with presets (remove 60 Hz hum), causal vs zero-phase, and listening | 9–12 |
| 8 | Convolution | Slide a kernel along a signal step by step (MA, EMA, matched filter, derivative) with its frequency response | – |
| 9 | Averaging, SNR & dB | dB converter, ensemble averaging (√N), Welch vs a single FFT | – |
| 10 | Microphone | **Live microphone**: waveform, spectrum, f₀ and harmonics (clarinet vs brass, Ex. 2.8), averaging, scrolling spectrogram, and recording clips into the other labs. Simulated sources are available without a mic | – |
| 11 | Accelerometer | **Phone accelerometer** (DeviceMotion, iOS permission): measured sample rate and jitter, resampling, RMS, spectrum, CSV download. A QR code is shown on desktop, plus a simulated fan recording with an aliased tone | – |

The filters are a SciPy-compatible Butterworth implementation (`butter(..., output='sos')`, `sosfilt`, `sosfiltfilt`), checked
against SciPy to 6–7 decimal places in `tests/filters.test.ts`. Microphone and motion data are processed only in the browser.

## Data and methodology notes (for the instructor)

The data comes from [srigas/CWRU_Bearing_NumPy](https://github.com/srigas/CWRU_Bearing_NumPy), a NumPy copy of the CWRU Bearing Data
Center files. Compared with last year's Colab notebook, `pipeline/` makes a few deliberate changes:

- **One sensor, one sampling rate, one bearing.** Only drive-end bearing faults (`*_DE12` files) are used, read from the drive-end
  accelerometer (`DE` key) at 12 kHz. The CWRU *Normal* baseline exists only at 48 kHz, so it is decimated to 12 kHz with an
  anti-aliasing FIR filter. In the notebook, Normal stayed at 48 kHz while the faults were 12 kHz, so the frequency features could
  separate Normal by sampling rate alone. The `*_FE` files are faults in the **fan-end** bearing (not a fan-end sensor), so they're
  left out.
- **No train/test leakage from overlapping windows.** Every 10 s recording is split *in time*: first 70% train, next 10% validation,
  last 20% test. Windows never straddle a boundary. With a random split, 50%-overlapping windows from the same stretch of signal
  land on both sides.
- **Classes:** Normal, Ball, Inner Race, Outer Race (centered @6 position), at 7/14/21 mil and 1772 rpm (1 hp). That gives 1,130
  windows: 113 Normal and 339 per fault class. Balanced class weights handle the imbalance.
- The 18 features are exactly the notebook's definitions. `tests/features.test.ts` checks the TypeScript port against Python to 1e-6.

Reference accuracies (`public/data/reference.json`, scikit-learn on the same split): logistic regression 100%, MLP 100% with all 18
features. In the PCA plane: logistic regression ≈74%, MLP ≈99%. The CNN reaches 100% on the test windows. Holding out a whole
defect size drops an MLP to 25–70%. The site uses that as its out-of-distribution lesson.

### NASA/IMS run-to-failure data

Test 2 of the IMS bearing experiments (University of Cincinnati / Rexnord, distributed by the NASA Prognostics Data Repository, US
government work). Four Rexnord ZA-2115 roller bearings ran at 2000 rpm under a 6000 lb radial load for about 7 days, recorded for
1 s every 10 minutes at 20.48 kHz, until bearing 1's outer race failed. `pipeline/prepare_ims.py` writes the health indicators of all
four bearings (RMS, kurtosis, crest factor, envelope amplitude at BPFO = 236 Hz) for every snapshot, the 18 features of bearing 1
(resampled to 12 kHz, as the CWRU models expect), and 16 raw snapshots for listening. That's about 0.9 MB in `public/data/ims/`, loaded
lazily.

### Paderborn real vs. machined damage

From the [KAt Bearing DataCenter](https://mb.uni-paderborn.de/kat/datacenter) at Paderborn University (**CC BY-NC 4.0**: non-commercial
use with attribution, cite Lessmeier et al. 2016). `pipeline/prepare_paderborn.py` downloads 19 of the 32 bearing archives
(~3.2 GB, once) and extracts one 4 s measurement per bearing at operating point N15_M07_F10 (1500 rpm, 0.7 Nm, 1000 N). It keeps the
vibration channel only, resampled from 64 kHz to 12 kHz, about 1.8 MB in `public/data/pu/`. The bearings: healthy K001–K003; machined
KA01/KA03/KA07 (outer) and KI01/KI03/KI07 (inner); real damage KA04/KA15/KA16/KA22/KA30 (outer) and KI04/KI14/KI16/KI18/KI21 (inner).
In the stress test, data is split by **whole bearings**, so the test bearings are never seen in training.

## Run it locally

```bash
npm ci
npm run dev          # http://localhost:5173/case-bearing-demo/  (Signals Lab: /case-bearing-demo/signals/)
npm test             # unit tests: FFT, features vs Python, PCA vs sklearn, MLP gradients, CNN vs PyTorch, filters vs SciPy
npm run check        # type-check
npm run build        # static site in dist/
npx playwright install chromium && npm run e2e   # browser smoke tests against the build
```

## Regenerate the data and the CNN (optional)

The generated assets in `public/data/` are committed (about 2.5 MB), so this is only needed if you change the selection, the split
or the model.

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r pipeline/requirements.txt
git clone --depth=1 https://github.com/srigas/CWRU_Bearing_NumPy.git data-cache/CWRU_Bearing_NumPy
python pipeline/prepare_data.py   # signals, metadata, sklearn reference, parity fixtures
python pipeline/train_cnn.py      # ~3 min on a laptop CPU; writes public/data/cnn/

# NASA/IMS run-to-failure (needs 7z + unrar/unar to unpack): 4. Bearings.zip -> IMS.7z -> 2nd_test.rar
curl -L -o data-cache/ims.zip "https://phm-datasets.s3.amazonaws.com/NASA/4.+Bearings.zip"
python pipeline/prepare_ims.py --raw data-cache/ims/2nd_test

# Paderborn (downloads 19 .rar archives, ~3.2 GB; needs `unar`)
python pipeline/prepare_paderborn.py

# Signals Lab filter fixtures (SciPy reference responses)
python pipeline/make_filter_fixture.py
npm test                          # confirms the browser code still matches
```

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds and tests on every push and pull request, and deploys to Pages on pushes to `main`.
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The site is served at
`https://<owner>.github.io/case-bearing-demo/`. If the repository is renamed, update `base` in `vite.config.ts`.

## Project layout

```
pipeline/            Python: dataset selection, features (from the notebook), CNN training/export
public/data/         generated: 16-bit signals, metadata, CNN weights
src/lib/dsp/         FFT, envelope spectrum, the 18 features
src/lib/ml/          PCA, hand-written MLP (training worker), CNN wrapper (TensorFlow.js)
src/lib/charts/      canvas/SVG chart components
src/sections/        one Svelte component per page section (bearing case study)
signals/index.html   entry point of the standalone Signals Lab page
src/signals/         Signals Lab: sections/, viz/ (interactive figures), lib/ (clips, mic, motion)
src/lib/dsp/         also filters.ts (Butterworth, moving averages) and signals.ts (generators, DFT, STFT, Welch, …)
tests/               vitest unit tests + Playwright smoke tests
```

## Credits

Data: [Case Western Reserve University Bearing Data Center](https://engineering.case.edu/bearingdatacenter), and the IMS bearing
data set (J. Lee, H. Qiu, G. Yu, J. Lin and Rexnord Technical Services, IMS, University of Cincinnati, 2007; NASA Prognostics Data
Repository), and the Paderborn KAt Bearing DataCenter (C. Lessmeier, J. K. Kimotho, D. Zimmer, W. Sextro, PHM Europe 2016;
CC BY-NC 4.0). Feature set adapted
from [L. G. Di Maggio](https://github.com/LGDiMaggio/CWRU-bearing-fault-classification-ML). See also W. A. Smith & R. B. Randall
(2015), *Rolling element bearing diagnostics using the Case Western Reserve University data: A benchmark study*, MSSP 64–65.
