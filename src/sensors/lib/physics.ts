// Transfer functions and models for the sensors page. Everything is a pure function so it can be unit-tested
// against reference values (NIST tables, IEC 60751, textbook limits).

// ───────────────────────── strain gauges and bridges ─────────────────────────

/** Wheatstone bridge output V_out/V_ex for fractional resistance changes r_i = ΔR_i/R in arms 1–4 (exact). */
export function bridgeRatio(r: readonly [number, number, number, number]): number {
  const [R1, R2, R3, R4] = r.map((v) => 1 + v);
  return R1 / (R1 + R2) - R4 / (R4 + R3);
}

export type BridgeKind = 'quarter' | 'dummy' | 'half' | 'full';

export interface BridgeLoad {
  bend: number; // bending strain at the surface (top +, bottom −)
  axial: number; // axial strain, same sign top and bottom
  dT: number; // temperature change of the gauges, °C
  GF?: number; // gauge factor
  apparent?: number; // apparent strain per °C of an uncompensated gauge on this material (strain/°C)
}

/**
 * Fractional resistance change of each arm. Arms 1 and 3 are on the top surface, 2 and 4 on the bottom, matching
 * the usual layout where adjacent arms subtract and opposite arms add. Completion resistors (r = 0) sit in the
 * instrument and do not see the specimen temperature.
 *  quarter: one active gauge (arm 1)
 *  dummy:   one active gauge plus an unstrained gauge on the same material in arm 2 (temperature compensation only)
 *  half:    top gauge in arm 1, bottom gauge in arm 2
 *  full:    top gauges in arms 1 and 3, bottom gauges in arms 2 and 4
 */
export function bridgeArms(kind: BridgeKind, l: BridgeLoad): [number, number, number, number] {
  const GF = l.GF ?? 2.0;
  const th = GF * (l.apparent ?? 10e-6) * l.dT;
  const top = GF * (l.axial + l.bend) + th;
  const bot = GF * (l.axial - l.bend) + th;
  switch (kind) {
    case 'quarter':
      return [top, 0, 0, 0];
    case 'dummy':
      return [top, th, 0, 0];
    case 'half':
      return [top, bot, 0, 0];
    case 'full':
      return [top, bot, top, bot];
  }
}

export const bridgeOutput = (kind: BridgeKind, l: BridgeLoad) => bridgeRatio(bridgeArms(kind, l));

/** surface bending strain of a cantilever, ε = 6 F (L − x) / (E b h²) */
export const cantileverStrain = (F: number, L: number, x: number, E: number, b: number, h: number) => (6 * F * (L - x)) / (E * b * h * h);

// ───────────────────────── accelerometers, piezo, microphones ─────────────────────────

/**
 * Base-excited mass–spring–damper (seismic instrument) at r = f/f_n.
 * accel: relative displacement × ω_n² / base acceleration (→ 1 for r ≪ 1, accelerometer region)
 * disp:  relative displacement / base displacement      (→ 1 for r ≫ 1, seismometer region)
 */
export function seismic(r: number, zeta: number) {
  const D = Math.hypot(1 - r * r, 2 * zeta * r);
  return { accel: 1 / D, disp: (r * r) / D, phase: Math.atan2(2 * zeta * r, 1 - r * r) };
}

/** magnitude of the charge-amplifier high-pass, |jωτ / (1 + jωτ)| */
export const highpassMag = (f: number, tau: number) => {
  const w = 2 * Math.PI * f * tau;
  return w / Math.hypot(1, w);
};

/** sound pressure level re 20 µPa */
export const splDb = (pRms: number) => 20 * Math.log10(pRms / 20e-6);
export const splToPa = (db: number) => 20e-6 * 10 ** (db / 20);

// ───────────────────────── magnetic and position ─────────────────────────

export const Q_E = 1.602176634e-19;

/** Hall voltage V_H = I B / (n q t) */
export const hallVoltage = (I: number, B: number, n: number, t: number) => (I * B) / (n * Q_E * t);

/** quadrature encoder outputs (A, B) at shaft angle θ (rad) with N lines per revolution; B lags A by 90° */
export function quadState(theta: number, N: number): [number, number] {
  const p = (theta * N) / (2 * Math.PI);
  const fr = (v: number) => v - Math.floor(v);
  return [fr(p) < 0.5 ? 1 : 0, fr(p - 0.25) < 0.5 ? 1 : 0];
}

