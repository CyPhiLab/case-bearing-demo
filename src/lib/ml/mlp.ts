// A small, dependency-free multilayer perceptron: dense layers, ReLU/tanh/sigmoid, softmax output,
// cross-entropy loss with class weights, inverted dropout, L2, and Adam. Written out by hand
// (rather than TensorFlow.js) because for networks this small, plain loops are ~10x faster,
// and it keeps the math visible: forward pass, backprop, update.
import type { Activation } from './trainTypes';

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const act = {
  relu: (z: number) => (z > 0 ? z : 0),
  tanh: Math.tanh,
  sigmoid: (z: number) => 1 / (1 + Math.exp(-z)),
};
// derivative written in terms of the activation output a
const dact = {
  relu: (a: number) => (a > 0 ? 1 : 0),
  tanh: (a: number) => 1 - a * a,
  sigmoid: (a: number) => a * (1 - a),
};

export interface MLPOptions {
  sizes: number[]; // [inputs, ...hidden, classes]
  activation: Activation;
  dropout: number;
  l2: number;
  lr: number;
  seed: number;
}

export class MLP {
  W: Float64Array[]; // layer l: sizes[l] x sizes[l+1], row-major [i * out + j]
  b: Float64Array[];
  private mW: Float64Array[];
  private vW: Float64Array[];
  private mb: Float64Array[];
  private vb: Float64Array[];
  private gW: Float64Array[];
  private gb: Float64Array[];
  private step = 0;
  private rand: () => number;

  constructor(readonly o: MLPOptions) {
    this.rand = mulberry32(o.seed);
    const L = o.sizes.length - 1;
    this.W = [];
    this.b = [];
    for (let l = 0; l < L; l++) {
      const nin = o.sizes[l], nout = o.sizes[l + 1];
      const lim = Math.sqrt(6 / (nin + nout)); // Glorot uniform
      this.W.push(Float64Array.from({ length: nin * nout }, () => (this.rand() * 2 - 1) * lim));
      this.b.push(new Float64Array(nout));
    }
    const zeros = (arr: Float64Array[]) => arr.map((a) => new Float64Array(a.length));
    this.mW = zeros(this.W); this.vW = zeros(this.W); this.gW = zeros(this.W);
    this.mb = zeros(this.b); this.vb = zeros(this.b); this.gb = zeros(this.b);
  }

  get paramCount() {
    return this.W.reduce((s, w) => s + w.length, 0) + this.b.reduce((s, b) => s + b.length, 0);
  }

  /**
   * Forward pass. `outs[l]` is what layer l hands to the next layer (after activation and dropout),
   * `acts[l]` the activation before dropout and `scales[l]` the dropout multiplier (0 or 1/(1-p)).
   */
  private forward(x: ArrayLike<number>, train: boolean) {
    const { sizes, activation, dropout } = this.o;
    const f = act[activation];
    const outs: Float64Array[] = [Float64Array.from(x)];
    const acts: Float64Array[] = [outs[0]];
    const scales: (Float64Array | null)[] = [null];
    const L = sizes.length - 1;
    for (let l = 0; l < L; l++) {
      const a = outs[l], W = this.W[l], b = this.b[l];
      const nin = sizes[l], nout = sizes[l + 1];
      const z = Float64Array.from(b);
      for (let i = 0; i < nin; i++) {
        const ai = a[i];
        if (ai === 0) continue;
        const row = i * nout;
        for (let j = 0; j < nout; j++) z[j] += ai * W[row + j];
      }
      if (l < L - 1) {
        for (let j = 0; j < nout; j++) z[j] = f(z[j]);
        acts.push(z);
        if (train && dropout > 0) {
          const sc = new Float64Array(nout);
          const out = new Float64Array(nout);
          for (let j = 0; j < nout; j++) {
            sc[j] = this.rand() < dropout ? 0 : 1 / (1 - dropout);
            out[j] = z[j] * sc[j];
          }
          scales.push(sc);
          outs.push(out);
        } else {
          scales.push(null);
          outs.push(z);
        }
      } else {
        let m = -Infinity;
        for (let j = 0; j < nout; j++) m = Math.max(m, z[j]);
        let s = 0;
        for (let j = 0; j < nout; j++) s += (z[j] = Math.exp(z[j] - m));
        for (let j = 0; j < nout; j++) z[j] /= s;
        acts.push(z);
        scales.push(null);
        outs.push(z);
      }
    }
    return { outs, acts, scales };
  }

  predict(x: ArrayLike<number>): Float64Array {
    const { outs } = this.forward(x, false);
    return outs[outs.length - 1];
  }

