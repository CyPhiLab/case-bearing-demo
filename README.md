# Listening to Bearings

An interactive, browser-based case study for the neural-networks unit of a measurements course. Students go from raw
accelerometer data recorded on the Case Western Reserve University (CWRU) bearing rig to a machine-learning diagnosis, and can
see and play with every step along the way.

Everything runs client-side. Logistic regression and the MLP **train live in the browser** (in a Web Worker). The 1D CNN is
trained offline and **runs live** with TensorFlow.js. The site is plain static files, hosted on GitHub Pages.

## What's on the page

| # | Section | Students can… | Builds on lecture |
|---|---------|---------------|-------------------|
| 1 | The bearing | Watch an animated 6205 bearing strike a seeded defect, change rpm, and see BPFO/BPFI/BSF computed from geometry | – |
| 2 | Look & listen | Browse all 10 recordings, **listen to them** (with ¼-speed playback), zoom the waveform with expected impact spacing overlaid, view the spectrum and envelope spectrum with fault-frequency markers | Data: plot your data |
| 3 | Windows | Slice a recording into windows, change window size and overlap, and see the count / resolution trade-offs | Data: how much data |
| 4 | Features | See all 18 features computed live for any window, with strip plots per class and a two-feature scatter | Data: normalization |
| 5 | PCA | Project the 18-D feature space to 2-D, hide labels, read the scree plot and loadings | NN: embedding / PCA |
| 6 | Logistic regression | Train it live in the PCA plane (≈74%, straight boundaries) and on all 18 features (≈100%), and inspect the coefficient heatmap | Regression: logistic regression |
| 7 | Neural network | Same PCA plane with an MLP (≈99%, curved boundaries), plus a full playground (layers, neurons, activation, learning rate, dropout, L2, training-set size, a "make it overfit" preset) with a live network diagram and loss curves | NN: hidden layers, ReLU, backprop, dropout |
| 8 | CNN | Feed raw test windows (optionally noisy) through the pretrained CNN, and see learned filters, their frequency responses and feature maps, plus a noise-robustness sweep | NN: types of networks |
| 9 | Diagnose | A "be the diagnostician" game against the three models, a stress test on an **unseen defect size** (accuracy collapses, showing out-of-distribution behavior), a summary and takeaways | Intro: out of distribution |

**Two modes** (toggle at the top right, or link with `?mode=lecture`):

- **Self-paced**: the full text, plus "Predict, then reveal" prompts and multiple-choice checks.
- **Lecture**: larger type and chart labels, reading material hidden. PageDown/PageUp (what presentation clickers send) or ←/→ jump section to section.

There's also a light/dark/auto theme toggle.

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

## Run it locally

```bash
npm ci
npm run dev          # http://localhost:5173/case-bearing-demo/
npm test             # unit tests: FFT, features vs Python, PCA vs sklearn, MLP gradients, CNN vs PyTorch
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
src/sections/        one Svelte component per page section
tests/               vitest unit tests + Playwright smoke tests
```

## Credits

Data: [Case Western Reserve University Bearing Data Center](https://engineering.case.edu/bearingdatacenter). Feature set adapted
from [L. G. Di Maggio](https://github.com/LGDiMaggio/CWRU-bearing-fault-classification-ML). See also W. A. Smith & R. B. Randall
(2015), *Rolling element bearing diagnostics using the Case Western Reserve University data: A benchmark study*, MSSP 64–65.
