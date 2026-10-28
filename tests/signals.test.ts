import { describe, expect, it } from 'vitest';
import { aliasFrequency, convolve, dftAmplitude, downsample, exactWave, fitFourier, fourierSeries, gaussian, linspace, mean, quantize, rms, std, stft, welch } from '../src/lib/dsp/signals';
import { movingAverage } from '../src/lib/dsp/filters';

describe('signal statistics (slide 6, book Eq. 2.5–2.6)', () => {
  it('rms² = mean² + std²', () => {
    const t = linspace(1000, 0.001);
    const y = t.map((tt) => 2 + Math.sin(2 * Math.PI * 5 * tt));
    expect(rms(y) ** 2).toBeCloseTo(mean(y) ** 2 + std(y) ** 2, 10);
    expect(mean(y)).toBeCloseTo(2, 6);
    expect(std(y)).toBeCloseTo(1 / Math.SQRT2, 3);
  });
  it('book Example 2.1: I = 10 sin t has I_rms = √50 over π and 2π', () => {
    for (const tf of [Math.PI, 2 * Math.PI]) {
      const t = linspace(20000, tf / 20000);
      expect(rms(t.map((tt) => 10 * Math.sin(tt)))).toBeCloseTo(Math.sqrt(50), 2);
    }
  });
});

describe('Fourier', () => {
  it('book Example 2.6/2.7: 10 sin 2πt, N = 8, δt = 0.125 s → 10 V at 1 Hz', () => {
    const y = Array.from({ length: 8 }, (_, r) => 10 * Math.sin(2 * Math.PI * r * 0.125));
    const { freq, amp } = dftAmplitude(y, 0.125);
    expect(Array.from(freq)).toEqual([0, 1, 2, 3]);
    expect(amp[1]).toBeCloseTo(10, 10);
    expect(amp[0] + amp[2] + amp[3]).toBeCloseTo(0, 10);
  });
  it('least-squares Fourier model recovers known coefficients', () => {
    const t = linspace(2000, 0.0005);
    const y = t.map((tt) => 0.5 + 3 * Math.sin(2 * Math.PI * 7 * tt + 0.4) + 1.2 * Math.sin(2 * Math.PI * 21 * tt - 1));
    const fit = fitFourier(t, y, 7, 4);
    expect(fit.A0).toBeCloseTo(0.5, 6);
    expect(fit.C[0]).toBeCloseTo(3, 6);
    expect(fit.phi[0]).toBeCloseTo(0.4, 6);
    expect(fit.C[2]).toBeCloseTo(1.2, 6);
    expect(fit.C[1]).toBeCloseTo(0, 6);
    expect(fit.r2).toBeCloseTo(1, 8);
  });
  it('square-wave partial sums converge to the waveform away from the jumps (book Ex. 2.4)', () => {
    expect(fourierSeries('square', 0.25, 200)).toBeCloseTo(exactWave('square', 0.25), 2);
    expect(fourierSeries('rectified', 0.3, 200, 120, 1 / 120)).toBeCloseTo(exactWave('rectified', 0.3, 120, 1 / 120), 0);
    expect(fourierSeries('rectified', 0, 0, 120)).toBeCloseTo(76.4, 1); // A0 = 2·120/π
  });
});

describe('sampling', () => {
  it('alias frequency folds about fs/2 (slide 8)', () => {
    expect(aliasFrequency(30, 100)).toBe(30);
    expect(aliasFrequency(70, 100)).toBe(30);
    expect(aliasFrequency(130, 100)).toBe(30);
    expect(aliasFrequency(100, 100)).toBe(0);
  });
  it('downsampling without anti-aliasing folds a tone; with it the tone is removed', () => {
    const fs = 12000;
    const t = linspace(12000, 1 / fs);
    const x = t.map((tt) => Math.sin(2 * Math.PI * 3000 * tt));
    const raw = downsample(x, fs, 3, false); // new fs = 4 kHz, Nyquist 2 kHz -> 3 kHz aliases to 1 kHz
    const spec = dftAmplitude(raw, 3 / fs, 'hann', 4096);
    const k = spec.amp.indexOf(Math.max(...spec.amp));
    expect(spec.freq[k]).toBeCloseTo(1000, -1);
    const aa = downsample(x, fs, 3, true);
    expect(rms(aa.slice(200, -200))).toBeLessThan(0.01);
  });
  it('quantization SNR ≈ 6.02·bits + 1.76 dB (+ 20 log A/FS)', () => {
    const t = linspace(20000, 1 / 20000);
    const A = 0.9; // below the top code (+FS - 1 LSB) so nothing clips
    const x = t.map((tt) => A * Math.sin(2 * Math.PI * 97.3 * tt));
    for (const bits of [6, 8, 10]) {
      const q = quantize(x, bits, 2);
      const err = q.map((v, i) => v - x[i]);
      const snr = 20 * Math.log10(rms(x) / rms(err));
      expect(Math.abs(snr - (6.02 * bits + 1.76 + 20 * Math.log10(A)))).toBeLessThan(1);
    }
  });
});

describe('spectra, averaging and convolution', () => {
  it('Welch averaging keeps the tone and smooths the noise floor', () => {
    const fs = 1000;
    const n = 1 << 14;
    const noise = gaussian(n, 1, 3);
    const x = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 125 * i) / fs) + noise[i]);
    const w = welch(x, fs, 512);
    const k = w.amp.indexOf(Math.max(...w.amp));
    expect(w.freq[k]).toBeCloseTo(125, 0);
    expect(w.segments).toBeGreaterThan(50);
  });
  it('averaging N noisy records improves SNR by √N', () => {
    const n = 4096, N = 16;
    const clean = Array.from({ length: n }, (_, i) => Math.sin(i / 20));
    const avg = new Float64Array(n);
    for (let r = 0; r < N; r++) gaussian(n, 1, 100 + r).forEach((v, i) => (avg[i] += (clean[i] + v) / N));
    const residual = Array.from(avg, (v, i) => v - clean[i]);
    expect(std(residual)).toBeCloseTo(1 / Math.sqrt(N), 1);
  });
  it('a moving average is a convolution with h = 1/M', () => {
    const x = gaussian(300, 1, 9);
    const M = 7;
    const viaConv = convolve(x, new Array(M).fill(1 / M));
    const viaMA = movingAverage(x, M);
    for (let i = M; i < 300; i++) expect(viaConv[i]).toBeCloseTo(viaMA[i], 12);
  });
  it('STFT finds a tone that switches frequency', () => {
    const fs = 8000;
    const x = Array.from({ length: 16000 }, (_, i) => Math.sin(2 * Math.PI * (i < 8000 ? 500 : 1500) * (i / fs)));
    const { frames, df } = stft(x, fs, 512, 256);
    const peak = (f: Float32Array) => f.indexOf(Math.max(...f)) * df;
    expect(peak(frames[2])).toBeCloseTo(500, -2);
    expect(peak(frames[frames.length - 3])).toBeCloseTo(1500, -2);
  });
});
