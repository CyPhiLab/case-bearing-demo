// Live phone sensors for the fusion page. One stream is shared by every live figure: each motion event updates all
// the filters, and a 20 Hz tick tells the figures to redraw. The recent history is kept in plain arrays (not
// reactive) so that 100–200 events per second stay cheap.

import { motionHelp, motionSupported, requestMotionPermission } from '../../signals/lib/motion';
import {
  DEG,
  TiltKalman,
  complementaryStep,
  madgwickStep,
  qFromEuler,
  qFromGravity,
  qIntegrate,
  tiltFromAccel,
  yawCorrect,
  type Quat,
  type Vec3,
} from './fusion';

export const live = $state({
  running: false,
  status: '',
  note: '',
  count: 0,
  fs: 0,
  tick: 0,
  hasGyro: false,
  hasHeading: false,
  hasLinear: false,
  flipped: false,
});

/** filter settings, changed by the sliders on the page */
export const params = $state({
  alpha: 0.98,
  qAngle: 0.001,
  qBias: 0.003,
  r: 0.5,
  beta: 0.05,
  useCompass: true,
  compassGain: 0.5,
});

const KEEP = 30; // seconds of history
export const buf = {
  t: [] as number[],
  ax: [] as number[], ay: [] as number[], az: [] as number[],
  gx: [] as number[], gy: [] as number[], gz: [] as number[],
  heading: [] as number[],
  accTilt: [] as number[],
  gyroTilt: [] as number[],
  comp: [] as number[],
  kal: [] as number[],
  kalBias: [] as number[],
  vel: [] as number[],
  pos: [] as number[],
};

/** latest estimates, for the 3D view and readouts */
export const cur = {
  qGyro: [1, 0, 0, 0] as Quat,
  qMad: [1, 0, 0, 0] as Quat,
  qMadC: [1, 0, 0, 0] as Quat,
  qBrowser: null as Quat | null,
  browser: null as { alpha: number; beta: number; gamma: number } | null,
  heading: NaN, // compass heading as W3C alpha: degrees counterclockwise from north
  a: [0, 0, 9.81] as Vec3,
  w: [0, 0, 0] as Vec3,
  kalGain: 0,
};

const kalman = new TiltKalman();
let tPrev = NaN;
let t0 = NaN;
let accelSign = 1;
let thGyro = 0, thComp = 0, vel = 0, pos = 0;
let initialized = false;
let headingAligned = false;
let timer: ReturnType<typeof setInterval> | null = null;
let started = 0;

function clearBuffers() {
  for (const k of Object.keys(buf) as (keyof typeof buf)[]) buf[k].length = 0;
}

function initFrom(a: Vec3) {
  const tilt = tiltFromAccel(a[1], a[2]);
  thGyro = thComp = tilt;
  kalman.reset(tilt, 0);
  const q0 = qFromGravity(a);
  const q = Number.isNaN(cur.heading) ? q0 : yawToward(q0, cur.heading);
  cur.qGyro = cur.qMad = cur.qMadC = q;
  initialized = true;
  headingAligned = !Number.isNaN(cur.heading);
}

function yawToward(q: Quat, heading: number): Quat {
  let out = q;
  for (let i = 0; i < 20; i++) out = yawCorrect(out, heading, 1e3, 1e-3);
  return out;
}

export function resetTilt() {
  const a = cur.a;
  const tilt = tiltFromAccel(a[1], a[2]);
  thGyro = thComp = tilt;
  kalman.reset(tilt, 0);
}
export function resetOrientation() {
  initFrom(cur.a);
}
export function resetDeadReckoning() {
  vel = pos = 0;
}

function onMotion(e: DeviceMotionEvent) {
  const g = e.accelerationIncludingGravity;
  if (!g || g.x === null) return;
  const t = e.timeStamp / 1000;
  if (Number.isNaN(t0)) t0 = t;
  const dt = Number.isNaN(tPrev) ? 0.01 : Math.min(0.1, Math.max(1e-4, t - tPrev));
  tPrev = t;
  // the spec says a phone lying screen up reads +g on z; some browsers report the opposite sign
  if (!initialized && (g.z ?? 0) < -3) {
    accelSign = -1;
    live.flipped = true;
  }
  const a: Vec3 = [accelSign * (g.x ?? 0), accelSign * (g.y ?? 0), accelSign * (g.z ?? 0)];
  const r = e.rotationRate;
  const hasGyro = !!r && r.beta !== null;
  if (hasGyro) live.hasGyro = true;
  // rotationRate: beta about x, gamma about y, alpha about z (°/s)
  const wDeg: Vec3 = hasGyro ? [r!.beta ?? 0, r!.gamma ?? 0, r!.alpha ?? 0] : [0, 0, 0];
  const w: Vec3 = [wDeg[0] * DEG, wDeg[1] * DEG, wDeg[2] * DEG];
  cur.a = a;
  cur.w = wDeg;
  if (!initialized) initFrom(a);

  // one tilt angle (about the device x axis)
  const acc = tiltFromAccel(a[1], a[2]);
  thGyro += wDeg[0] * dt;
  thComp = complementaryStep(thComp, wDeg[0], acc, dt, params.alpha);
  // keep the comparison fair across the ±180° wrap of the accelerometer angle
  if (Math.abs(acc - thComp) > 180) thComp = acc;
  kalman.qAngle = params.qAngle;
  kalman.qBias = params.qBias;
  kalman.r = params.r;
  kalman.step(wDeg[0], acc, dt);
  cur.kalGain = kalman.gain;

  // full orientation
  cur.qGyro = qIntegrate(cur.qGyro, w, dt);
  cur.qMad = madgwickStep(cur.qMad, w, a, dt, params.beta);
  let qc = madgwickStep(cur.qMadC, w, a, dt, params.beta);
  if (params.useCompass) qc = yawCorrect(qc, cur.heading, params.compassGain, dt);
  cur.qMadC = qc;

  // dead reckoning along the device x axis, from acceleration without gravity
  const lin = e.acceleration;
  if (lin && lin.x !== null) {
    live.hasLinear = true;
    vel += (lin.x ?? 0) * dt;
    pos += vel * dt;
  }

  const B = buf;
  B.t.push(t - t0);
  B.ax.push(a[0]); B.ay.push(a[1]); B.az.push(a[2]);
  B.gx.push(wDeg[0]); B.gy.push(wDeg[1]); B.gz.push(wDeg[2]);
  B.heading.push(Number.isNaN(cur.heading) ? NaN : (360 - cur.heading) % 360);
  B.accTilt.push(acc);
  B.gyroTilt.push(thGyro);
  B.comp.push(thComp);
  B.kal.push(kalman.theta);
  B.kalBias.push(kalman.bias);
  B.vel.push(vel);
  B.pos.push(pos);
  // trim old samples in batches rather than one shift per event
  const now = B.t[B.t.length - 1];
  if (now - B.t[0] > KEEP + 5) {
    let i = 0;
    while (now - B.t[i] > KEEP) i++;
    for (const k of Object.keys(B) as (keyof typeof B)[]) B[k].splice(0, i);
  }
}

