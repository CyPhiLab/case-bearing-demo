// Digital filters: Butterworth (designed like scipy.signal.butter, as second-order sections),
// moving average and exponential moving average, plus their frequency responses.
// tests/filters.test.ts checks the Butterworth designs against SciPy.

export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'bandstop';
/** One biquad: [b0, b1, b2, a0, a1, a2] with a0 = 1 */
export type SOS = number[][];

// --- minimal complex arithmetic -------------------------------------------------------------
type C = [number, number];
const add = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const sub = (a: C, b: C): C => [a[0] - b[0], a[1] - b[1]];
const mul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a: C, b: C): C => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
const scale = (a: C, s: number): C => [a[0] * s, a[1] * s];
const csqrt = (a: C): C => {
  const r = Math.hypot(a[0], a[1]);
  const re = Math.sqrt((r + a[0]) / 2);
  const im = Math.sign(a[1] || 1) * Math.sqrt(Math.max(0, (r - a[0]) / 2));
  return [re, im];
};
const prod = (xs: C[]): C => xs.reduce<C>((p, x) => mul(p, x), [1, 0]);

interface ZPK {
  z: C[];
  p: C[];
  k: number;
}

/** Analog Butterworth prototype: poles evenly spaced on the left half of the unit circle. */
function buttap(n: number): ZPK {
  const p: C[] = [];
  for (let m = -n + 1; m < n; m += 2) {
    const th = (Math.PI * m) / (2 * n);
    p.push([-Math.cos(th), Math.sin(th)]);
  }
  return { z: [], p, k: 1 };
}

function lp2lp({ z, p, k }: ZPK, wo: number): ZPK {
  return { z: z.map((v) => scale(v, wo)), p: p.map((v) => scale(v, wo)), k: k * wo ** (p.length - z.length) };
}

function lp2hp({ z, p, k }: ZPK, wo: number): ZPK {
  const deg = p.length - z.length;
  const zh = z.map((v) => div([wo, 0], v));
  const ph = p.map((v) => div([wo, 0], v));
  for (let i = 0; i < deg; i++) zh.push([0, 0]);
  const g = div(prod(z.map((v) => scale(v, -1))), prod(p.map((v) => scale(v, -1))));
  return { z: zh, p: ph, k: k * g[0] };
}

function lp2bp({ z, p, k }: ZPK, wo: number, bw: number): ZPK {
  const deg = p.length - z.length;
  const split = (v: C): C[] => {
    const l = scale(v, bw / 2);
    const s = csqrt(sub(mul(l, l), [wo * wo, 0]));
    return [add(l, s), sub(l, s)];
  };
  const zb = z.flatMap(split);
  const pb = p.flatMap(split);
  for (let i = 0; i < deg; i++) zb.push([0, 0]);
  return { z: zb, p: pb, k: k * bw ** deg };
}

function lp2bs({ z, p, k }: ZPK, wo: number, bw: number): ZPK {
  const deg = p.length - z.length;
  const split = (v: C): C[] => {
    const h = div([bw / 2, 0], v);
    const s = csqrt(sub(mul(h, h), [wo * wo, 0]));
    return [add(h, s), sub(h, s)];
  };
  const zb = z.flatMap(split);
  const pb = p.flatMap(split);
  for (let i = 0; i < deg; i++) zb.push([0, wo], [0, -wo]);
  const g = div(prod(z.map((v) => scale(v, -1))), prod(p.map((v) => scale(v, -1))));
  return { z: zb, p: pb, k: k * g[0] };
}

/** Bilinear transform, s -> 2·fs·(z-1)/(z+1), with fs = 2 (normalized frequencies, as SciPy does). */
function bilinear({ z, p, k }: ZPK): ZPK {
  const fs2: C = [4, 0];
  const deg = p.length - z.length;
  const zz = z.map((v) => div(add(fs2, v), sub(fs2, v)));
  const pz = p.map((v) => div(add(fs2, v), sub(fs2, v)));
  for (let i = 0; i < deg; i++) zz.push([-1, 0]);
  const g = div(prod(z.map((v) => sub(fs2, v))), prod(p.map((v) => sub(fs2, v))));
  return { z: zz, p: pz, k: k * g[0] };
}

