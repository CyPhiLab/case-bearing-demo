// Phone accelerometer + gyroscope + compass capture for the sensors page. Motion events carry acceleration
// (including gravity) and rotation rate; orientation events carry the compass heading where the browser offers it.

import { gaussian } from '../../lib/dsp/signals';

export interface ImuRecord {
  t: Float64Array; // s from the first event
  ax: Float64Array; // m/s², including gravity
  ay: Float64Array;
  az: Float64Array;
  gx: Float64Array; // °/s about the device x axis (rotationRate.beta)
  gy: Float64Array; // °/s about y (rotationRate.gamma)
  gz: Float64Array; // °/s about z (rotationRate.alpha)
  heading: Float64Array; // degrees clockwise from magnetic north, NaN when unavailable
  simulated?: boolean;
}

/** iOS 13+ needs a permission request (from a user gesture) for orientation events as well as motion events. */
export async function requestOrientationPermission(): Promise<boolean> {
  const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
  if (D && typeof D.requestPermission === 'function') {
    try {
      return (await D.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }
  return true;
}

type OrientationLike = DeviceOrientationEvent & { webkitCompassHeading?: number };

/** compass heading from an orientation event, or NaN */
export function headingFromEvent(e: OrientationLike): number {
  if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) return e.webkitCompassHeading;
  if ((e.absolute || e.type === 'deviceorientationabsolute') && e.alpha !== null) return (360 - e.alpha) % 360;
  return NaN;
}

export class ImuRecorder {
  private cols: Record<'t' | 'ax' | 'ay' | 'az' | 'gx' | 'gy' | 'gz' | 'heading', number[]> = { t: [], ax: [], ay: [], az: [], gx: [], gy: [], gz: [], heading: [] };
  heading = NaN;
  private onMotion = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null) return;
    const r = e.rotationRate;
    const c = this.cols;
    c.t.push(e.timeStamp);
    c.ax.push(a.x ?? 0);
    c.ay.push(a.y ?? 0);
    c.az.push(a.z ?? 0);
    c.gx.push(r?.beta ?? NaN);
    c.gy.push(r?.gamma ?? NaN);
    c.gz.push(r?.alpha ?? NaN);
    c.heading.push(this.heading);
  };
  private onOrient = (e: Event) => {
    const h = headingFromEvent(e as OrientationLike);
    if (!Number.isNaN(h)) this.heading = h;
  };
  start() {
    window.addEventListener('devicemotion', this.onMotion);
    window.addEventListener('deviceorientationabsolute', this.onOrient);
    window.addEventListener('deviceorientation', this.onOrient);
  }
  stop(): ImuRecord {
    window.removeEventListener('devicemotion', this.onMotion);
    window.removeEventListener('deviceorientationabsolute', this.onOrient);
    window.removeEventListener('deviceorientation', this.onOrient);
    const c = this.cols;
    const t0 = c.t[0] ?? 0;
    return {
      t: Float64Array.from(c.t, (v) => (v - t0) / 1000),
      ax: Float64Array.from(c.ax),
      ay: Float64Array.from(c.ay),
      az: Float64Array.from(c.az),
      gx: Float64Array.from(c.gx),
      gy: Float64Array.from(c.gy),
      gz: Float64Array.from(c.gz),
      heading: Float64Array.from(c.heading),
    };
  }
  get count() {
    return this.cols.t.length;
  }
  /** most recent sample, for live readouts */
  last() {
    const c = this.cols;
    const i = c.t.length - 1;
    if (i < 0) return null;
    return { ax: c.ax[i], ay: c.ay[i], az: c.az[i], gx: c.gx[i], gy: c.gy[i], gz: c.gz[i], heading: this.heading };
  }
}

/** tilt about the device x axis (top edge up/down), degrees, from the gravity direction */
export const tiltX = (ay: number, az: number) => (Math.atan2(ay, az) * 180) / Math.PI;
/** tilt about the device y axis (side to side), degrees */
export const tiltY = (ax: number, ay: number, az: number) => (Math.atan2(-ax, Math.hypot(ay, az)) * 180) / Math.PI;

/** unwrap an angle sequence in degrees so that it has no ±360° jumps */
export function unwrapDeg(x: ArrayLike<number>): Float64Array {
  const out = new Float64Array(x.length);
  let off = 0;
  for (let i = 0; i < x.length; i++) {
    if (i > 0 && !Number.isNaN(x[i]) && !Number.isNaN(x[i - 1])) {
      const d = x[i] - x[i - 1];
      if (d > 180) off -= 360;
      else if (d < -180) off += 360;
    }
    out[i] = x[i] + off;
  }
  return out;
}

/**
 * A simulated 20 s recording at about 60 Hz: the phone is tilted forward and back, shaken between 9 and 12 s, and a
 * magnet is brought close between 14 and 17 s. The gyro has a 0.8 °/s bias.
 */
export function simulateImu(seed = 5): ImuRecord {
  const fs = 60, n = 20 * fs, g = 9.81;
  const nA = gaussian(n, 0.08, seed), nG = gaussian(n, 0.4, seed + 1), nH = gaussian(n, 0.8, seed + 2), sh = gaussian(n, 1, seed + 3);
  const ease = (s: number, a: number, w: number) => {
    const u = Math.min(1, Math.max(0, (s - a) / w));
    return u * u * (3 - 2 * u);
  };
  const th = (s: number) => 35 * ease(s, 2, 1.2) - 50 * ease(s, 5, 1.5) + 15 * ease(s, 13, 1);
  const r: ImuRecord = {
    t: new Float64Array(n), ax: new Float64Array(n), ay: new Float64Array(n), az: new Float64Array(n),
    gx: new Float64Array(n), gy: new Float64Array(n), gz: new Float64Array(n), heading: new Float64Array(n), simulated: true,
  };
  for (let i = 0; i < n; i++) {
    const s = i / fs;
    const a = (th(s) * Math.PI) / 180;
    const shake = s > 9 && s < 12 ? 4 * Math.sin(2 * Math.PI * 4 * s) + 1.5 * sh[i] : 0;
    r.t[i] = s;
    r.ax[i] = nA[i] + (s > 9 && s < 12 ? 0.8 * sh[(i + 7) % n] : 0);
    r.ay[i] = g * Math.sin(a) + nA[(i + 3) % n] + shake;
    r.az[i] = g * Math.cos(a) + nA[(i + 5) % n];
    r.gx[i] = (th(s + 0.5 / fs) - th(s - 0.5 / fs)) * fs + 0.8 + nG[i];
    r.gy[i] = nG[(i + 11) % n] + 0.3;
    r.gz[i] = nG[(i + 13) % n] - 0.2;
    const magnet = 70 * Math.exp(-(((s - 15.5) / 0.9) ** 2));
    r.heading[i] = (40 + magnet + nH[i] + 360) % 360;
  }
  return r;
}

export function imuCSV(r: ImuRecord): string {
  const rows = ['t_s,ax_m_s2,ay_m_s2,az_m_s2,gx_deg_s,gy_deg_s,gz_deg_s,heading_deg'];
  const f = (v: number, d: number) => (Number.isNaN(v) ? '' : v.toFixed(d));
  for (let i = 0; i < r.t.length; i++)
    rows.push([f(r.t[i], 5), f(r.ax[i], 4), f(r.ay[i], 4), f(r.az[i], 4), f(r.gx[i], 3), f(r.gy[i], 3), f(r.gz[i], 3), f(r.heading[i], 1)].join(','));
  return rows.join('\n');
}
