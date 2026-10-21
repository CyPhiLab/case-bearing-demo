// Lazily loads TensorFlow.js + the pretrained CNN once, shared by every section that needs it.
import { dataUrl } from '../data';
import type { BearingCNN } from './cnn';

let cached: Promise<BearingCNN> | null = null;

export function loadCNN(): Promise<BearingCNN> {
  cached ??= import('./cnn').then((m) => m.BearingCNN.load(dataUrl('cnn/model.json'), dataUrl('cnn/weights.bin')));
  return cached;
}
