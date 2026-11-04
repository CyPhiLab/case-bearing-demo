import { describe, expect, it } from 'vitest';
import {
  AxisCheck,
  DEG,
  G,
  gyroAxes,
  TiltKalman,
  complementaryFilter,
  complementaryResponse,
  madgwickStep,
  qAngleBetween,
  qFromEuler,
  qFromGravity,
  qHeading,
  qIdentity,
  qIntegrate,
  qRotate,
  qToEuler,
  tiltFromAccel,
  yawCorrect,
  type Quat,
  type Vec3,
} from '../src/fusion/lib/fusion';

// gravity reading (what accelerationIncludingGravity reports at rest) for W3C Euler angles
const gravityReading = (beta: number, gamma: number): Vec3 => {
  const b = beta * DEG, g = gamma * DEG;
  return [-G * Math.cos(b) * Math.sin(g), G * Math.sin(b), G * Math.cos(b) * Math.cos(g)];
};

describe('tilt and complementary filter', () => {
  it('tilt from the accelerometer', () => {
    const a = gravityReading(30, 0);
    expect(tiltFromAccel(a[1], a[2])).toBeCloseTo(30, 9);
  });
  it('complementary filter settles on the accelerometer angle, bias leaves α·b·δt/(1−α)', () => {
    const n = 5000;
    expect(complementaryFilter(new Float64Array(n), new Float64Array(n).fill(20), 0.01, 0.98, 0)[n - 1]).toBeCloseTo(20, 6);
    expect(complementaryFilter(new Float64Array(n).fill(1), new Float64Array(n), 0.01, 0.98, 0)[n - 1]).toBeCloseTo((0.98 * 0.01) / 0.02, 6);
  });
  it('the low-pass and high-pass parts are complementary: they sum to 1 at DC and the gyro dominates at high frequency', () => {
    const lo = complementaryResponse(0.001, 0.98, 0.01);
    expect(lo.lp).toBeCloseTo(1, 3);
    expect(lo.hp).toBeLessThan(0.01);
    const hi = complementaryResponse(20, 0.98, 0.01);
    expect(hi.hp).toBeGreaterThan(0.95);
    expect(hi.lp).toBeLessThan(0.05);
  });
});

describe('Kalman tilt filter', () => {
  it('tracks the angle and learns a constant gyro bias', () => {
    const k = new TiltKalman(0.001, 0.003, 0.5);
    const dt = 0.01;
    let s = 1;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5) * 2;
    for (let i = 0; i < 6000; i++) k.step(0.7 /* true rate 0, bias 0.7 °/s */, 15 + 2 * rnd(), dt);
    expect(k.theta).toBeCloseTo(15, 0);
    expect(Math.abs(k.bias - 0.7)).toBeLessThan(0.15); // the bias estimate wanders with the measurement noise
  });
});

describe('quaternions', () => {
  it('Euler round trip', () => {
    const e = qToEuler(qFromEuler(120, 25, -40));
    expect(e.alpha).toBeCloseTo(120, 6);
    expect(e.beta).toBeCloseTo(25, 6);
    expect(e.gamma).toBeCloseTo(-40, 6);
  });
  it('gravity in device coordinates matches the reading model', () => {
    const q = qFromEuler(70, 25, -40);
    const R = qRotate([q[0], -q[1], -q[2], -q[3]], [0, 0, G]); // world up → device
    const a = gravityReading(25, -40);
    R.forEach((v, i) => expect(v).toBeCloseTo(a[i], 6));
  });
  it('tilt from a gravity reading', () => {
    const e = qToEuler(qFromGravity(gravityReading(-35, 20)));
    expect(e.beta).toBeCloseTo(-35, 6);
    expect(e.gamma).toBeCloseTo(20, 6);
  });
  it('integrating 90 °/s about z for 1 s turns the heading by 90°', () => {
    let q: Quat = qIdentity();
    for (let i = 0; i < 100; i++) q = qIntegrate(q, [0, 0, 90 * DEG], 0.01);
    expect(qHeading(q)).toBeCloseTo(90, 6);
  });
});

describe('Madgwick filter and compass correction', () => {
  it('converges from a wrong tilt to the measured gravity direction', () => {
    let q: Quat = qIdentity();
    const a = gravityReading(30, -20);
    for (let i = 0; i < 3000; i++) q = madgwickStep(q, [0, 0, 0], a, 0.01, 0.5);
    const e = qToEuler(q);
    expect(e.beta).toBeCloseTo(30, 0);
    expect(e.gamma).toBeCloseTo(-20, 0);
  });
  it('follows a rotation measured by the gyro', () => {
    let q = qFromGravity(gravityReading(0, 0));
    let truth: Quat = q;
    for (let i = 0; i < 200; i++) {
      const w: Vec3 = [0, 0, 45 * DEG];
      truth = qIntegrate(truth, w, 0.01);
      q = madgwickStep(q, w, gravityReading(0, 0), 0.01, 0.05);
    }
    expect(qAngleBetween(q, truth)).toBeLessThan(0.5);
  });
  it('yaw correction pulls the heading to the compass without changing the tilt', () => {
    let q = qFromEuler(10, 20, 5);
    for (let i = 0; i < 2000; i++) q = yawCorrect(q, 100, 1, 0.01);
    const e = qToEuler(q);
    expect(e.alpha).toBeCloseTo(100, 1);
    expect(e.beta).toBeCloseTo(20, 6);
    expect(e.gamma).toBeCloseTo(5, 6);
  });
});

describe('gyro axis convention check', () => {
  // tilting back and forth about x at 0.5 Hz, ±40°
  const run = (report: (wx: number) => { alpha: number; beta: number; gamma: number }) => {
    const c = new AxisCheck();
    for (let i = 0; i < 3000 && !c.decided; i++) {
      const t = i / 100;
      const th = 40 * Math.sin(Math.PI * t);
      const w = 40 * Math.PI * Math.cos(Math.PI * t);
      c.add([0, G * Math.sin(th * DEG), G * Math.cos(th * DEG)], report(w), 0.01);
    }
    return c;
  };
  it('recognizes the spec order (alpha = x)', () => {
    const c = run((wx) => ({ alpha: wx, beta: 0, gamma: 0 }));
    expect(c.decided).toBe(true);
    expect(c.convention).toBe('spec');
    expect(gyroAxes({ alpha: 1, beta: 2, gamma: 3 }, 'spec')).toEqual([1, 2, 3]);
  });
  it('recognizes the older order (beta = x)', () => {
    const c = run((wx) => ({ alpha: 0, beta: wx, gamma: 0 }));
    expect(c.decided).toBe(true);
    expect(c.convention).toBe('legacy');
    expect(gyroAxes({ alpha: 1, beta: 2, gamma: 3 }, 'legacy')).toEqual([2, 3, 1]);
  });
});
