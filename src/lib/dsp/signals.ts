// Signal generators and analysis helpers for the Signals page.
import { fft, hanning } from './fft';
import { butter, sosfiltfilt } from './filters';
import { mulberry32 } from '../ml/mlp';

export const linspace = (n: number, dt: number, t0 = 0) => Float64Array.from({ length: n }, (_, i) => t0 + i * dt);

/** Deterministic Gaussian noise (Box–Muller on a seeded PRNG). */
export function gaussian(n: number, sigma = 1, seed = 1): Float64Array {
  const r = mulberry32(seed);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = sigma * Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
  return out;
}

export const mean = (x: ArrayLike<number>) => {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i];
  return s / x.length;
};
export const rms = (x: ArrayLike<number>) => {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return Math.sqrt(s / x.length);
};
/** Population standard deviation (the "AC RMS"): rms² = mean² + std². */
export const std = (x: ArrayLike<number>) => {
  const m = mean(x);
  let s = 0;
  for (let i = 0; i < x.length; i++) s += (x[i] - m) ** 2;
  return Math.sqrt(s / x.length);
};

/** Partial Fourier sums of classic waveforms (amplitude A, period T). */
export function fourierSeries(kind: 'square' | 'sawtooth' | 'triangle' | 'rectified', t: number, terms: number, A = 1, T = 1): number {
  const w = (2 * Math.PI) / T;
  let y = 0;
  if (kind === 'square') for (let k = 0; k < terms; k++) { const n = 2 * k + 1; y += ((4 * A) / (Math.PI * n)) * Math.sin(n * w * t); }
  else if (kind === 'sawtooth') for (let n = 1; n <= terms; n++) y += ((2 * A) / Math.PI) * ((-1) ** (n + 1) / n) * Math.sin(n * w * t);
  else if (kind === 'triangle') for (let k = 0; k < terms; k++) { const n = 2 * k + 1; y += ((8 * A) / (Math.PI * Math.PI)) * ((-1) ** k / (n * n)) * Math.sin(n * w * t); }
  else {
    // |A sin(πt/T)| : full-wave rectified sine with period T (book Example 2.5 uses A = 120 V, T = 1/120 s)
    y = (2 * A) / Math.PI;
    for (let k = 1; k <= terms; k++) { const n = 2 * k; y += ((A / Math.PI) * (-2 / (n - 1) + 2 / (n + 1))) * Math.cos((n * Math.PI * t) / T); }
  }
  return y;
}

export function exactWave(kind: 'square' | 'sawtooth' | 'triangle' | 'rectified', t: number, A = 1, T = 1): number {
  const ph = (((t / T) % 1) + 1) % 1;
  if (kind === 'square') return ph < 0.5 ? A : -A;
  if (kind === 'sawtooth') return 2 * A * (ph < 0.5 ? ph : ph - 1);
  if (kind === 'triangle') return ph < 0.25 ? 4 * A * ph : ph < 0.75 ? 2 * A - 4 * A * ph : 4 * A * ph - 4 * A;
  return Math.abs(A * Math.sin((Math.PI * t) / T));
}

/** Solve a small dense linear system (Gaussian elimination with partial pivoting). */
export function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-300;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / d;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / (r[i] || 1e-300));
}

export interface FourierFit {
  A0: number;
  A: number[]; // cosine coefficients
  B: number[]; // sine coefficients
  C: number[]; // amplitudes sqrt(A²+B²)
  phi: number[]; // y = A0 + Σ C_n sin(nωt + φ_n)
  fitted: Float64Array;
  r2: number;
}

/** Least-squares Fourier model y ≈ A0 + Σ_{n=1..K} (A_n cos nωt + B_n sin nωt), ω = 2π f0 ("fit models to data"). */
export function fitFourier(t: ArrayLike<number>, y: ArrayLike<number>, f0: number, K: number): FourierFit {
  const m = 2 * K + 1;
  const w = 2 * Math.PI * f0;
  const AtA = Array.from({ length: m }, () => new Array(m).fill(0));
  const Aty = new Array(m).fill(0);
  const row = new Array(m);
  for (let i = 0; i < t.length; i++) {
    row[0] = 1;
    for (let n = 1; n <= K; n++) {
      row[2 * n - 1] = Math.cos(n * w * t[i]);
      row[2 * n] = Math.sin(n * w * t[i]);
    }
    for (let a = 0; a < m; a++) {
      Aty[a] += row[a] * y[i];
      for (let b = a; b < m; b++) AtA[a][b] += row[a] * row[b];
    }
  }
  for (let a = 0; a < m; a++) for (let b = 0; b < a; b++) AtA[a][b] = AtA[b][a];
  const c = solve(AtA, Aty);
  const A = Array.from({ length: K }, (_, n) => c[2 * n + 1]);
  const B = Array.from({ length: K }, (_, n) => c[2 * n + 2]);
  const fitted = Float64Array.from(t, (tt) => c[0] + A.reduce((s, a, n) => s + a * Math.cos((n + 1) * w * tt) + B[n] * Math.sin((n + 1) * w * tt), 0));
  const my = mean(y);
  let ssr = 0, sst = 0;
  for (let i = 0; i < y.length; i++) {
    ssr += (y[i] - fitted[i]) ** 2;
    sst += (y[i] - my) ** 2;
  }
  return { A0: c[0], A, B, C: A.map((a, n) => Math.hypot(a, B[n])), phi: A.map((a, n) => Math.atan2(a, B[n])), fitted, r2: 1 - ssr / (sst || 1) };
}

