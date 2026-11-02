import { describe, expect, it } from 'vitest';
import {
  atmosphere,
  braggShift,
  bridgeOutput,
  complementaryFilter,
  dopplerShift,
  hallVoltage,
  heading,
  irReading,
  kingsLaw,
  kingsLawInverse,
  potOutput,
  pt100,
  pt100Inverse,
  quadDecode,
  quadState,
  seismic,
  speedOfSound,
  splDb,
  steinhartHart,
  thermistorBeta,
  tofAmbiguity,
  typeK,
  typeKInverse,
  pitotVelocity,
} from '../src/sensors/lib/physics';
import { loadedFreq, modalMassFraction } from '../src/lib/beam';

describe('strain-gauge bridges', () => {
  const eps = 500e-6;
  it('quarter bridge ≈ GF·ε/4 for small strain', () => {
    expect(bridgeOutput('quarter', { bend: eps, axial: 0, dT: 0 })).toBeCloseTo((2 * eps) / 4, 6);
  });
  it('half and full bridges give GF·ε/2 and GF·ε', () => {
    expect(bridgeOutput('half', { bend: eps, axial: 0, dT: 0 })).toBeCloseTo(eps, 7);
    expect(bridgeOutput('full', { bend: eps, axial: 0, dT: 0 })).toBeCloseTo(2 * eps, 9);
  });
  it('temperature drifts the quarter bridge but cancels in dummy, half and full bridges', () => {
    const q = bridgeOutput('quarter', { bend: 0, axial: 0, dT: 20 });
    expect(Math.abs(q)).toBeGreaterThan(5e-5); // 20 °C × 10 µε/°C = 200 µε apparent strain
    for (const k of ['dummy', 'half', 'full'] as const) expect(bridgeOutput(k, { bend: 0, axial: 0, dT: 20 })).toBeCloseTo(0, 12);
  });
  it('half and full bridges reject axial strain', () => {
    expect(bridgeOutput('half', { bend: 0, axial: eps, dT: 0 })).toBeCloseTo(0, 12);
    expect(bridgeOutput('full', { bend: 0, axial: eps, dT: 0 })).toBeCloseTo(0, 12);
  });
});

describe('seismic instrument', () => {
  it('accelerometer ratio → 1 below resonance, displacement ratio → 1 above', () => {
    expect(seismic(0.01, 0.7).accel).toBeCloseTo(1, 3);
    expect(seismic(100, 0.7).disp).toBeCloseTo(1, 3);
    expect(seismic(1, 0.05).accel).toBeCloseTo(10, 6);
  });
});

describe('beam mass loading', () => {
  it('modal mass fraction is 1/4 with |φ(1)| = 1', () => {
    expect(modalMassFraction(0)).toBeCloseTo(0.25, 3);
  });
  it('a tip mass equal to the beam mass lowers f₁ by 1/√5', () => {
    expect(loadedFreq(100, 0, 1, 1)).toBeCloseTo(100 / Math.sqrt(5), 1);
    expect(loadedFreq(100, 0, 1, 0)).toBeCloseTo(100, 6);
  });
});

describe('magnetic and position sensors', () => {
  it('Hall voltage in a semiconductor is far larger than in copper', () => {
    const cu = hallVoltage(1, 1, 8.5e28, 1e-3);
    expect(cu).toBeCloseTo(7.3e-8, 9);
    expect(hallVoltage(1e-3, 0.1, 1e21, 1e-4) / cu).toBeGreaterThan(1e3);
  });
  it('quadrature decoding counts 4 edges per line and gets the direction right', () => {
    const N = 10;
    const fwd = Array.from({ length: 2001 }, (_, i) => quadState((i / 2000) * 2 * Math.PI, N));
    expect(quadDecode(fwd)).toBe(4 * N);
    const rev = Array.from({ length: 1001 }, (_, i) => quadState(-(i / 2000) * 2 * Math.PI, N));
    expect(quadDecode(rev)).toBe(-2 * N);
  });
  it('potentiometer is exact at the ends and loaded in the middle', () => {
    expect(potOutput(1, 10e3, 10e3)).toBe(1);
    expect(potOutput(0.5, 10e3, 1e12)).toBeCloseTo(0.5, 6);
    expect(potOutput(0.5, 10e3, 10e3)).toBeCloseTo(0.4, 9);
  });
  it('compass heading', () => {
    expect(heading(1, 0)).toBeCloseTo(0, 9);
    expect(heading(0, -1)).toBeCloseTo(90, 9);
    expect(heading(-1, 0)).toBeCloseTo(180, 9);
  });
});

