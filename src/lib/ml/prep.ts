// Turn the feature table into z-scored train/val/test arrays for the classifiers.
import type { Dataset, Sample } from '../data';
import { fitPCA, fitScaler, projectPCA, transform, type PCAModel } from './linalg';
import type { TrainData } from './trainTypes';

export interface Prepared extends TrainData {
  testRows: Sample[];
}

export interface PrepOptions {
  /** feature indices to use (default: all) */
  features?: number[];
  /** fraction of the training windows to keep (stratified by recording, earliest first) */
  trainFraction?: number;
  /** recordings whose windows are all moved to the test set (e.g. an unseen defect size) */
  holdoutRecs?: (rec: number) => boolean;
}

function pickFeatures(rows: Sample[], cols?: number[]) {
  return rows.map((r) => (cols ? cols.map((j) => r.x[j]) : r.x));
}

function thin(rows: Sample[], frac: number): Sample[] {
  if (frac >= 1) return rows;
  const byRec = new Map<number, Sample[]>();
  for (const r of rows) byRec.set(r.rec, [...(byRec.get(r.rec) ?? []), r]);
  // spread the kept windows evenly through each recording's training block
  return [...byRec.values()].flatMap((rs) => {
    const keep = Math.max(2, Math.round(rs.length * frac));
    return Array.from({ length: keep }, (_, i) => rs[Math.floor((i * rs.length) / keep)]);
  });
}

export function prepare(rows: Sample[], nClasses: number, o: PrepOptions = {}): Prepared {
  const out = (r: Sample) => o.holdoutRecs?.(r.rec) ?? false;
  const train = thin(rows.filter((r) => r.split === 'train' && !out(r)), o.trainFraction ?? 1);
  const val = rows.filter((r) => r.split === 'val' && !out(r));
  const test = o.holdoutRecs ? rows.filter((r) => out(r) || (r.split === 'test' && r.y === 0)) : rows.filter((r) => r.split === 'test');
  const scaler = fitScaler(pickFeatures(train, o.features));
  return {
    xTrain: transform(scaler, pickFeatures(train, o.features)),
    yTrain: train.map((r) => r.y),
    xVal: transform(scaler, pickFeatures(val, o.features)),
    yVal: val.map((r) => r.y),
    xTest: transform(scaler, pickFeatures(test, o.features)),
    yTest: test.map((r) => r.y),
    nClasses,
    testRows: test,
  };
}

export interface PCASpace {
  model: PCAModel;
  coords: number[][]; // PC1..PCk for every row
  rows: Sample[];
}

/** PCA fitted on the training windows only, applied to every window. */
export function pcaSpace(rows: Sample[], features?: number[], k = 2): PCASpace {
  const train = rows.filter((r) => r.split === 'train');
  const model = fitPCA(pickFeatures(train, features));
  return { model, coords: projectPCA(model, pickFeatures(rows, features), k), rows };
}

/** Two-input dataset in PC1/PC2 space, for drawing decision boundaries. */
export function prepare2D(space: PCASpace, nClasses: number): Prepared & { grid: { x0: number; x1: number; y0: number; y1: number; n: number } } {
  const { rows, coords } = space;
  const pick = (s: string) => rows.map((r, i) => ({ r, c: coords[i] })).filter(({ r }) => r.split === s);
  const tr = pick('train'), va = pick('val'), te = pick('test');
  const xs = coords.map((c) => c[0]), ys = coords.map((c) => c[1]);
  const pad = (a: number[]) => {
    const lo = Math.min(...a), hi = Math.max(...a), p = (hi - lo) * 0.06;
    return [lo - p, hi + p];
  };
  const [x0, x1] = pad(xs), [y0, y1] = pad(ys);
  return {
    xTrain: tr.map((v) => v.c), yTrain: tr.map((v) => v.r.y),
    xVal: va.map((v) => v.c), yVal: va.map((v) => v.r.y),
    xTest: te.map((v) => v.c), yTest: te.map((v) => v.r.y),
    nClasses,
    testRows: te.map((v) => v.r),
    grid: { x0, x1, y0, y1, n: 70 },
  };
}

export const datasetClasses = (ds: Dataset) => ds.classes.length;
