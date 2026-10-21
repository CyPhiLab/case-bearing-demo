// The pretrained 1D CNN (pipeline/train_cnn.py), rebuilt in TensorFlow.js from exported weights.
import * as tf from '@tensorflow/tfjs';

export interface CNNSpec {
  frame: number;
  mean: number;
  std: number;
  classes: string[];
  conv: { filters: number; kernel: number; dropout: number }[];
  dense: number;
  bnEpsilon: number;
  weights: { name: string; shape: number[] }[];
  testAccuracy: number;
  confusion: number[][];
  history: { epoch: number; loss: number; valLoss: number; valAcc: number }[];
}

export interface CNNOutput {
  probs: number[];
  /** Feature maps after each conv block's ReLU, as [time][channel]. */
  activations: number[][][];
}

export class BearingCNN {
  private constructor(
    readonly spec: CNNSpec,
    private model: tf.Sequential,
    private probe: tf.LayersModel,
    readonly kernels: number[][], // first-layer filters [filter][tap]
  ) {}

  static async load(specUrl: string, weightsUrl: string, fetchFn: typeof fetch = fetch): Promise<BearingCNN> {
    const spec: CNNSpec = await (await fetchFn(specUrl)).json();
    const buf = await (await fetchFn(weightsUrl)).arrayBuffer();
    return BearingCNN.fromBuffers(spec, buf);
  }

  static fromBuffers(spec: CNNSpec, buf: ArrayBuffer): BearingCNN {
    const flat = new Float32Array(buf);
    let off = 0;
    const tensors: Record<string, tf.Tensor> = {};
    for (const w of spec.weights) {
      const size = w.shape.reduce((a, b) => a * b, 1);
      tensors[w.name] = tf.tensor(flat.slice(off, off + size), w.shape);
      off += size;
    }

    const m = tf.sequential();
    const reluLayers: tf.layers.Layer[] = [];
    spec.conv.forEach((c, i) => {
      const conv = tf.layers.conv1d({
        filters: c.filters, kernelSize: c.kernel, activation: 'relu', name: `conv${i + 1}`,
        ...(i === 0 ? { inputShape: [spec.frame, 1] } : {}),
      });
      m.add(conv);
      reluLayers.push(conv);
      m.add(tf.layers.batchNormalization({ epsilon: spec.bnEpsilon, name: `bn${i + 1}` }));
      m.add(tf.layers.maxPooling1d({ poolSize: 2 }));
      m.add(tf.layers.dropout({ rate: c.dropout }));
    });
    m.add(tf.layers.globalAveragePooling1d());
    m.add(tf.layers.dense({ units: spec.dense, activation: 'relu', name: 'dense1' }));
    m.add(tf.layers.batchNormalization({ epsilon: spec.bnEpsilon, name: 'bn4' }));
    m.add(tf.layers.dropout({ rate: 0.3 }));
    m.add(tf.layers.dense({ units: spec.classes.length, activation: 'softmax', name: 'dense2' }));

    for (const layer of m.layers) {
      const n = layer.name;
      if (n.startsWith('conv') || n.startsWith('dense')) layer.setWeights([tensors[`${n}.kernel`], tensors[`${n}.bias`]]);
      else if (n.startsWith('bn'))
        layer.setWeights(['weight', 'bias', 'running_mean', 'running_var'].map((p) => tensors[`${n}.${p}`]));
    }
    const kernels = (tensors['conv1.kernel'].arraySync() as number[][][]) // [tap][in][filter]
      .reduce<number[][]>((acc, tap) => {
        tap[0].forEach((v, f) => (acc[f] ??= []).push(v));
        return acc;
      }, []);
    tf.dispose(Object.values(tensors));
    const probe = tf.model({ inputs: m.inputs, outputs: [...reluLayers.map((l) => l.output as tf.SymbolicTensor), m.outputs[0]] });
    return new BearingCNN(spec, m, probe, kernels);
  }

  /** Classify one raw window (acceleration in g). */
  run(window: ArrayLike<number>): CNNOutput {
    const { mean, std, frame } = this.spec;
    const norm = new Float32Array(frame);
    for (let i = 0; i < frame; i++) norm[i] = (window[i] - mean) / std;
    return tf.tidy(() => {
      const outs = this.probe.predict(tf.tensor3d(norm, [1, frame, 1])) as tf.Tensor[];
      const probs = (outs[outs.length - 1].arraySync() as number[][])[0];
      const activations = outs.slice(0, -1).map((t) => (t.arraySync() as number[][][])[0]);
      return { probs, activations };
    });
  }

  predict(windows: ArrayLike<number>[]): number[][] {
    const { mean, std, frame } = this.spec;
    const norm = new Float32Array(windows.length * frame);
    windows.forEach((w, j) => {
      for (let i = 0; i < frame; i++) norm[j * frame + i] = (w[i] - mean) / std;
    });
    return tf.tidy(() => (this.model.predict(tf.tensor3d(norm, [windows.length, frame, 1])) as tf.Tensor).arraySync() as number[][]);
  }
}
