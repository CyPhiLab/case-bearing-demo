import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allFeatures, FEATURES } from '../src/lib/dsp/features';
import { fft, hanning } from '../src/lib/dsp/fft';
import { decodeSignal, windowStarts, type Manifest } from '../src/lib/data';
import { faultFrequencies } from '../src/lib/bearing';

const manifest: Manifest = JSON.parse(readFileSync('public/data/recordings.json', 'utf8'));
const signal = (id: string) => {
  const buf = readFileSync(`public/data/signals/${id}.i16`);
  const meta = manifest.recordings.find((r) => r.id === id)!;
  return decodeSignal(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), meta.scale);
};

describe('fft', () => {
  it('matches a direct DFT', () => {
    const n = 64;
    const x = Array.from({ length: n }, (_, i) => Math.sin(i * 0.7) + 0.3 * Math.cos(i * 2.1) + (i % 5) * 0.1);
    const re = Float64Array.from(x);
    const im = new Float64Array(n);
    fft(re, im);
    for (const k of [0, 1, 7, 31, 32, 50]) {
      let dr = 0, di = 0;
      for (let t = 0; t < n; t++) {
        dr += x[t] * Math.cos((-2 * Math.PI * k * t) / n);
        di += x[t] * Math.sin((-2 * Math.PI * k * t) / n);
      }
      expect(re[k]).toBeCloseTo(dr, 9);
      expect(im[k]).toBeCloseTo(di, 9);
    }
  });

  it('inverse round-trips', () => {
    const re = Float64Array.from({ length: 128 }, (_, i) => Math.sin(i));
    const orig = re.slice();
    const im = new Float64Array(128);
    fft(re, im);
    fft(re, im, true);
    for (let i = 0; i < 128; i++) expect(re[i] / 128).toBeCloseTo(orig[i], 10);
  });

  it('hanning matches numpy definition', () => {
    const w = hanning(5);
    expect(Array.from(w)).toEqual([0, 0.5, 1, 0.5, 0].map((v, i) => expect.closeTo(v, 12) as unknown as number));
  });
});

describe('features match the Python pipeline', () => {
  const fixture = JSON.parse(readFileSync('tests/fixtures/parity.json', 'utf8'));
  it('uses the same feature order', () => {
    expect(FEATURES.map((f) => f.key)).toEqual(fixture.features);
  });
  for (const c of fixture.cases) {
    it(`${c.id} @ ${c.start}`, () => {
      const x = signal(c.id).subarray(c.start, c.start + manifest.frame);
      const got = allFeatures(x);
      got.forEach((v, i) => {
        const want = c.values[i];
        expect(Math.abs(v - want)).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(want)));
      });
    });
  }
});

describe('windows', () => {
  it('reproduce the pipeline window count and never cross a split boundary', () => {
    const w = windowStarts(manifest.nSamples, manifest.frame, manifest.hop, manifest.splits);
    expect(w.length).toBe(113);
    for (const s of manifest.splits) {
      const lo = Math.round(s.from * manifest.nSamples), hi = Math.round(s.to * manifest.nSamples);
      for (const { start } of w.filter((v) => v.split === s.name)) {
        expect(start).toBeGreaterThanOrEqual(lo);
        expect(start + manifest.frame).toBeLessThanOrEqual(hi);
      }
    }
  });
});

describe('bearing kinematics', () => {
  it('matches the published CWRU multiples of shaft speed', () => {
    const f = faultFrequencies(60);
    expect(f.bpfi).toBeCloseTo(5.4152, 3);
    expect(f.bpfo).toBeCloseTo(3.5848, 3);
    expect(f.ftf).toBeCloseTo(0.39828, 4);
    expect(2 * f.bsf).toBeCloseTo(4.7135, 3);
  });
});

describe('IMS run-to-failure assets', () => {
  const trend = JSON.parse(readFileSync('public/data/ims/trend.json', 'utf8'));
  it('uses the Rexnord ZA-2115 outer-race frequency', async () => {
    const { faultFrequencies, IMS_BEARING } = await import('../src/lib/bearing');
    expect(faultFrequencies(2000, IMS_BEARING).bpfo).toBeCloseTo(trend.bpfo, 6);
  });
  it('alarms on the failing bearing days before the end', async () => {
    const { firstAlarm } = await import('../src/lib/ims');
    const a = firstAlarm(trend.indicators.envBPFO[0], trend.hours, 24, 5);
    const end = trend.hours.at(-1);
    expect(a.index).toBeGreaterThan(0);
    expect((end - trend.hours[a.index]) / 24).toBeGreaterThan(2);
  });
});

describe('Paderborn assets', () => {
  const pu: Manifest = JSON.parse(readFileSync('public/data/pu/recordings.json', 'utf8'));
  it('has healthy, machined and real-damage bearings at 12 kHz', () => {
    expect(pu.fs).toBe(12000);
    const kinds = new Set(pu.recordings.map((r) => r.damage));
    expect([...kinds].sort()).toEqual(['machined', 'none', 'real']);
    for (const r of pu.recordings) expect(readFileSync(`public/data/pu/signals/${r.id}.i16`).byteLength).toBe(2 * pu.nSamples);
  });
  it('6203 fault frequencies at 1500 rpm', async () => {
    const { faultFrequencies, PU_BEARING } = await import('../src/lib/bearing');
    const f = faultFrequencies(1500, PU_BEARING);
    expect(f.bpfo).toBeCloseTo(76.4, 0);
    expect(f.bpfi).toBeCloseTo(123.6, 0);
  });
});