/** Split roots into conjugate pairs and leftover reals. */
function pairRoots(r: C[]): { pairs: [C, C][]; reals: number[] } {
  const tol = 1e-9;
  const left = r.slice();
  const pairs: [C, C][] = [];
  const reals: number[] = [];
  while (left.length) {
    const a = left.shift()!;
    if (Math.abs(a[1]) < tol * Math.max(1, Math.abs(a[0]))) {
      reals.push(a[0]);
      continue;
    }
    let best = 0;
    left.forEach((b, i) => {
      if (Math.hypot(b[0] - a[0], b[1] + a[1]) < Math.hypot(left[best][0] - a[0], left[best][1] + a[1])) best = i;
    });
    pairs.push([a, left.splice(best, 1)[0]]);
  }
  return { pairs, reals };
}

function zpk2sos({ z, p, k }: ZPK): SOS {
  const P = pairRoots(p);
  const Z = pairRoots(z);
  // pole quadratics: conjugate pairs, then real poles two at a time
  const poleQ: [number, number][] = P.pairs.map(([a, b]) => [-(a[0] + b[0]), mul(a, b)[0]]);
  const zeroQ: [number, number, number][] = Z.pairs.map(([a, b]) => [1, -(a[0] + b[0]), mul(a, b)[0]]);
  const pr = P.reals.slice();
  while (pr.length >= 2) {
    const a = pr.shift()!, b = pr.shift()!;
    poleQ.push([-(a + b), a * b]);
  }
  const poleSecs: number[][] = poleQ.map(([a1, a2]) => [1, a1, a2]);
  if (pr.length) poleSecs.push([1, -pr[0], 0]);
  const zr = Z.reals.slice();
  while (zr.length >= 2) {
    const a = zr.shift()!, b = zr.shift()!;
    zeroQ.push([1, -(a + b), a * b]);
  }
  const zeroSecs: number[][] = zeroQ.slice();
  if (zr.length) zeroSecs.push([1, -zr[0], 0]);
  while (zeroSecs.length < poleSecs.length) zeroSecs.push([1, 0, 0]);
  const sos = poleSecs.map((a, i) => [...zeroSecs[i], ...a]);
  sos[0] = [sos[0][0] * k, sos[0][1] * k, sos[0][2] * k, sos[0][3], sos[0][4], sos[0][5]];
  return sos;
}

/** Butterworth filter of the given order; `fc` in Hz (two edges for band filters). */
export function butter(type: FilterType, order: number, fc: number | [number, number], fs: number): SOS {
  const warp = (f: number) => 4 * Math.tan((Math.PI * (f / (fs / 2))) / 2); // 2·fs·tan(πWn/fs) with fs = 2
  let zpk = buttap(order);
  if (type === 'lowpass' || type === 'highpass') {
    const wo = warp(fc as number);
    zpk = type === 'lowpass' ? lp2lp(zpk, wo) : lp2hp(zpk, wo);
  } else {
    const [f1, f2] = fc as [number, number];
    const w1 = warp(f1), w2 = warp(f2);
    const wo = Math.sqrt(w1 * w2), bw = w2 - w1;
    zpk = type === 'bandpass' ? lp2bp(zpk, wo, bw) : lp2bs(zpk, wo, bw);
  }
  return zpk2sos(bilinear(zpk));
}

/** Direct-form II transposed filtering, section by section (scipy.signal.sosfilt). */
export function sosfilt(sos: SOS, x: ArrayLike<number>, zi?: number[][]): Float64Array {
  let y = Float64Array.from(x);
  sos.forEach(([b0, b1, b2, , a1, a2], s) => {
    let z1 = zi?.[s][0] ?? 0, z2 = zi?.[s][1] ?? 0;
    for (let n = 0; n < y.length; n++) {
      const xn = y[n];
      const yn = b0 * xn + z1;
      z1 = b1 * xn - a1 * yn + z2;
      z2 = b2 * xn - a2 * yn;
      y[n] = yn;
    }
  });
  return y;
}

/** Steady-state initial conditions for a unit step (scipy.signal.sosfilt_zi). */
function sosfiltZi(sos: SOS): number[][] {
  let g = 1;
  return sos.map(([b0, b1, b2, a0, a1, a2]) => {
    // solve (I - A^T) zi = b[1:] - a[1:]·b0 for the 2-state companion form
    const r0 = b1 - a1 * b0, r1 = b2 - a2 * b0;
    const det = (1 + a1) * 1 + a2; // det([[1+a1, -1], [a2, 1]])
    const zi = [(r0 + r1) / det, (r1 * (1 + a1) - a2 * r0) / det];
    const out = [zi[0] * g, zi[1] * g];
    g *= (b0 + b1 + b2) / (a0 + a1 + a2);
    return out;
  });
}