/** ×4 quadrature decoding of a sequence of (A, B) states → net count (positive = forward) */
export function quadDecode(states: ReadonlyArray<readonly [number, number]>): number {
  const pos: Record<number, number> = { 2: 0, 3: 1, 1: 2, 0: 3 };
  let count = 0;
  for (let i = 1; i < states.length; i++) {
    const a = pos[(states[i - 1][0] << 1) | states[i - 1][1]];
    const b = pos[(states[i][0] << 1) | states[i][1]];
    const d = (b - a + 4) % 4;
    if (d === 1) count++;
    else if (d === 3) count--;
  }
  return count;
}

/** loaded potentiometer: V_out / V_s for wiper fraction x, element resistance Rp, load resistance RL */
export const potOutput = (x: number, Rp: number, RL: number) => x / (1 + (Rp / RL) * x * (1 - x));

/** LVDT differential gain vs normalized core position u = x / rated range: linear inside ±1, saturating outside */
export const lvdtGain = (u: number) => u / (1 + Math.abs(u / 1.6) ** 6) ** (1 / 6);

/** compass heading (deg, 0 = magnetic north, clockwise) from horizontal field components in the sensor frame */
export function heading(bx: number, by: number): number {
  const h = (Math.atan2(-by, bx) * 180) / Math.PI;
  return (h + 360) % 360;
}

// ───────────────────────── inertial ─────────────────────────

/** complementary filter θ_k = α(θ_{k−1} + ω_k δt) + (1 − α) θ_acc,k */
export function complementaryFilter(gyro: ArrayLike<number>, accAngle: ArrayLike<number>, dt: number, alpha: number, theta0 = accAngle[0] ?? 0): Float64Array {
  const out = new Float64Array(gyro.length);
  let th = theta0;
  for (let i = 0; i < gyro.length; i++) {
    th = alpha * (th + gyro[i] * dt) + (1 - alpha) * accAngle[i];
    out[i] = th;
  }
  return out;
}

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

/** position error from a constant accelerometer bias b after t seconds, ½ b t² */
export const deadReckonError = (b: number, t: number) => 0.5 * b * t * t;

// ───────────────────────── ranging, Doppler ─────────────────────────

export const C_LIGHT = 299_792_458;

export const tofTime = (d: number, c = C_LIGHT) => (2 * d) / c;
/** maximum unambiguous range of phase-shift time of flight with modulation frequency f */
export const tofAmbiguity = (f: number) => C_LIGHT / (2 * f);
/** distance a phase-shift ToF sensor reports (wraps at the ambiguity range) */
export const tofPhaseReading = (d: number, f: number) => d % tofAmbiguity(f);

/** speed of sound in dry air (m/s) at T °C */
export const speedOfSound = (T: number) => 331.3 * Math.sqrt(1 + T / 273.15);

/** Doppler shift of light reflected from a surface moving at v along the beam, f_D = 2 v / λ */
export const dopplerShift = (v: number, lambda = 632.8e-9) => (2 * v) / lambda;

// ───────────────────────── flow ─────────────────────────

export const R_AIR = 287.05;

/** standard atmosphere (troposphere): pressure (Pa), temperature (K), density (kg/m³) at altitude h (m) */
export function atmosphere(h: number) {
  const T = 288.15 - 0.0065 * h;
  const p = 101325 * (1 - 2.25577e-5 * h) ** 5.25588;
  return { T, p, rho: p / (R_AIR * T) };
}

export const pitotVelocity = (dp: number, rho: number) => Math.sqrt((2 * Math.max(dp, 0)) / rho);
/** uncertainty in v from an uncertainty u_dp in Δp: u_v = u_dp / (ρ v) */
export const pitotUncertainty = (v: number, uDp: number, rho: number) => uDp / (rho * Math.max(v, 1e-9));

/** King's law for a constant-temperature hot wire: E² = A + B vⁿ */
export const kingsLaw = (v: number, A: number, B: number, n = 0.45) => Math.sqrt(A + B * Math.max(v, 0) ** n);
export const kingsLawInverse = (E: number, A: number, B: number, n = 0.45) => (Math.max(E * E - A, 0) / B) ** (1 / n);

// ───────────────────────── temperature ─────────────────────────

