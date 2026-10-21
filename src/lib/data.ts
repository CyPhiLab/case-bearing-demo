// Loads the recordings exported by pipeline/prepare_data.py and turns them into ML-ready windows.
import { allFeatures } from './dsp/features';

export type Split = 'train' | 'val' | 'test';

export interface RecordingMeta {
  id: string;
  source: string;
  cls: string;
  size: number; // defect diameter, mil (0 for Normal)
  scale: number;
  rms: number;
  /** display label (otherwise derived from class + defect size) */
  label?: string;
  /** Paderborn: how the damage came about */
  damage?: 'none' | 'machined' | 'real';
  method?: string;
}

export interface Manifest {
  fs: number;
  nSamples: number;
  frame: number;
  hop: number;
  classes: string[];
  splits: { name: Split; from: number; to: number }[];
  recordings: RecordingMeta[];
}

export interface Recording extends RecordingMeta {
  clsIndex: number;
  signal: Float64Array; // acceleration in g
  label: string;
}

export interface Dataset {
  fs: number;
  frame: number;
  hop: number;
  classes: string[];
  splits: Manifest['splits'];
  recordings: Recording[];
}

export interface Sample {
  rec: number; // index into dataset.recordings
  start: number;
  split: Split;
  y: number;
  x: number[];
}

export const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/${path}`;

export function decodeSignal(buf: ArrayBuffer, scale: number): Float64Array {
  const view = new DataView(buf);
  const n = buf.byteLength / 2;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = view.getInt16(2 * i, true) * scale;
  return out;
}

export function recordingLabel(m: RecordingMeta): string {
  return m.size ? `${m.cls}, ${m.size} mil` : 'Normal';
}

export function buildDataset(manifest: Manifest, buffers: ArrayBuffer[]): Dataset {
  return {
    fs: manifest.fs,
    frame: manifest.frame,
    hop: manifest.hop,
    classes: manifest.classes,
    splits: manifest.splits,
    recordings: manifest.recordings.map((m, i) => ({
      ...m,
      clsIndex: manifest.classes.indexOf(m.cls),
      signal: decodeSignal(buffers[i], m.scale),
      label: m.label ?? recordingLabel(m),
    })),
  };
}

const cached = new Map<string, Promise<Dataset>>();

/** Load a dataset exported by the pipeline. `base` is '' for CWRU, 'pu/' for Paderborn. */
export function loadDataset(base = ''): Promise<Dataset> {
  if (!cached.has(base))
    cached.set(
      base,
      (async () => {
        const manifest: Manifest = await (await fetch(dataUrl(`${base}recordings.json`))).json();
        const buffers = await Promise.all(
          manifest.recordings.map(async (r) => (await fetch(dataUrl(`${base}signals/${r.id}.i16`))).arrayBuffer()),
        );
        return buildDataset(manifest, buffers);
      })(),
    );
  return cached.get(base)!;
}

/** Window start indices that lie entirely inside one split region (mirrors pipeline/common.py). */
export function windowStarts(n: number, frame: number, hop: number, splits: Manifest['splits']) {
  const out: { start: number; split: Split }[] = [];
  for (const s of splits) {
    const lo = Math.round(s.from * n);
    const hi = Math.round(s.to * n);
    for (let st = lo; st + frame <= hi; st += hop) out.push({ start: st, split: s.name });
  }
  return out;
}

/** Split region boundaries in samples for a recording of length n. */
export function splitRegions(n: number, splits: Manifest['splits']) {
  return splits.map((s) => ({ split: s.name, lo: Math.round(s.from * n), hi: Math.round(s.to * n) }));
}

const featureCache = new WeakMap<Dataset, Map<string, Sample[]>>();

/** Every window of every recording turned into an 18-feature sample. */
export function featureTable(ds: Dataset, frame = ds.frame, hop = ds.hop): Sample[] {
  const key = `${frame}/${hop}`;
  if (!featureCache.has(ds)) featureCache.set(ds, new Map());
  const hit = featureCache.get(ds)!.get(key);
  if (hit) return hit;
  const rows: Sample[] = [];
  ds.recordings.forEach((r, ri) => {
    for (const { start, split } of windowStarts(r.signal.length, frame, hop, ds.splits)) {
      rows.push({ rec: ri, start, split, y: r.clsIndex, x: allFeatures(r.signal.subarray(start, start + frame)) });
    }
  });
  featureCache.get(ds)!.set(key, rows);
  return rows;
}
