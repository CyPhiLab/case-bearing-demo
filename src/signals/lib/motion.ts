// Phone accelerometer capture via DeviceMotionEvent. Browsers deliver events at an uneven rate
// (typically 60–200 Hz), so we keep the raw timestamps and resample to a uniform δt afterwards.

export interface MotionRecord {
  t: Float64Array; // s, from the first event
  ax: Float64Array;
  ay: Float64Array;
  az: Float64Array; // m/s², including gravity
  reportedInterval: number; // ms, what the browser claims (e.interval)
  simulated?: boolean;
}

export const motionSupported = () => typeof window !== 'undefined' && 'DeviceMotionEvent' in window;

/** iOS 13+ needs an explicit permission request from a user gesture. */
export async function requestMotionPermission(): Promise<boolean> {
  const D = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
  if (D && typeof D.requestPermission === 'function') {
    try {
      return (await D.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }
  return motionSupported();
}

export class MotionRecorder {
  private t: number[] = [];
  private x: number[] = [];
  private y: number[] = [];
  private z: number[] = [];
  private interval = NaN;
  private handler = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null) return;
    this.t.push(e.timeStamp);
    this.x.push(a.x ?? 0);
    this.y.push(a.y ?? 0);
    this.z.push(a.z ?? 0);
    if (e.interval) this.interval = e.interval;
  };
  start() {
    window.addEventListener('devicemotion', this.handler);
  }
  stop(): MotionRecord {
    window.removeEventListener('devicemotion', this.handler);
    const t0 = this.t[0] ?? 0;
    return {
      t: Float64Array.from(this.t, (v) => (v - t0) / 1000),
      ax: Float64Array.from(this.x),
      ay: Float64Array.from(this.y),
      az: Float64Array.from(this.z),
      reportedInterval: this.interval,
    };
  }
  get count() {
    return this.t.length;
  }
  /** last few samples for a live readout */
  tail(n: number) {
    const k = Math.max(0, this.t.length - n);
    return { x: this.x.slice(k), y: this.y.slice(k), z: this.z.slice(k) };
  }
}

/** Linear interpolation of (t, v) onto a uniform grid at fs. */
export function resample(t: ArrayLike<number>, v: ArrayLike<number>, fs: number): Float64Array {
  const n = Math.max(0, Math.floor((t[t.length - 1] - t[0]) * fs) + 1);
  const out = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const ti = t[0] + i / fs;
    while (j < t.length - 2 && t[j + 1] < ti) j++;
    const span = t[j + 1] - t[j] || 1;
    const a = Math.min(1, Math.max(0, (ti - t[j]) / span));
    out[i] = v[j] + a * (v[j + 1] - v[j]);
  }
  return out;
}

/** A fake recording built from a uniformly sampled clip, with the timing jitter of a real phone. */
export function simulateRecord(x: ArrayLike<number>, fs: number, seed = 3): MotionRecord {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const n = x.length;
  const t = new Float64Array(n);
  for (let i = 0; i < n; i++) t[i] = i / fs + (rnd() - 0.5) * 0.3 / fs;
  t.sort();
  for (let i = n - 1; i >= 0; i--) t[i] -= t[0];
  return {
    t,
    ax: Float64Array.from(x, (v, i) => 0.05 * Math.sin(i / 50) + v * 0.6),
    ay: Float64Array.from(x, (v) => 0.12 + v * 0.3),
    az: Float64Array.from(x, (v) => 9.81 + v),
    reportedInterval: 1000 / fs,
    simulated: true,
  };
}

export function toCSV(r: MotionRecord): string {
  const rows = ['t_s,ax_m_s2,ay_m_s2,az_m_s2'];
  for (let i = 0; i < r.t.length; i++) rows.push(`${r.t[i].toFixed(5)},${r.ax[i].toFixed(5)},${r.ay[i].toFixed(5)},${r.az[i].toFixed(5)}`);
  return rows.join('\n');
}
