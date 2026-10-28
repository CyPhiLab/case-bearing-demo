// Live audio input for the microphone lab: a ring buffer fed either by the real microphone
// (through a tiny AudioWorklet that just copies samples out) or by a synthetic demo source.
// Nothing is recorded or sent anywhere unless the student presses "Record", and even then it stays in the page.

export class Ring {
  buf: Float32Array;
  total = 0;
  constructor(public fs: number, seconds = 6) {
    this.buf = new Float32Array(Math.ceil(fs * seconds));
  }
  push(block: ArrayLike<number>) {
    const n = this.buf.length;
    for (let i = 0; i < block.length; i++) this.buf[(this.total + i) % n] = block[i];
    this.total += block.length;
  }
  /** samples [start, start + count) by absolute index (must still be in the buffer) */
  range(start: number, count: number, out = new Float32Array(count)): Float32Array {
    const n = this.buf.length;
    for (let i = 0; i < count; i++) out[i] = this.buf[(((start + i) % n) + n) % n];
    return out;
  }
  /** the most recent `count` samples, oldest first (zeros before anything arrived) */
  latest(count: number, out = new Float32Array(count)): Float32Array {
    const n = this.buf.length;
    for (let i = 0; i < count; i++) {
      const k = this.total - count + i;
      out[i] = k < 0 ? 0 : this.buf[((k % n) + n) % n];
    }
    return out;
  }
}

export interface LiveSource {
  ring: Ring;
  label: string;
  stop(): void;
}

const WORKLET = `class Tap extends AudioWorkletProcessor {
  process(inputs) { const ch = inputs[0] && inputs[0][0]; if (ch) this.port.postMessage(ch.slice(0)); return true; }
}
registerProcessor('tap', Tap);`;

export async function startMic(): Promise<LiveSource> {
  const stream = await navigator.mediaDevices.getUserMedia({
    // raw signal, please: no echo cancellation / noise suppression / automatic gain
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const ctx = new AudioContext();
  await ctx.resume();
  const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const src = ctx.createMediaStreamSource(stream);
  const tap = new AudioWorkletNode(ctx, 'tap');
  const mute = ctx.createGain();
  mute.gain.value = 0;
  src.connect(tap).connect(mute).connect(ctx.destination); // must reach the destination to be pulled
  const ring = new Ring(ctx.sampleRate);
  tap.port.onmessage = (e: MessageEvent<Float32Array>) => ring.push(e.data);
  const track = stream.getAudioTracks()[0];
  return {
    ring,
    label: track?.label || 'microphone',
    stop() {
      tap.port.onmessage = null;
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}

export type DemoKind = 'clarinet' | 'trumpet' | 'whistle' | 'sweep';
export const DEMOS: { value: DemoKind; label: string }[] = [
  { value: 'clarinet', label: 'Clarinet-like (odd harmonics)' },
  { value: 'trumpet', label: 'Trumpet-like (all harmonics)' },
  { value: 'whistle', label: 'Whistle + room noise' },
  { value: 'sweep', label: 'Sweep 200 Hz → 8 kHz' },
];

/** A synthetic source that fills the ring in real time, for when there is no microphone (or permission). */
export function startDemo(kind: DemoKind, fs = 48000): LiveSource {
  const ring = new Ring(fs);
  let n = 0;
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const t0 = performance.now();
  let phase = 0; // integrated phase of the fundamental, so vibrato and glides stay in tune
  const sample = (t: number) => {
    const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5 * t);
    switch (kind) {
      case 'clarinet': {
        phase += (2 * Math.PI * 231 * vib) / fs; // book Fig. 2.20: a clarinet one whole tone below middle C
        let v = 0;
        for (let k = 1; k <= 15; k += 2) v += Math.sin(k * phase) / k ** 1.1;
        return 0.25 * v + 0.003 * rnd();
      }
      case 'trumpet': {
        phase += (2 * Math.PI * 349 * vib) / fs;
        let v = 0;
        for (let k = 1; k <= 14; k++) v += (Math.sin(k * phase + k) * Math.exp(-Math.abs(k - 3) / 3)) / 2;
        return 0.22 * v + 0.003 * rnd();
      }
      case 'whistle': {
        phase += (2 * Math.PI * (1500 + 300 * Math.sin(2 * Math.PI * 0.4 * t))) / fs;
        return 0.3 * Math.sin(phase) + 0.04 * rnd();
      }
      default: {
        const T = 4, k = Math.log(8000 / 200) / T;
        phase += (2 * Math.PI * 200 * Math.exp(k * (t % T))) / fs;
        return 0.3 * Math.sin(phase);
      }
    }
  };
  const block = new Float32Array(1024);
  const timer = setInterval(() => {
    const target = Math.floor(((performance.now() - t0) / 1000) * fs);
    while (n + block.length <= target) {
      for (let i = 0; i < block.length; i++) block[i] = sample((n + i) / fs);
      ring.push(block);
      n += block.length;
    }
  }, 15);
  return { ring, label: DEMOS.find((d) => d.value === kind)!.label + ' (simulated)', stop: () => clearInterval(timer) };
}

const NOTES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export function noteName(f: number): string {
  if (!(f > 20)) return '–';
  const m = 69 + 12 * Math.log2(f / 440);
  const r = Math.round(m);
  const cents = Math.round((m - r) * 100);
  return `${NOTES[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1} ${cents >= 0 ? '+' : ''}${cents}¢`;
}

/** Fundamental frequency: find the strongest peak, then the lowest sub-multiple of it that also carries energy
 *  (so a note whose 3rd harmonic is loudest still reports its fundamental). */
export function estimateF0(mag: ArrayLike<number>, df: number, fmin = 70, fmax = 4000): number {
  const lo = Math.max(2, Math.floor(fmin / df)), hi = Math.min(mag.length - 2, Math.ceil(fmax / df));
  let pk = lo;
  for (let k = lo; k <= hi; k++) if (mag[k] > mag[pk]) pk = k;
  const near = (k: number) => {
    let b = Math.round(k);
    for (let j = Math.round(k) - 2; j <= Math.round(k) + 2; j++) if (j > 0 && j < mag.length && mag[j] > mag[b]) b = j;
    return b;
  };
  let bk = pk;
  for (let d = 2; d <= 6; d++) {
    const k = pk / d;
    if (k * df < fmin) break;
    const b = near(k);
    if (mag[b] > mag[pk] * 0.06) bk = b; // within ~25 dB of the peak
  }
  const a = Math.log(mag[bk - 1] + 1e-12), b = Math.log(mag[bk] + 1e-12), c = Math.log(mag[bk + 1] + 1e-12);
  const den = a - 2 * b + c;
  return (bk + (den < 0 ? (0.5 * (a - c)) / den : 0)) * df;
}