/** Zero-phase filtering: forward then backward, with odd-extension padding (scipy.signal.sosfiltfilt). */
export function sosfiltfilt(sos: SOS, x: ArrayLike<number>): Float64Array {
  const n = x.length;
  const zerosB = sos.filter((s) => s[2] === 0).length, zerosA = sos.filter((s) => s[5] === 0).length;
  const edge = Math.min(n - 1, 3 * (2 * sos.length + 1 - Math.min(zerosB, zerosA)));
  const ext = new Float64Array(n + 2 * edge);
  for (let i = 0; i < edge; i++) ext[i] = 2 * x[0] - x[edge - i];
  for (let i = 0; i < n; i++) ext[edge + i] = x[i];
  for (let i = 0; i < edge; i++) ext[edge + n + i] = 2 * x[n - 1] - x[n - 2 - i];
  const zi = sosfiltZi(sos);
  const fwd = sosfilt(sos, ext, zi.map((z) => z.map((v) => v * ext[0])));
  fwd.reverse();
  const back = sosfilt(sos, fwd, zi.map((z) => z.map((v) => v * fwd[0])));
  back.reverse();
  return back.slice(edge, edge + n);
}

/** Complex frequency response of a cascade of sections at the given frequencies (Hz). */
export function sosResponse(sos: SOS, freqs: ArrayLike<number>, fs: number): { mag: Float64Array; phase: Float64Array } {
  const mag = new Float64Array(freqs.length);
  const phase = new Float64Array(freqs.length);
  for (let i = 0; i < freqs.length; i++) {
    const w = (2 * Math.PI * freqs[i]) / fs;
    const z1: C = [Math.cos(w), -Math.sin(w)];
    const z2 = mul(z1, z1);
    let h: C = [1, 0];
    for (const [b0, b1, b2, a0, a1, a2] of sos) {
      const num = add(add([b0, 0], scale(z1, b1)), scale(z2, b2));
      const den = add(add([a0, 0], scale(z1, a1)), scale(z2, a2));
      h = mul(h, div(num, den));
    }
    mag[i] = Math.hypot(h[0], h[1]);
    phase[i] = Math.atan2(h[1], h[0]);
  }
  // unwrap
  for (let i = 1; i < phase.length; i++) {
    while (phase[i] - phase[i - 1] > Math.PI) phase[i] -= 2 * Math.PI;
    while (phase[i] - phase[i - 1] < -Math.PI) phase[i] += 2 * Math.PI;
  }
  return { mag, phase };
}

/** Ideal analog Butterworth magnitude from the slide: |G(ω)| = 1 / sqrt(1 + (ω/ωc)^(2n)). */
export const butterworthMag = (f: number, fc: number, n: number) => 1 / Math.sqrt(1 + (f / fc) ** (2 * n));

/** Causal moving average y[n] = (1/M) Σ_{k=0}^{M-1} x[n-k]; samples before the start repeat x[0]. */
export function movingAverage(x: ArrayLike<number>, M: number): Float64Array {
  const y = new Float64Array(x.length);
  let s = x[0] * M;
  for (let n = 0; n < x.length; n++) {
    s += x[n] - (n - M >= 0 ? x[n - M] : x[0]);
    y[n] = s / M;
  }
  return y;
}

/** Moving-average frequency response: |sin(πfM/fs) / (M sin(πf/fs))|, linear phase (delay (M-1)/2 samples). */
export function movingAverageResponse(M: number, freqs: ArrayLike<number>, fs: number): Float64Array {
  return Float64Array.from(freqs, (f) => {
    const a = (Math.PI * f) / fs;
    return Math.abs(a) < 1e-12 ? 1 : Math.abs(Math.sin(M * a) / (M * Math.sin(a)));
  });
}

/** Exponential moving average y[n] = α x[n] + (1-α) y[n-1], with α = 2/(M+1) ("span" M). */
export function ema(x: ArrayLike<number>, M: number): Float64Array {
  const a = 2 / (M + 1);
  const y = new Float64Array(x.length);
  let prev = x[0];
  for (let n = 0; n < x.length; n++) y[n] = prev = a * x[n] + (1 - a) * prev;
  return y;
}

export function emaResponse(M: number, freqs: ArrayLike<number>, fs: number): Float64Array {
  const a = 2 / (M + 1);
  return Float64Array.from(freqs, (f) => {
    const w = (2 * Math.PI * f) / fs;
    return a / Math.hypot(1 - (1 - a) * Math.cos(w), (1 - a) * Math.sin(w));
  });
}

export const toDb = (v: number) => 20 * Math.log10(Math.max(v, 1e-12));
