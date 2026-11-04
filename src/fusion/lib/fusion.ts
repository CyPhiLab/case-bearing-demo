// Sensor-fusion building blocks for the phone fusion page: tilt from gravity, gyro integration, complementary and
// Kalman filters for one tilt angle, and quaternion orientation filters (gyro only, Madgwick, and Madgwick with a
// compass heading correction). Pure functions and small classes so they can be unit-tested.
//
// Frames follow the W3C Device Orientation spec: device x to the right, y toward the top of the screen, z out of the
// screen. World frame: x east, y north, z up. A quaternion q = [w, x, y, z] rotates device vectors into the world.

export const DEG = Math.PI / 180;
export const G = 9.80665;

// ───────────────────────── one tilt angle ─────────────────────────

/** front–back tilt about the device x axis (°), from accelerometer readings that include gravity */
export const tiltFromAccel = (ay: number, az: number) => Math.atan2(ay, az) / DEG;

/** apparent tilt error (°) when the device also accelerates horizontally by a (m/s²) */
export const tiltErrorFromAccel = (a: number) => Math.atan2(a, G) / DEG;

/** cumulative trapezoidal integral */
export function integrate(x: ArrayLike<number>, dt: number, y0 = 0): Float64Array {
  const out = new Float64Array(x.length);
  let s = y0;
  out[0] = s;
  for (let i = 1; i < x.length; i++) {
    s += 0.5 * (x[i] + x[i - 1]) * dt;
    out[i] = s;
  }
  return out;
}

/** one step of the complementary filter θ = α(θ + ω δt) + (1 − α) θ_acc */
export const complementaryStep = (theta: number, rate: number, acc: number, dt: number, alpha: number) => alpha * (theta + rate * dt) + (1 - alpha) * acc;

export function complementaryFilter(gyro: ArrayLike<number>, accAngle: ArrayLike<number>, dt: number, alpha: number, theta0 = accAngle[0] ?? 0): Float64Array {
  const out = new Float64Array(gyro.length);
  let th = theta0;
  for (let i = 0; i < gyro.length; i++) {
    th = complementaryStep(th, gyro[i], accAngle[i], dt, alpha);
    out[i] = th;
  }
  return out;
}

/** crossover frequency (Hz) of the complementary filter: τ = α δt / (1 − α), f_c = 1/(2πτ) */
export const complementaryCrossover = (alpha: number, dt: number) => (1 - alpha) / (2 * Math.PI * alpha * dt);

/** magnitudes of the complementary filter's low-pass (accelerometer) and high-pass (gyro) parts at f (Hz) */
export function complementaryResponse(f: number, alpha: number, dt: number) {
  // discrete first-order low-pass y_k = α y_{k−1} + (1 − α) x_k evaluated on the unit circle
  const w = 2 * Math.PI * f * dt;
  const re = 1 - alpha * Math.cos(w);
  const im = alpha * Math.sin(w);
  const lp = (1 - alpha) / Math.hypot(re, im);
  // high-pass part: α(1 − z⁻¹)/(1 − α z⁻¹)
  const hp = (alpha * Math.hypot(1 - Math.cos(w), Math.sin(w))) / Math.hypot(re, im);
  return { lp, hp };
}

/**
 * Two-state Kalman filter for one tilt angle: state [θ, b] with gyro bias b. The gyro drives the prediction,
 * the accelerometer angle is the measurement.
 *  qAngle: process noise of the angle (deg² per s), qBias: of the bias ((deg/s)² per s), r: measurement noise (deg²)
 */
export class TiltKalman {
  theta = 0;
  bias = 0;
  P = [
    [10, 0],
    [0, 10],
  ];
  gain = 0; // last Kalman gain for the angle
  constructor(
    public qAngle = 0.001,
    public qBias = 0.003,
    public r = 0.5,
  ) {}
  reset(theta = 0, bias = 0) {
    this.theta = theta;
    this.bias = bias;
    this.P = [
      [10, 0],
      [0, 10],
    ];
  }
  step(rate: number, meas: number, dt: number) {
    // predict
    this.theta += dt * (rate - this.bias);
    const P = this.P;
    P[0][0] += dt * (dt * P[1][1] - P[0][1] - P[1][0] + this.qAngle);
    P[0][1] -= dt * P[1][1];
    P[1][0] -= dt * P[1][1];
    P[1][1] += this.qBias * dt;
    // update
    const S = P[0][0] + this.r;
    const K0 = P[0][0] / S;
    const K1 = P[1][0] / S;
    const y = meas - this.theta;
    this.theta += K0 * y;
    this.bias += K1 * y;
    const p00 = P[0][0], p01 = P[0][1];
    P[0][0] -= K0 * p00;
    P[0][1] -= K0 * p01;
    P[1][0] -= K1 * p00;
    P[1][1] -= K1 * p01;
    this.gain = K0;
    return this.theta;
  }
}

