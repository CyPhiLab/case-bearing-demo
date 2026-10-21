// Radix-2 FFT for power-of-two lengths, plus the handful of spectral helpers the site needs.

const twiddleCache = new Map<number, { cos: Float64Array; sin: Float64Array }>();

function twiddles(n: number) {
  let t = twiddleCache.get(n);
  if (!t) {
    const cos = new Float64Array(n / 2);
    const sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      cos[i] = Math.cos((-2 * Math.PI * i) / n);
      sin[i] = Math.sin((-2 * Math.PI * i) / n);
    }
    t = { cos, sin };
    twiddleCache.set(n, t);
  }
  return t;
}

/** In-place complex FFT. `inverse` computes the unscaled inverse transform. */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  if (n & (n - 1)) throw new Error(`FFT length ${n} is not a power of two`);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  const { cos, sin } = twiddles(n);
  const sgn = inverse ? -1 : 1;
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const step = n / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * step];
        const wi = sgn * sin[k * step];
        const a = i + k;
        const b = a + half;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
}

/** numpy.hanning(n): symmetric Hann window. */
export function hanning(n: number): Float64Array {
  const w = new Float64Array(n);
  if (n === 1) w[0] = 1;
  else for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

/** |rfft(x * window)|^2, length n/2 + 1. */
export function powerSpectrum(x: ArrayLike<number>, window?: Float64Array): Float64Array {
  const n = x.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = window ? x[i] * window[i] : x[i];
  fft(re, im);
  const P = new Float64Array(n / 2 + 1);
  for (let k = 0; k <= n / 2; k++) P[k] = re[k] * re[k] + im[k] * im[k];
  return P;
}

/**
 * One-sided amplitude spectrum in the signal's units (Hann window, amplitude-corrected),
 * so a sinusoid of amplitude A shows up as a peak of height ~A.
 */
export function amplitudeSpectrum(x: ArrayLike<number>, fs: number): { freq: Float64Array; amp: Float64Array } {
  const n = x.length;
  const w = hanning(n);
  let wsum = 0;
  for (let i = 0; i < n; i++) wsum += w[i];
  let mean = 0;
  for (let i = 0; i < n; i++) mean += x[i];
  mean /= n;
  const centered = new Float64Array(n);
  for (let i = 0; i < n; i++) centered[i] = x[i] - mean;
  const P = powerSpectrum(centered, w);
  const amp = new Float64Array(P.length);
  const freq = new Float64Array(P.length);
  for (let k = 0; k < P.length; k++) {
    amp[k] = (2 * Math.sqrt(P[k])) / wsum;
    freq[k] = (k * fs) / n;
  }
  return { freq, amp };
}

/**
 * Envelope spectrum: band-pass the signal around the structural resonance, take the
 * magnitude of the analytic signal (Hilbert envelope), then the spectrum of that envelope.
 * Bearing defects show up as lines at the fault frequency and its harmonics.
 */
export function envelopeSpectrum(
  x: ArrayLike<number>,
  fs: number,
  band: [number, number],
): { freq: Float64Array; amp: Float64Array } {
  const n = x.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = x[i];
  fft(re, im);
  // analytic signal restricted to the pass band: keep positive frequencies in band, doubled
  const lo = Math.floor((band[0] / fs) * n);
  const hi = Math.ceil((band[1] / fs) * n);
  for (let k = 0; k < n; k++) {
    const keep = k >= lo && k <= hi && k <= n / 2;
    re[k] = keep ? 2 * re[k] : 0;
    im[k] = keep ? 2 * im[k] : 0;
  }
  fft(re, im, true);
  const env = new Float64Array(n);
  for (let i = 0; i < n; i++) env[i] = Math.hypot(re[i], im[i]) / n;
  return amplitudeSpectrum(env, fs);
}
