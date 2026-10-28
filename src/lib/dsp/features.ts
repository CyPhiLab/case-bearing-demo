// The 18 hand-engineered features from the course notebook (pipeline/features.py).
// tests/features.test.ts checks these against values computed in Python.
import { hanning, powerSpectrum } from './fft';

export interface FeatureInfo {
  key: string;
  name: string;
  domain: 'time' | 'freq';
  formula: string; // KaTeX
  blurb: string;
}

export const FEATURES: FeatureInfo[] = [
  { key: 't_mean', name: 'Mean', domain: 'time', formula: '\\mu = \\frac{1}{N}\\sum x_i', blurb: 'Average level. For an accelerometer signal it should be close to zero.' },
  { key: 't_std', name: 'Std. dev.', domain: 'time', formula: '\\sigma = \\sqrt{\\tfrac{1}{N-1}\\sum (x_i-\\mu)^2}', blurb: 'Spread of the samples around the mean.' },
  { key: 't_rms', name: 'RMS', domain: 'time', formula: '\\mathrm{RMS} = \\sqrt{\\tfrac{1}{N}\\sum x_i^2}', blurb: 'Overall vibration level, related to energy. Usually the first quantity examined in vibration analysis.' },
  { key: 't_peak2peak', name: 'Peak-to-peak', domain: 'time', formula: '\\max x - \\min x', blurb: 'Total swing of the signal in this window.' },
  { key: 't_maxabs', name: 'Max |x|', domain: 'time', formula: '\\max |x_i|', blurb: 'Largest instantaneous acceleration.' },
  { key: 't_skew', name: 'Skewness', domain: 'time', formula: '\\frac{1}{N}\\sum \\left(\\frac{x_i-\\mu}{\\sigma}\\right)^3', blurb: 'Asymmetry of the distribution: whether large excursions are mostly positive or mostly negative.' },
  { key: 't_kurt', name: 'Kurtosis', domain: 'time', formula: '\\frac{1}{N}\\sum \\left(\\frac{x_i-\\mu}{\\sigma}\\right)^4 - 3', blurb: 'Peakedness of the distribution (excess kurtosis). About 0 for Gaussian noise and large when sharp impacts are present.' },
  { key: 't_crest', name: 'Crest factor', domain: 'time', formula: '\\frac{\\max|x|}{\\mathrm{RMS}}', blurb: 'How tall the biggest peak is compared with the typical level. Impacts raise it.' },
  { key: 't_impulse', name: 'Impulse factor', domain: 'time', formula: '\\frac{\\max|x|}{\\overline{|x|}}', blurb: 'Like crest factor, but relative to the mean absolute value.' },
  { key: 't_shape', name: 'Shape factor', domain: 'time', formula: '\\frac{\\mathrm{RMS}}{\\overline{|x|}}', blurb: 'Describes the waveform shape. It is 1.11 for a pure sine.' },
  { key: 't_clearance', name: 'Clearance factor', domain: 'time', formula: '\\frac{\\max|x|}{\\left(\\overline{\\sqrt{|x|}}\\right)^2}', blurb: 'Peak relative to the squared mean of √|x|. Very sensitive to small, early impacts.' },
  { key: 'f_centroid', name: 'Spectral centroid', domain: 'freq', formula: '\\frac{\\sum k\\,P_k}{\\sum P_k} \\big/ k_{\\max}', blurb: 'Amplitude-weighted mean frequency of the spectrum, from 0 (DC) to 1 (Nyquist).' },
  { key: 'f_spread', name: 'Spectral spread', domain: 'freq', formula: '\\sqrt{\\frac{\\sum (k-\\bar k)^2 P_k}{\\sum P_k}} \\big/ k_{\\max}', blurb: 'How widely the energy is spread across frequency.' },
  { key: 'f_peak_idx', name: 'Peak frequency', domain: 'freq', formula: '\\arg\\max_k P_k \\big/ k_{\\max}', blurb: 'Location of the tallest spectral line (0 to 1 of Nyquist).' },
  { key: 'f_band0', name: 'Band energy 0–1.5 kHz', domain: 'freq', formula: '\\sum_{\\text{band 0}} P_k \\big/ \\sum P_k', blurb: 'Fraction of energy in the lowest quarter of the spectrum.' },
  { key: 'f_band1', name: 'Band energy 1.5–3 kHz', domain: 'freq', formula: '\\sum_{\\text{band 1}} P_k \\big/ \\sum P_k', blurb: 'Fraction of energy in the second quarter.' },
  { key: 'f_band2', name: 'Band energy 3–4.5 kHz', domain: 'freq', formula: '\\sum_{\\text{band 2}} P_k \\big/ \\sum P_k', blurb: 'Fraction of energy in the third quarter. Structural resonances excited by impacts are often in this band.' },
  { key: 'f_band3', name: 'Band energy 4.5–6 kHz', domain: 'freq', formula: '\\sum_{\\text{band 3}} P_k \\big/ \\sum P_k', blurb: 'Fraction of energy in the top quarter, up to Nyquist (6 kHz).' },
];

