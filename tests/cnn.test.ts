import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as tf from '@tensorflow/tfjs';
import { BearingCNN, type CNNSpec } from '../src/lib/ml/cnn';
import { decodeSignal, type Manifest } from '../src/lib/data';

describe('pretrained CNN in TensorFlow.js matches PyTorch', async () => {
  await tf.setBackend('cpu');
  const spec: CNNSpec = JSON.parse(readFileSync('public/data/cnn/model.json', 'utf8'));
  const wbuf = readFileSync('public/data/cnn/weights.bin');
  const cnn = BearingCNN.fromBuffers(spec, wbuf.buffer.slice(wbuf.byteOffset, wbuf.byteOffset + wbuf.byteLength));
  const manifest: Manifest = JSON.parse(readFileSync('public/data/recordings.json', 'utf8'));
  const fixture = JSON.parse(readFileSync('tests/fixtures/cnn.json', 'utf8'));
  for (const c of fixture.cases) {
    it(c.id, () => {
      const meta = manifest.recordings.find((r) => r.id === c.id)!;
      const b = readFileSync(`public/data/signals/${c.id}.i16`);
      const sig = decodeSignal(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), meta.scale);
      const { probs, activations } = cnn.run(sig.subarray(c.start, c.start + spec.frame));
      // compare log-probabilities: the tiny off-class values are what reveal a wrong weight layout
      probs.forEach((p, i) => expect(Math.log(p)).toBeCloseTo(Math.log(c.probs[i]), 1));
      expect(activations.length).toBe(spec.conv.length);
    });

    it(`${c.id}: a hand-computed first convolution matches the network's conv1 layer`, () => {
      const meta = manifest.recordings.find((r) => r.id === c.id)!;
      const b = readFileSync(`public/data/signals/${c.id}.i16`);
      const sig = decodeSignal(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), meta.scale);
      const win = sig.subarray(c.start, c.start + spec.frame);
      const x = cnn.normalize(win);
      const conv1 = cnn.run(win).activations[0];
      for (const f of [0, 5, 11]) {
        const k = cnn.kernels[f];
        for (const t of [0, 100, 777, conv1.length - 1]) {
          let s = cnn.conv1Bias[f];
          for (let j = 0; j < k.length; j++) s += x[t + j] * k[j];
          expect(conv1[t][f]).toBeCloseTo(Math.max(0, s), 4);
        }
      }
    });
  }
});
