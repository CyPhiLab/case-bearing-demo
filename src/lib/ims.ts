// NASA/IMS run-to-failure data (test 2), produced by pipeline/prepare_ims.py. Loaded lazily.
import { dataUrl, decodeSignal } from './data';

export type Indicator = 'rms' | 'kurtosis' | 'crest' | 'envBPFO';

export const INDICATORS: { key: Indicator; name: string; unit: string; blurb: string }[] = [
  { key: 'envBPFO', name: 'Envelope at BPFO', unit: 'g', blurb: 'Physics-based: the strength of the envelope of the 2–8 kHz resonance band at the outer-race ball-pass frequency.' },
  { key: 'rms', name: 'RMS', unit: 'g', blurb: 'Overall vibration level.' },
  { key: 'kurtosis', name: 'Kurtosis', unit: '', blurb: 'Peakedness of the waveform (0 for Gaussian noise).' },
  { key: 'crest', name: 'Crest factor', unit: '', blurb: 'Peak ÷ RMS.' },
];

export interface IMSTrend {
  fs: number;
  bpfo: number;
  envBand: [number, number];
  start: string;
  failedBearing: number;
  hours: number[];
  indicators: Record<Indicator, number[][]>; // [bearing][snapshot]
  features12k: number[][]; // bearing 1, 18 CWRU features per snapshot (resampled to 12 kHz)
  snapshots: { index: number; file: string; hours: number; scale: number }[];
}

export interface IMSData extends IMSTrend {
  signals: Float64Array[]; // bearing 1 raw snapshots, aligned with `snapshots`
}

let cached: Promise<IMSData> | null = null;

export function loadIMS(): Promise<IMSData> {
  cached ??= (async () => {
    const trend: IMSTrend = await (await fetch(dataUrl('ims/trend.json'))).json();
    const signals = await Promise.all(
      trend.snapshots.map(async (s) => decodeSignal(await (await fetch(dataUrl(`ims/snap_${s.index}.i16`))).arrayBuffer(), s.scale)),
    );
    return { ...trend, signals };
  })();
  return cached;
}

export const fmtDays = (h: number) => `day ${(h / 24).toFixed(1)}`;

/**
 * Simple condition-monitoring alarm: baseline = first `baselineHours` of data; alarm when the
 * indicator exceeds mean + k·std for `persist` consecutive snapshots. Returns the index that
 * triggered it (or -1) and the threshold.
 */
export function firstAlarm(values: number[], hours: number[], baselineHours: number, k: number, persist = 3) {
  const base = values.filter((_, i) => hours[i] <= baselineHours);
  const mean = base.reduce((a, b) => a + b, 0) / base.length;
  const std = Math.sqrt(base.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, base.length - 1));
  const threshold = mean + k * std;
  let run = 0;
  for (let i = 0; i < values.length; i++) {
    if (hours[i] <= baselineHours) continue;
    run = values[i] > threshold ? run + 1 : 0;
    if (run >= persist) return { index: i - persist + 1, threshold };
  }
  return { index: -1, threshold };
}