const EPS = 1e-12;
const hannCache = new Map<number, Float64Array>();

export function timeFeatures(x: ArrayLike<number>): number[] {
  const n = x.length;
  let sum = 0, sumAbs = 0, sumSq = 0, sumSqrtAbs = 0, min = Infinity, max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = x[i];
    const a = Math.abs(v);
    sum += v;
    sumAbs += a;
    sumSq += v * v;
    sumSqrtAbs += Math.sqrt(a + EPS);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const mean = sum / n;
  let m2 = 0, m3 = 0, m4 = 0;
  for (let i = 0; i < n; i++) {
    const d = x[i] - mean;
    const d2 = d * d;
    m2 += d2;
    m3 += d2 * d;
    m4 += d2 * d2;
  }
  m2 /= n; m3 /= n; m4 /= n;
  const std = Math.sqrt((m2 * n) / (n - 1));
  const rms = Math.sqrt(sumSq / n);
  const maxAbs = Math.max(Math.abs(min), Math.abs(max));
  const meanAbs = sumAbs / n;
  const meanSqrtAbs = sumSqrtAbs / n;
  // scipy.stats.skew / kurtosis with bias=False (sample-size corrected)
  const g1 = m3 / Math.pow(m2, 1.5);
  const skew = (g1 * Math.sqrt(n * (n - 1))) / (n - 2);
  const g2 = m4 / (m2 * m2) - 3;
  const kurt = (((n + 1) * g2 + 6) * (n - 1)) / ((n - 2) * (n - 3));
  return [
    mean, std, rms, max - min, maxAbs, skew, kurt,
    maxAbs / (rms + EPS), maxAbs / (meanAbs + EPS), rms / (meanAbs + EPS), maxAbs / (meanSqrtAbs ** 2 + EPS),
  ];
}

export function freqFeatures(x: ArrayLike<number>, nb = 4): number[] {
  const n = x.length;
  let w = hannCache.get(n);
  if (!w) hannCache.set(n, (w = hanning(n)));
  const P = powerSpectrum(x, w);
  const L = P.length;
  let total = 0, kw = 0, peak = 0;
  for (let k = 0; k < L; k++) {
    total += P[k];
    if (P[k] > P[peak]) peak = k;
  }
  const norm = total + EPS;
  for (let k = 0; k < L; k++) kw += (k * P[k]) / norm;
  let spread = 0;
  for (let k = 0; k < L; k++) spread += (k - kw) ** 2 * (P[k] / norm);
  const kmax = Math.max(L - 1, 1);
  const bands: number[] = [];
  for (let i = 0; i < nb; i++) {
    // np.linspace(0, L-1, nb+1, dtype=int) edges; each band is [edge_i, edge_{i+1})
    const a = Math.floor((i * (L - 1)) / nb);
    const b = Math.floor(((i + 1) * (L - 1)) / nb);
    let s = 0;
    for (let k = a; k < b; k++) s += P[k];
    bands.push(s / norm);
  }
  return [kw / kmax, Math.sqrt(spread) / kmax, peak / kmax, ...bands];
}

export function allFeatures(x: ArrayLike<number>): number[] {
  return [...timeFeatures(x), ...freqFeatures(x)];
}