  /** Accumulate summed loss gradients for a minibatch into gW / gb (backpropagation). */
  backprop(X: number[][], y: number[], idx: number[], classWeight: number[]) {
    const { sizes, activation } = this.o;
    const L = sizes.length - 1;
    const da = dact[activation];
    for (const g of this.gW) g.fill(0);
    for (const g of this.gb) g.fill(0);
    let loss = 0, correct = 0, wsum = 0;
    for (const n of idx) {
      const { outs, acts, scales } = this.forward(X[n], true);
      const p = outs[L];
      const w = classWeight[y[n]];
      wsum += w;
      loss += -w * Math.log(Math.max(p[y[n]], 1e-12));
      let arg = 0;
      for (let j = 1; j < p.length; j++) if (p[j] > p[arg]) arg = j;
      if (arg === y[n]) correct++;
      // delta at the output: softmax + cross-entropy => p - onehot
      let delta = Float64Array.from(p);
      delta[y[n]] -= 1;
      for (let j = 0; j < delta.length; j++) delta[j] *= w;
      for (let l = L - 1; l >= 0; l--) {
        const a = outs[l], nin = sizes[l], nout = sizes[l + 1], W = this.W[l], gW = this.gW[l], gb = this.gb[l];
        for (let j = 0; j < nout; j++) gb[j] += delta[j];
        const prev = l > 0 ? new Float64Array(nin) : null;
        for (let i = 0; i < nin; i++) {
          const ai = a[i], row = i * nout;
          let s = 0;
          for (let j = 0; j < nout; j++) {
            gW[row + j] += ai * delta[j];
            s += W[row + j] * delta[j];
          }
          // through dropout (scale) and the activation derivative
          if (prev) prev[i] = s * (scales[l]?.[i] ?? 1) * da(acts[l][i]);
        }
        if (prev) delta = prev;
      }
    }
    return { loss, correct, wsum };
  }

  /** Summed gradient of the last backprop() call, for testing. */
  get gradients() {
    return { gW: this.gW, gb: this.gb };
  }

  /** One gradient step on a minibatch. Returns the batch's summed weighted loss and correct count. */
  trainBatch(X: number[][], y: number[], idx: number[], classWeight: number[]) {
    const { sizes, l2, lr } = this.o;
    const L = sizes.length - 1;
    const r = this.backprop(X, y, idx, classWeight);
    // Adam update on the mean gradient (+ L2 penalty l2 * sum(W^2), as in Keras)
    this.step++;
    const b1 = 0.9, b2 = 0.999, eps = 1e-7;
    const c1 = 1 - b1 ** this.step, c2 = 1 - b2 ** this.step;
    const m = idx.length;
    const upd = (P: Float64Array, G: Float64Array, M: Float64Array, V: Float64Array, decay: boolean) => {
      for (let k = 0; k < P.length; k++) {
        const g = G[k] / m + (decay ? 2 * l2 * P[k] : 0);
        M[k] = b1 * M[k] + (1 - b1) * g;
        V[k] = b2 * V[k] + (1 - b2) * g * g;
        P[k] -= (lr * (M[k] / c1)) / (Math.sqrt(V[k] / c2) + eps);
      }
    };
    for (let l = 0; l < L; l++) {
      upd(this.W[l], this.gW[l], this.mW[l], this.vW[l], l2 > 0);
      upd(this.b[l], this.gb[l], this.mb[l], this.vb[l], false);
    }
    return r;
  }

  /** One pass over the training set in shuffled minibatches. */
  epoch(X: number[][], y: number[], batchSize: number, classWeight: number[]) {
    const order = X.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    let loss = 0, correct = 0;
    for (let s = 0; s < order.length; s += batchSize) {
      const r = this.trainBatch(X, y, order.slice(s, s + batchSize), classWeight);
      loss += r.loss;
      correct += r.correct;
    }
    return { loss: loss / X.length + this.l2Penalty(), acc: correct / X.length };
  }

  l2Penalty() {
    if (!this.o.l2) return 0;
    let s = 0;
    for (const W of this.W) for (const w of W) s += w * w;
    return this.o.l2 * s;
  }

  evaluate(X: number[][], y: number[]) {
    let loss = 0, correct = 0;
    X.forEach((x, n) => {
      const p = this.predict(x);
      loss += -Math.log(Math.max(p[y[n]], 1e-12));
      let arg = 0;
      for (let j = 1; j < p.length; j++) if (p[j] > p[arg]) arg = j;
      if (arg === y[n]) correct++;
    });
    return { loss: loss / X.length, acc: correct / X.length };
  }

  /** Weights as nested arrays [layer][in][out], for drawing. */
  kernels(): number[][][] {
    return this.W.map((W, l) => {
      const nin = this.o.sizes[l], nout = this.o.sizes[l + 1];
      return Array.from({ length: nin }, (_, i) => Array.from(W.subarray(i * nout, (i + 1) * nout)));
    });
  }
}
