import { describe, expect, it } from 'vitest';
import { Ring, estimateF0, noteName } from '../src/signals/lib/live';
import { resample, simulateRecord } from '../src/signals/lib/motion';
import { fft, hanning } from '../src/lib/dsp/fft';

function magnitude(x: Float64Array) {
  const n = x.length, w = hanning(n);
  const re = Float64Array.from(x, (v, i) => v * w[i]), im = new Float64Array(n);
  fft(re, im);
  return Float64Array.from({ length: n / 2 }, (_, k) => Math.hypot(re[k], im[k]));
}

describe('live audio helpers', () => {
  it('ring buffer returns the latest samples across the wrap-around', () => {
    const r = new Ring(10, 1); // 10 samples
    r.push(Float32Array.from({ length: 7 }, (_, i) => i));
    r.push(Float32Array.from({ length: 7 }, (_, i) => 7 + i));
    expect(Array.from(r.latest(5))).toEqual([9, 10, 11, 12, 13]);
    expect(Array.from(r.range(10, 3))).toEqual([10, 11, 12]);
  });

  it('finds the fundamental even when a higher harmonic is loudest', () => {
    const fs = 48000, n = 8192, f0 = 349;
    const x = Float64Array.from({ length: n }, (_, i) => {
      let v = 0;
      for (let k = 1; k <= 8; k++) v += Math.sin((2 * Math.PI * k * f0 * i) / fs) * (k === 3 ? 1 : 0.3 / k);
      return v;
    });
    expect(estimateF0(magnitude(x), fs / n)).toBeCloseTo(f0, -0.5);
  });

  it('finds the fundamental of an odd-harmonic (clarinet-like) tone', () => {
    const fs = 48000, n = 8192, f0 = 231;
    const x = Float64Array.from({ length: n }, (_, i) => [1, 3, 5, 7].reduce((s, k) => s + Math.sin((2 * Math.PI * k * f0 * i) / fs) / k, 0));
    expect(Math.abs(estimateF0(magnitude(x), fs / n) - f0)).toBeLessThan(1);
  });

  it('names notes', () => {
    expect(noteName(440)).toBe('A4 +0¢');
    expect(noteName(261.63)).toBe('C4 +0¢');
  });
});

describe('phone motion helpers', () => {
  it('linear resampling reproduces a straight line exactly', () => {
    const t = Float64Array.from([0, 0.011, 0.019, 0.031, 0.04]);
    const v = t.map((tt) => 3 * tt + 1);
    const y = resample(t, v, 100);
    expect(y.length).toBe(5);
    y.forEach((val, i) => expect(val).toBeCloseTo(3 * (i / 100) + 1, 10));
  });

  it('simulated records are jittered but keep the nominal rate', () => {
    const r = simulateRecord(new Float64Array(1000), 100);
    const rate = (r.t.length - 1) / r.t[r.t.length - 1];
    expect(rate).toBeGreaterThan(99);
    expect(rate).toBeLessThan(101);
    for (let i = 1; i < r.t.length; i++) expect(r.t[i]).toBeGreaterThanOrEqual(r.t[i - 1]);
  });
});