/** One-sided DFT amplitude spectrum, book Eq. 2.38 scaling (2/N; 1/N at f = 0). Any N (direct DFT if not a power of 2). */
export function dftAmplitude(y: ArrayLike<number>, dt: number, window: 'rect' | 'hann' = 'rect', padTo?: number) {
  const N = y.length;
  const L = padTo ?? N;
  const w = window === 'hann' ? hanning(N) : null;
  let wsum = 0;
  for (let i = 0; i < N; i++) wsum += w ? w[i] : 1;
  const re = new Float64Array(L), im = new Float64Array(L);
  for (let i = 0; i < N; i++) re[i] = y[i] * (w ? w[i] : 1);
  if ((L & (L - 1)) === 0) fft(re, im);
  else {
    const r2 = new Float64Array(L), i2 = new Float64Array(L);
    for (let k = 0; k < L; k++)
      for (let n = 0; n < N; n++) {
        const a = (-2 * Math.PI * k * n) / L;
        r2[k] += re[n] * Math.cos(a);
        i2[k] += re[n] * Math.sin(a);
      }
    re.set(r2);
    im.set(i2);
  }
  const half = Math.floor(L / 2);
  const freq = new Float64Array(half), amp = new Float64Array(half), Ar = new Float64Array(half), Bi = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    const s = (k === 0 ? 1 : 2) / wsum;
    freq[k] = k / (L * dt);
    amp[k] = Math.hypot(re[k], im[k]) * s;
    Ar[k] = re[k];
    Bi[k] = -im[k];
  }
  return { freq, amp, re: Ar, im: Bi };
}

/** Keep every `factor`-th sample, optionally after an anti-aliasing low-pass (Butterworth order 8, zero-phase). */
export function downsample(x: ArrayLike<number>, fs: number, factor: number, antiAlias: boolean): Float64Array {
  const src = antiAlias && factor > 1 ? sosfiltfilt(butter('lowpass', 8, 0.8 * (fs / factor / 2), fs), x) : x;
  const out = new Float64Array(Math.floor(x.length / factor));
  for (let i = 0; i < out.length; i++) out[i] = src[i * factor];
  return out;
}

/** Hold each sample until the next one (what you "see" between samples, book Fig. 2.3b). */
export function sampleAndHold(x: ArrayLike<number>, factor: number): Float64Array {
  return Float64Array.from({ length: x.length }, (_, i) => x[i - (i % factor)]);
}

/** Uniform mid-tread quantizer over [-range/2, range/2] with 2^bits levels (clips outside). */
export function quantize(x: ArrayLike<number>, bits: number, range: number): Float64Array {
  const lsb = range / 2 ** bits;
  const lo = -range / 2, hi = range / 2 - lsb;
  return Float64Array.from(x, (v) => Math.min(hi, Math.max(lo, Math.round(v / lsb) * lsb)));
}

/** Apparent frequency of a sampled sinusoid: fold f into [0, fs/2]. */
export function aliasFrequency(f: number, fs: number): number {
  const r = ((f % fs) + fs) % fs;
  return r > fs / 2 ? fs - r : r;
}

/** Short-time Fourier transform magnitude in dB: frames × bins. */
export function stft(x: ArrayLike<number>, fs: number, nfft: number, hop: number) {
  const w = hanning(nfft);
  let wsum = 0;
  for (const v of w) wsum += v;
  const frames: Float32Array[] = [];
  for (let s = 0; s + nfft <= x.length; s += hop) {
    const re = new Float64Array(nfft), im = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) re[i] = x[s + i] * w[i];
    fft(re, im);
    const mag = new Float32Array(nfft / 2);
    for (let k = 0; k < nfft / 2; k++) mag[k] = 20 * Math.log10((2 * Math.hypot(re[k], im[k])) / wsum + 1e-9);
    frames.push(mag);
  }
  return { frames, df: fs / nfft, dt: hop / fs };
}

/** Welch-averaged amplitude spectrum: Hann segments with 50% overlap, power averaged, returned as amplitude. */
export function welch(x: ArrayLike<number>, fs: number, nseg: number) {
  const w = hanning(nseg);
  let wsum = 0;
  for (const v of w) wsum += v;
  const P = new Float64Array(nseg / 2);
  let count = 0;
  for (let s = 0; s + nseg <= x.length; s += nseg / 2) {
    const m = mean(Array.prototype.slice.call(x, s, s + nseg));
    const re = new Float64Array(nseg), im = new Float64Array(nseg);
    for (let i = 0; i < nseg; i++) re[i] = (x[s + i] - m) * w[i];
    fft(re, im);
    for (let k = 0; k < nseg / 2; k++) P[k] += ((2 * Math.hypot(re[k], im[k])) / wsum) ** 2;
    count++;
  }
  return {
    freq: Float64Array.from({ length: nseg / 2 }, (_, k) => (k * fs) / nseg),
    amp: P.map((p) => Math.sqrt(p / Math.max(1, count))),
    segments: count,
  };
}

/** Discrete convolution y[n] = Σ_k h[k] x[n-k] (causal, zero initial conditions). */
export function convolve(x: ArrayLike<number>, h: ArrayLike<number>): Float64Array {
  const y = new Float64Array(x.length);
  for (let n = 0; n < x.length; n++) {
    let s = 0;
    for (let k = 0; k < h.length && k <= n; k++) s += h[k] * x[n - k];
    y[n] = s;
  }
  return y;
}

export const db = (ratio: number) => 20 * Math.log10(ratio);