// ───────────────────────── quaternions ─────────────────────────

export type Quat = [number, number, number, number];
export type Vec3 = [number, number, number];

export const qIdentity = (): Quat => [1, 0, 0, 0];
export function qMul(a: Quat, b: Quat): Quat {
  return [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
}
export function qNorm(q: Quat): Quat {
  const n = Math.hypot(...q) || 1;
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}
export const qFromAxisAngle = (axis: Vec3, angle: number): Quat => {
  const n = Math.hypot(...axis) || 1;
  const s = Math.sin(angle / 2) / n;
  return [Math.cos(angle / 2), axis[0] * s, axis[1] * s, axis[2] * s];
};
/** rotation matrix (rows) of q: maps device vectors to world vectors */
export function qToMatrix(q: Quat): number[][] {
  const [w, x, y, z] = q;
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
  ];
}
export const qRotate = (q: Quat, v: Vec3): Vec3 => {
  const R = qToMatrix(q);
  return [0, 1, 2].map((i) => R[i][0] * v[0] + R[i][1] * v[1] + R[i][2] * v[2]) as Vec3;
};

/** W3C Euler angles (°) of q: R = Rz(α) Rx(β) Ry(γ) */
export function qToEuler(q: Quat): { alpha: number; beta: number; gamma: number } {
  const R = qToMatrix(q);
  const beta = Math.asin(Math.max(-1, Math.min(1, R[2][1])));
  const alpha = Math.atan2(-R[0][1], R[1][1]);
  const gamma = Math.atan2(-R[2][0], R[2][2]);
  return { alpha: ((alpha / DEG) + 360) % 360, beta: beta / DEG, gamma: gamma / DEG };
}

/** quaternion from W3C Euler angles (°), R = Rz(α) Rx(β) Ry(γ) */
export function qFromEuler(alpha: number, beta: number, gamma: number): Quat {
  return qNorm(qMul(qMul(qFromAxisAngle([0, 0, 1], alpha * DEG), qFromAxisAngle([1, 0, 0], beta * DEG)), qFromAxisAngle([0, 1, 0], gamma * DEG)));
}

/** quaternion whose tilt matches a gravity reading (yaw set to zero) */
export function qFromGravity(a: Vec3): Quat {
  const n = Math.hypot(...a) || 1;
  const ax = a[0] / n, ay = a[1] / n, az = a[2] / n;
  const beta = Math.asin(Math.max(-1, Math.min(1, ay)));
  const gamma = Math.atan2(-ax, az);
  return qFromEuler(0, beta / DEG, gamma / DEG);
}

/** integrate a body rotation rate ω (rad/s, device axes) over dt: q ← q ⊗ exp(ω dt / 2) */
export function qIntegrate(q: Quat, w: Vec3, dt: number): Quat {
  const ang = Math.hypot(...w) * dt;
  if (ang < 1e-12) return q;
  return qNorm(qMul(q, qFromAxisAngle(w, ang)));
}

/**
 * Madgwick filter, IMU version (gyro + accelerometer). β sets how strongly the accelerometer pulls the estimate
 * toward the measured gravity direction (rad/s).
 */
export function madgwickStep(q: Quat, w: Vec3, a: Vec3, dt: number, beta: number): Quat {
  let [q0, q1, q2, q3] = q;
  const [gx, gy, gz] = w;
  let qd0 = 0.5 * (-q1 * gx - q2 * gy - q3 * gz);
  let qd1 = 0.5 * (q0 * gx + q2 * gz - q3 * gy);
  let qd2 = 0.5 * (q0 * gy - q1 * gz + q3 * gx);
  let qd3 = 0.5 * (q0 * gz + q1 * gy - q2 * gx);
  const an = Math.hypot(...a);
  if (an > 0) {
    const ax = a[0] / an, ay = a[1] / an, az = a[2] / an;
    // gradient of f = (gravity predicted from q) − (measured gravity direction)
    const f1 = 2 * (q1 * q3 - q0 * q2) - ax;
    const f2 = 2 * (q0 * q1 + q2 * q3) - ay;
    const f3 = 2 * (0.5 - q1 * q1 - q2 * q2) - az;
    let s0 = -2 * q2 * f1 + 2 * q1 * f2;
    let s1 = 2 * q3 * f1 + 2 * q0 * f2 - 4 * q1 * f3;
    let s2 = -2 * q0 * f1 + 2 * q3 * f2 - 4 * q2 * f3;
    let s3 = 2 * q1 * f1 + 2 * q2 * f2;
    const sn = Math.hypot(s0, s1, s2, s3);
    if (sn > 0) {
      s0 /= sn; s1 /= sn; s2 /= sn; s3 /= sn;
      qd0 -= beta * s0; qd1 -= beta * s1; qd2 -= beta * s2; qd3 -= beta * s3;
    }
  }
  q0 += qd0 * dt; q1 += qd1 * dt; q2 += qd2 * dt; q3 += qd3 * dt;
  return qNorm([q0, q1, q2, q3]);
}

