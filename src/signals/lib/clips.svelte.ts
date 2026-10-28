// Signals that every lab on the page can work on: a few built-in examples plus anything the
// student records with the microphone or their phone during the session.
import { gaussian, linspace } from '../../lib/dsp/signals';

export interface Clip {
  id: string;
  name: string;
  fs: number;
  x: Float64Array;
  units: string;
  note?: string;
  recorded?: boolean;
}

function slide5(): Clip {
  const fs = 200;
  const t = linspace(4 * fs, 1 / fs);
  const n = gaussian(t.length, 0.3, 5);
  return { id: 'slide5', name: 'y = 2 + sin 2πt, plus noise', fs, x: t.map((tt, i) => 2 + Math.sin(2 * Math.PI * tt) + n[i]), units: 'V' };
}

function hum(): Clip {
  const fs = 2000;
  const t = linspace(2 * fs, 1 / fs);
  const n = gaussian(t.length, 0.15, 6);
  return {
    id: 'hum',
    name: 'Sensor signal + 60 Hz mains hum',
    fs,
    x: t.map((tt, i) => Math.sin(2 * Math.PI * 5 * tt) + 0.6 * Math.sin(2 * Math.PI * 60 * tt) + 0.2 * Math.sin(2 * Math.PI * 180 * tt + 1) + n[i]),
    units: 'V',
  };
}

function chirp(): Clip {
  const fs = 16000;
  const T = 3;
  const t = linspace(T * fs, 1 / fs);
  const f0 = 100, f1 = 6000;
  // exponential sweep so every octave gets equal time
  const k = Math.log(f1 / f0) / T;
  return { id: 'chirp', name: 'Sweep 100 Hz → 6 kHz', fs, x: t.map((tt) => 0.6 * Math.sin(((2 * Math.PI * f0) / k) * (Math.exp(k * tt) - 1))), units: '' };
}

function fan(): Clip {
  // Simulated: what a phone (100 Hz accelerometer) on a table next to a 3-blade fan at 20 rev/s might record
  const fs = 100;
  const t = linspace(10 * fs, 1 / fs);
  const n = gaussian(t.length, 0.01, 8);
  return {
    id: 'fan',
    name: 'Simulated: phone on a table by a fan',
    fs,
    x: t.map((tt, i) => 0.03 * Math.sin(2 * Math.PI * 20 * tt) + 0.02 * Math.sin(2 * Math.PI * 60 * tt + 0.5) + n[i]),
    units: 'm/s²',
    note: 'Simulated: 20 Hz shaft imbalance plus a 60 Hz blade-pass tone, which a 100 Hz phone aliases down to 40 Hz.',
  };
}

export const clips = $state<Clip[]>([slide5(), hum(), chirp(), fan()]);

export function addClip(c: Clip) {
  const i = clips.findIndex((k) => k.id === c.id);
  if (i >= 0) clips[i] = c;
  else clips.push(c);
}
