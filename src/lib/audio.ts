// Play a vibration recording through the speakers. At 12 kHz most of the bearing's
// vibration is in the audible range; slowing it down makes individual impacts audible.

let ctx: AudioContext | null = null;
let current: { src: AudioBufferSourceNode; startedAt: number; offset: number; rate: number } | null = null;

export interface PlayOptions {
  fs: number;
  /** playback slow-down factor (1 = real time) */
  slow: number;
  /** multiply samples by this before clipping to [-1, 1] */
  gain: number;
  /** start position in seconds of the recording */
  from: number;
  onended?: () => void;
}

export function play(signal: Float64Array, o: PlayOptions) {
  stop();
  ctx ??= new AudioContext();
  const rate = o.fs / o.slow;
  const start = Math.floor(o.from * o.fs);
  const data = signal.subarray(start);
  const buf = ctx.createBuffer(1, data.length, Math.max(3000, rate));
  const ch = buf.getChannelData(0);
  const fade = Math.min(200, data.length / 4);
  for (let i = 0; i < data.length; i++) {
    let v = data[i] * o.gain;
    if (i < fade) v *= i / fade; // avoid a click at the start
    ch[i] = Math.max(-1, Math.min(1, v));
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.onended = () => {
    if (current?.src === src) current = null;
    o.onended?.();
  };
  src.start();
  current = { src, startedAt: ctx.currentTime, offset: o.from, rate: 1 / o.slow };
}

export function stop() {
  if (current) {
    const s = current.src;
    current = null;
    s.onended = null;
    try {
      s.stop();
    } catch {
      /* already stopped */
    }
  }
}

/** Current playback position in recording seconds, or null when idle. */
export function position(): number | null {
  if (!current || !ctx) return null;
  return current.offset + (ctx.currentTime - current.startedAt) * current.rate;
}