type OrientationLike = DeviceOrientationEvent & { webkitCompassHeading?: number };
function onOrient(ev: Event) {
  const e = ev as OrientationLike;
  if (e.alpha === null && e.beta === null) return;
  let alpha = NaN;
  if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) alpha = (360 - e.webkitCompassHeading) % 360;
  else if ((e.absolute || e.type === 'deviceorientationabsolute') && e.alpha !== null) alpha = e.alpha;
  if (!Number.isNaN(alpha)) {
    cur.heading = alpha;
    live.hasHeading = true;
    // the first compass reading often arrives after the first motion sample: start every estimate at that heading
    if (initialized && !headingAligned) {
      cur.qGyro = yawToward(cur.qGyro, alpha);
      cur.qMad = yawToward(cur.qMad, alpha);
      cur.qMadC = yawToward(cur.qMadC, alpha);
      headingAligned = true;
    }
  }
  if (e.beta !== null && e.gamma !== null) {
    const a = Number.isNaN(alpha) ? (e.alpha ?? 0) : alpha;
    cur.browser = { alpha: a, beta: e.beta, gamma: e.gamma };
    cur.qBrowser = qFromEuler(a, e.beta, e.gamma);
  }
}

async function requestOrientationPermission(): Promise<void> {
  const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
  if (D && typeof D.requestPermission === 'function') {
    try {
      await D.requestPermission();
    } catch {
      /* the compass is optional */
    }
  }
}

/** start the sensors; must be called from a tap */
export async function startSensors() {
  live.status = '';
  live.note = '';
  if (!motionSupported()) {
    live.status = 'This browser has no motion sensor API. Open the page on a phone.';
    return;
  }
  // ask for both permissions within the same tap
  const [perm] = await Promise.all([requestMotionPermission(), requestOrientationPermission()]);
  if (perm.state === 'denied') {
    live.status = `Motion sensor access is blocked for this site. ${motionHelp()}`;
    return;
  }
  if (perm.state === 'error') live.note = ` (The permission request failed: ${perm.message}.)`;
  clearBuffers();
  initialized = false;
  headingAligned = false;
  cur.heading = NaN;
  accelSign = 1;
  live.flipped = false;
  tPrev = t0 = NaN;
  live.count = 0;
  window.addEventListener('devicemotion', onMotion);
  window.addEventListener('deviceorientationabsolute', onOrient);
  window.addEventListener('deviceorientation', onOrient);
  live.running = true;
  started = performance.now();
  timer = setInterval(() => {
    live.count = buf.t.length;
    const n = buf.t.length;
    live.fs = n > 10 ? (n - 1) / (buf.t[n - 1] - buf.t[0] || 1) : 0;
    live.tick++;
    if (performance.now() - started > 2000 && n === 0) {
      stopSensors();
      live.status = `No motion events were received.${live.note} The device may have no motion sensors, the page must be opened over https, or motion access is blocked. ${motionHelp()}`;
    }
  }, 50);
}

export function stopSensors() {
  window.removeEventListener('devicemotion', onMotion);
  window.removeEventListener('deviceorientationabsolute', onOrient);
  window.removeEventListener('deviceorientation', onOrient);
  if (timer) clearInterval(timer);
  timer = null;
  live.running = false;
}

/** the last `seconds` of a buffer, with time relative to now (≤ 0) */
export function recent(key: keyof typeof buf, seconds = 20): { x: number[]; y: number[] } {
  const t = buf.t;
  const n = t.length;
  if (!n) return { x: [], y: [] };
  const now = t[n - 1];
  let i = n - 1;
  while (i > 0 && now - t[i - 1] <= seconds) i--;
  return { x: t.slice(i).map((v) => v - now), y: buf[key].slice(i) };
}
