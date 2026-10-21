// Small dense linear-algebra helpers: z-score scaling and PCA via Jacobi eigen-decomposition.

export interface Scaler {
  mean: number[];
  std: number[];
}

export function fitScaler(X: number[][]): Scaler {
  const d = X[0].length;
  const mean = new Array(d).fill(0);
  const std = new Array(d).fill(0);
  for (const r of X) for (let j = 0; j < d; j++) mean[j] += r[j] / X.length;
  for (const r of X) for (let j = 0; j < d; j++) std[j] += (r[j] - mean[j]) ** 2 / X.length;
  for (let j = 0; j < d; j++) std[j] = Math.sqrt(std[j]) || 1;
  return { mean, std };
}

export const transform = (s: Scaler, X: number[][]) => X.map((r) => r.map((v, j) => (v - s.mean[j]) / s.std[j]));

/** Eigen-decomposition of a symmetric matrix. Returns eigenvalues (descending) and eigenvectors as rows. */
export function symmetricEigen(A: number[][]): { values: number[]; vectors: number[][] } {
  const n = A.length;
  const a = A.map((r) => r.slice());
  const v: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] ** 2;
    if (off < 1e-20) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-30) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p], akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k], aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p], vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[j][j] - a[i][i]);
  return {
    values: order.map((i) => a[i][i]),
    vectors: order.map((i) => {
      const col = v.map((r) => r[i]);
      // deterministic sign: largest loading positive
      const big = col.reduce((m, x) => (Math.abs(x) > Math.abs(m) ? x : m), 0);
      return big < 0 ? col.map((x) => -x) : col;
    }),
  };
}

export interface PCAModel {
  scaler: Scaler;
  components: number[][]; // rows
  explained: number[]; // variance ratio per component
}

/** PCA on z-scored data (i.e. on the correlation matrix). */
export function fitPCA(X: number[][]): PCAModel {
  const scaler = fitScaler(X);
  const Z = transform(scaler, X);
  const d = Z[0].length;
  const C = Array.from({ length: d }, () => new Array(d).fill(0));
  for (const r of Z) for (let i = 0; i < d; i++) for (let j = i; j < d; j++) C[i][j] += (r[i] * r[j]) / (Z.length - 1);
  for (let i = 0; i < d; i++) for (let j = 0; j < i; j++) C[i][j] = C[j][i];
  const { values, vectors } = symmetricEigen(C);
  const total = values.reduce((s, v) => s + Math.max(v, 0), 0);
  return { scaler, components: vectors, explained: values.map((v) => Math.max(v, 0) / total) };
}

export function projectPCA(m: PCAModel, X: number[][], k = 2): number[][] {
  return transform(m.scaler, X).map((r) => m.components.slice(0, k).map((c) => c.reduce((s, w, j) => s + w * r[j], 0)));
}
