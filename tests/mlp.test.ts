import { describe, expect, it } from 'vitest';
import { MLP } from '../src/lib/ml/mlp';

const X = [[0.5, -1.2, 0.3], [1.5, 0.2, -0.7], [-0.4, 0.9, 1.1], [0.1, 0.1, -2.0], [-1.3, -0.5, 0.4]];
const y = [0, 1, 2, 1, 0];
const cw = [1, 1.5, 0.7];

function lossOf(m: MLP) {
  return X.reduce((s, x, n) => s - cw[y[n]] * Math.log(m.predict(x)[y[n]]), 0);
}

describe('hand-written MLP', () => {
  for (const activation of ['relu', 'tanh', 'sigmoid'] as const) {
    it(`backprop matches numerical gradients (${activation})`, () => {
      const m = new MLP({ sizes: [3, 5, 4, 3], activation, dropout: 0, l2: 0, lr: 0.01, seed: 7 });
      // nudge biases off zero so no ReLU sits exactly on its kink (where the numerical slope is ill-defined)
      m.b.forEach((b) => b.forEach((_, i) => (b[i] = 0.05 * (i + 1))));
      m.backprop(X, y, X.map((_, i) => i), cw);
      const { gW, gb } = m.gradients;
      const h = 1e-6;
      for (let l = 0; l < m.W.length; l++) {
        for (const [P, G] of [[m.W[l], gW[l]], [m.b[l], gb[l]]] as const) {
          for (let k = 0; k < P.length; k += 3) {
            const old = P[k];
            P[k] = old + h;
            const up = lossOf(m);
            P[k] = old - h;
            const down = lossOf(m);
            P[k] = old;
            expect(G[k]).toBeCloseTo((up - down) / (2 * h), 5);
          }
        }
      }
    });
  }

  it('learns a nonlinear problem (XOR-style quadrants)', () => {
    const pts: number[][] = [], lab: number[] = [];
    for (let i = 0; i < 200; i++) {
      const a = Math.sin(i * 1.3) * 2, b = Math.cos(i * 0.7) * 2;
      pts.push([a, b]);
      lab.push(a * b > 0 ? 1 : 0);
    }
    const m = new MLP({ sizes: [2, 16, 2], activation: 'relu', dropout: 0, l2: 0, lr: 0.02, seed: 1 });
    for (let e = 0; e < 200; e++) m.epoch(pts, lab, 32, [1, 1]);
    expect(m.evaluate(pts, lab).acc).toBeGreaterThan(0.95);
  });
});
