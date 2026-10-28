// Play any clip at its true speed. Web Audio buffers need fs ≥ 3 kHz, so slower clips are
// linearly interpolated up first. Peaks are normalized so quiet and loud clips play alike.
import { play, stop } from '../../lib/audio';

export function playClip(x: ArrayLike<number>, fs: number, onended?: () => void, peak?: number) {
  const k = fs >= 3000 ? 1 : Math.ceil(3000 / fs);
  const y = new Float64Array((x.length - 1) * k + 1);
  for (let i = 0; i < x.length - 1; i++) for (let j = 0; j < k; j++) y[i * k + j] = x[i] + ((x[i + 1] - x[i]) * j) / k;
  y[y.length - 1] = x[x.length - 1];
  let m = 0;
  for (const v of y) m += v;
  m /= y.length;
  let pk = peak ?? 0;
  if (peak === undefined) for (const v of y) pk = Math.max(pk, Math.abs(v - m));
  for (let i = 0; i < y.length; i++) y[i] -= m;
  play(y, { fs: fs * k, slow: 1, gain: 0.8 / (pk || 1), from: 0, onended });
}

export { stop };
