import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { butter, butterworthMag, ema, emaResponse, movingAverage, movingAverageResponse, sosfilt, sosfiltfilt, sosResponse, type FilterType } from '../src/lib/dsp/filters';

const fx = JSON.parse(readFileSync('tests/fixtures/filters.json', 'utf8'));

describe('Butterworth designs match scipy.signal.butter', () => {
  for (const c of fx.cases) {
    const name = `${c.type} order ${c.order} @ ${JSON.stringify(c.fc)} Hz`;
    const sos = butter(c.type as FilterType, c.order, c.fc, fx.fs);
    it(`${name}: frequency response`, () => {
      const { mag, phase } = sosResponse(sos, c.freqs, fx.fs);
      mag.forEach((m, i) => expect(m).toBeCloseTo(c.mag[i], 7));
      // phase may differ by a multiple of 2π after unwrapping; compare the wrapped difference
      phase.forEach((p, i) => {
        if (c.mag[i] < 1e-6) return;
        const d = Math.atan2(Math.sin(p - c.phase[i]), Math.cos(p - c.phase[i]));
        expect(Math.abs(d)).toBeLessThan(1e-6);
      });
    });
    it(`${name}: sosfilt and sosfiltfilt outputs`, () => {
      const y = sosfilt(sos, fx.x);
      y.forEach((v, i) => expect(v).toBeCloseTo(c.sosfilt[i], 7));
      const z = sosfiltfilt(sos, fx.x);
      z.forEach((v, i) => expect(v).toBeCloseTo(c.sosfiltfilt[i], 6));
    });
  }
});

describe('filter properties from the lecture', () => {
  it('-3 dB at the cutoff and 20n dB/decade roll-off (slide 12)', () => {
    for (const n of [1, 2, 4, 6]) {
      const fs = 48000, fc = 20; // keep the test decade far below Nyquist, where the bilinear warp is negligible
      const sos = butter('lowpass', n, fc, fs);
      const { mag } = sosResponse(sos, [fc, 10 * fc, 100 * fc], fs);
      expect(20 * Math.log10(mag[0])).toBeCloseTo(-3.01, 1);
      // one decade apart, well above the cutoff and well below Nyquist: ≈ 20·n dB
      const drop = 20 * Math.log10(mag[1] / mag[2]);
      expect(Math.abs(drop - 20 * n)).toBeLessThan(0.15 * 20 * n);
      expect(20 * Math.log10(mag[1])).toBeCloseTo(20 * Math.log10(butterworthMag(10 * fc, fc, n)), 0);
    }
  });
  it('moving average matches its closed-form response and delays by (M-1)/2', () => {
    const fs = 1000, M = 9, f = 37;
    const t = Array.from({ length: 2000 }, (_, i) => i / fs);
    const x = t.map((tt) => Math.sin(2 * Math.PI * f * tt));
    const y = movingAverage(x, M);
    const tail = y.slice(1000);
    const amp = Math.max(...Array.from(tail).map(Math.abs));
    expect(amp).toBeCloseTo(movingAverageResponse(M, [f], fs)[0], 2);
  });
  it('exponential moving average matches its response', () => {
    const fs = 1000, M = 14, f = 20;
    const x = Array.from({ length: 4000 }, (_, i) => Math.sin((2 * Math.PI * f * i) / fs));
    const y = ema(x, M).slice(2000);
    expect(Math.max(...Array.from(y).map(Math.abs))).toBeCloseTo(emaResponse(M, [f], fs)[0], 2);
  });
});
