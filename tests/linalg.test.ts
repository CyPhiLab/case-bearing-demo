import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fitPCA, symmetricEigen } from '../src/lib/ml/linalg';
import { buildDataset, featureTable, type Manifest } from '../src/lib/data';

describe('symmetricEigen', () => {
  it('satisfies A v = λ v', () => {
    const A = [
      [4, 1, 2, 0.5],
      [1, 3, 0, 1],
      [2, 0, 5, 1.5],
      [0.5, 1, 1.5, 2],
    ];
    const { values, vectors } = symmetricEigen(A);
    expect(values[0]).toBeGreaterThanOrEqual(values[1]);
    vectors.forEach((v, k) => {
      const Av = A.map((row) => row.reduce((s, a, j) => s + a * v[j], 0));
      Av.forEach((x, i) => expect(x).toBeCloseTo(values[k] * v[i], 9));
    });
  });
});

describe('PCA on the bearing features', () => {
  it('matches scikit-learn explained variance (0.510, 0.198 for PC1, PC2)', () => {
    const manifest: Manifest = JSON.parse(readFileSync('public/data/recordings.json', 'utf8'));
    const bufs = manifest.recordings.map((r) => {
      const b = readFileSync(`public/data/signals/${r.id}.i16`);
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    });
    const rows = featureTable(buildDataset(manifest, bufs)).filter((r) => r.split !== 'test');
    const pca = fitPCA(rows.map((r) => r.x));
    expect(pca.explained[0]).toBeCloseTo(0.5104, 3);
    expect(pca.explained[1]).toBeCloseTo(0.1979, 3);
  });
});