/** heading α (°, counterclockwise from north, as in W3C alpha) of the device's top edge; NaN when it points up or down */
export function qHeading(q: Quat): number {
  const R = qToMatrix(q);
  const c = Math.hypot(R[0][1], R[1][1]);
  if (c < 0.3) return NaN;
  return ((Math.atan2(-R[0][1], R[1][1]) / DEG) + 360) % 360;
}

export const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

/**
 * Pull the heading of q toward a compass heading α_meas (°) by rotating about the world vertical: a complementary
 * filter on yaw, with gain k (1/s).
 */
export function yawCorrect(q: Quat, alphaMeas: number, k: number, dt: number): Quat {
  const h = qHeading(q);
  if (Number.isNaN(h) || Number.isNaN(alphaMeas)) return q;
  const e = wrap180(alphaMeas - h) * DEG;
  return qNorm(qMul(qFromAxisAngle([0, 0, 1], Math.max(-1, Math.min(1, k * dt)) * e), q));
}

/** angle (°) between two orientations */
export function qAngleBetween(a: Quat, b: Quat): number {
  const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return (2 * Math.acos(Math.min(1, d))) / DEG;
}

// ───────────────────────── dead reckoning ─────────────────────────

/** position error from a constant accelerometer bias b after t seconds, ½ b t² */
export const deadReckonError = (b: number, t: number) => 0.5 * b * t * t;

// ───────────────────────── gyro axis convention ─────────────────────────

/**
 * Browsers disagree on how DeviceMotionEvent.rotationRate maps to the device axes. The current spec uses
 * alpha → x, beta → y, gamma → z; older documents used beta → x, gamma → y, alpha → z. This check compares the tilt
 * rate seen by the accelerometer with each candidate x-axis rate and picks the one that agrees.
 */
export type AxisConvention = 'spec' | 'legacy';
export const gyroAxes = (r: { alpha: number; beta: number; gamma: number }, c: AxisConvention): Vec3 =>
  c === 'spec' ? [r.alpha, r.beta, r.gamma] : [r.beta, r.gamma, r.alpha];

export class AxisCheck {
  convention: AxisConvention = 'spec';
  decided = false;
  private sxy = { spec: 0, legacy: 0 };
  private sxx = { spec: 0, legacy: 0 };
  private syy = 0;
  private prev = NaN;
  /** a: accelerometer including gravity, r: raw rotationRate (°/s), dt: s */
  add(a: Vec3, r: { alpha: number; beta: number; gamma: number }, dt: number) {
    if (this.decided) return;
    const g = Math.hypot(...a);
    // tilt about x from gravity, only while the phone is not accelerating much and is not lying on its side
    const th = Math.atan2(a[1], a[2]) / DEG;
    const ok = Math.abs(g - G) < 1.5 && Math.abs(a[0]) < 0.5 * g;
    if (ok && !Number.isNaN(this.prev) && dt > 0) {
      const d = wrap180(th - this.prev) / dt;
      if (Math.abs(d) < 400) {
        this.syy += d * d;
        for (const c of ['spec', 'legacy'] as const) {
          const x = gyroAxes(r, c)[0];
          this.sxy[c] += x * d;
          this.sxx[c] += x * x;
        }
      }
    }
    this.prev = ok ? th : NaN;
    // decide once there has been a clear tilt motion (≈ a few seconds of tilting back and forth)
    if (this.syy > 2e6) {
      const corr = (c: AxisConvention) => this.sxy[c] / Math.sqrt(this.sxx[c] * this.syy || 1);
      const s = corr('spec'), l = corr('legacy');
      this.convention = l > s + 0.3 && l > 0.5 ? 'legacy' : 'spec';
      this.decided = true;
    }
  }
}