// NIST ITS-90 type K reference functions, E in mV, T in °C
const K_NEG = [0, 0.39450128025e-1, 0.236223735980e-4, -0.328589067840e-6, -0.499048287770e-8, -0.675090591730e-10, -0.574103274280e-12, -0.310888728940e-14, -0.104516093650e-16, -0.198892668780e-19, -0.163226974860e-22];
const K_POS = [-0.176004136860e-1, 0.389212049750e-1, 0.185587700320e-4, -0.994575928740e-7, 0.318409457190e-9, -0.560728448890e-12, 0.560750590590e-15, -0.320207200030e-18, 0.971511471520e-22, -0.121047212750e-25];
const K_A = [0.1185976, -0.1183432e-3, 0.1269686e3];

const poly = (c: readonly number[], x: number) => c.reduceRight((s, ci) => s * x + ci, 0);

/** type K thermocouple EMF (mV) for a junction at T °C with the reference junction at 0 °C */
export function typeK(T: number): number {
  if (T < 0) return poly(K_NEG, T);
  return poly(K_POS, T) + K_A[0] * Math.exp(K_A[1] * (T - K_A[2]) ** 2);
}

/** inverse of typeK by bisection over −270…1372 °C */
export function typeKInverse(E: number): number {
  let lo = -270;
  let hi = 1372;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (typeK(mid) < E) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const K0 = 273.15;

/** NTC thermistor, β model: R = R₀ exp(β (1/T − 1/T₀)), temperatures in °C */
export const thermistorBeta = (T: number, R0 = 10e3, beta = 3950, T0 = 25) => R0 * Math.exp(beta * (1 / (T + K0) - 1 / (T0 + K0)));

/** Steinhart–Hart: temperature (°C) from resistance; default coefficients are typical for a 10 kΩ NTC */
export function steinhartHart(R: number, A = 1.129148e-3, B = 2.34125e-4, C = 8.76741e-8): number {
  const l = Math.log(R);
  return 1 / (A + B * l + C * l * l * l) - K0;
}

/** Pt100 RTD, Callendar–Van Dusen (IEC 60751) */
export function pt100(T: number, R0 = 100): number {
  const A = 3.9083e-3;
  const B = -5.775e-7;
  const C = -4.183e-12;
  return T >= 0 ? R0 * (1 + A * T + B * T * T) : R0 * (1 + A * T + B * T * T + C * (T - 100) * T * T * T);
}

export function pt100Inverse(R: number, R0 = 100): number {
  let lo = -200;
  let hi = 850;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (pt100(mid, R0) < R) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const SIGMA_SB = 5.670374419e-8;

/**
 * Temperature (°C) an IR thermometer set to emissivity εset reports for a target at T with true emissivity ε,
 * in surroundings at Tamb (total-radiation model: the detector sees emitted plus reflected radiation).
 */
export function irReading(T: number, eps: number, epsSet: number, Tamb: number): number {
  const Tk = T + K0;
  const Ta = Tamb + K0;
  const W = eps * Tk ** 4 + (1 - eps) * Ta ** 4;
  const t4 = (W - (1 - epsSet) * Ta ** 4) / epsSet;
  return Math.sign(t4) * Math.abs(t4) ** 0.25 - K0;
}

/** first-order sensor time constant for a spherical bead, τ = ρ c d / (6 h) */
export const beadTau = (d: number, h: number, rho = 8700, c = 450) => (rho * c * d) / (6 * h);

// ───────────────────────── fiber Bragg grating ─────────────────────────

/**
 * Bragg wavelength shift (m) for strain ε and temperature change dT:
 * Δλ/λ = (1 − p_e) ε + (α + ξ) ΔT, with p_e ≈ 0.22 and α + ξ ≈ 6.7×10⁻⁶ /°C for silica fiber.
 */
export const braggShift = (lambda: number, eps: number, dT: number, pe = 0.22, alphaXi = 6.7e-6) => lambda * ((1 - pe) * eps + alphaXi * dT);

/** reflected spectrum of a grating (Gaussian approximation of the main lobe), peak reflectivity Rmax, FWHM w */
export const gratingReflect = (lambda: number, center: number, w = 0.2e-9, Rmax = 0.9) => Rmax * Math.exp((-4 * Math.LN2 * (lambda - center) ** 2) / (w * w));