describe('inertial', () => {
  it('complementary filter settles on the accelerometer angle without gyro bias', () => {
    const n = 2000;
    const out = complementaryFilter(new Float64Array(n), new Float64Array(n).fill(0.3), 0.01, 0.98, 0);
    expect(out[n - 1]).toBeCloseTo(0.3, 6);
  });
  it('with gyro bias the steady-state error is α·b·δt/(1−α)', () => {
    const n = 5000;
    const out = complementaryFilter(new Float64Array(n).fill(0.1), new Float64Array(n), 0.01, 0.98, 0);
    expect(out[n - 1]).toBeCloseTo((0.98 * 0.1 * 0.01) / 0.02, 6);
  });
});

describe('ranging and Doppler', () => {
  it('speed of sound at 20 °C ≈ 343 m/s', () => {
    expect(speedOfSound(20)).toBeCloseTo(343.2, 0);
  });
  it('phase ToF ambiguity range c/2f', () => {
    expect(tofAmbiguity(10e6)).toBeCloseTo(14.99, 2);
  });
  it('HeNe Doppler shift: 1 mm/s → 3.16 kHz', () => {
    expect(dopplerShift(1e-3)).toBeCloseTo(3160.6, 0);
  });
});

describe('flow', () => {
  it('sea-level standard density 1.225 kg/m³', () => {
    expect(atmosphere(0).rho).toBeCloseTo(1.225, 3);
  });
  it('Pitot: Δp = 61.25 Pa at sea level ↔ 10 m/s', () => {
    expect(pitotVelocity(61.25, 1.225)).toBeCloseTo(10, 6);
  });
  it("King's law round trip", () => {
    expect(kingsLawInverse(kingsLaw(7, 1.2, 0.8), 1.2, 0.8)).toBeCloseTo(7, 9);
  });
});

describe('temperature', () => {
  it('type K matches NIST ITS-90 table values', () => {
    expect(typeK(0)).toBeCloseTo(0, 3);
    expect(typeK(100)).toBeCloseTo(4.096, 3);
    expect(typeK(500)).toBeCloseTo(20.644, 3);
    expect(typeK(1000)).toBeCloseTo(41.276, 3);
    expect(typeK(-100)).toBeCloseTo(-3.554, 3);
    expect(typeKInverse(typeK(345))).toBeCloseTo(345, 6);
  });
  it('Pt100 matches IEC 60751', () => {
    expect(pt100(0)).toBeCloseTo(100, 9);
    expect(pt100(100)).toBeCloseTo(138.51, 2);
    expect(pt100(-100)).toBeCloseTo(60.26, 2);
    expect(pt100Inverse(pt100(250))).toBeCloseTo(250, 6);
  });
  it('10 kΩ NTC: β model and Steinhart–Hart agree at 25 °C', () => {
    expect(thermistorBeta(25)).toBeCloseTo(10e3, 6);
    expect(steinhartHart(10e3)).toBeCloseTo(25, 1);
  });
  it('IR thermometer reads correctly when emissivity is set right, low when set too high', () => {
    expect(irReading(200, 0.3, 0.3, 20)).toBeCloseTo(200, 6);
    expect(irReading(200, 0.3, 0.95, 20)).toBeLessThan(120);
  });
});

describe('fiber Bragg grating and acoustics', () => {
  it('≈1.2 pm/µε and ≈10 pm/°C at 1550 nm', () => {
    expect(braggShift(1550e-9, 1e-6, 0) * 1e12).toBeCloseTo(1.209, 3);
    expect(braggShift(1550e-9, 0, 1) * 1e12).toBeCloseTo(10.4, 1);
  });
  it('1 Pa rms = 94 dB SPL', () => {
    expect(splDb(1)).toBeCloseTo(93.98, 2);
  });
});
