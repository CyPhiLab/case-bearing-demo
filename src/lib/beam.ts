// Euler–Bernoulli cantilever (clamped at x = 0, free at x = L). Shared by the Signals Lab beam demo and the
// sensors page (accelerometer mass loading, scanning laser vibrometer).

/** roots of 1 + cos βL cosh βL = 0 for the first four modes */
export const BL = [1.8751, 4.6941, 7.8548, 10.9955];

export const MATERIALS = {
  steel: { E: 200e9, rho: 7850, label: 'Steel' },
  aluminum: { E: 69e9, rho: 2700, label: 'Aluminum' },
} as const;
export type Material = keyof typeof MATERIALS;

/** mode shape n (0-based) at u = x/L, normalized so |φ(1)| = 1 */
export function phi(n: number, u: number): number {
  const b = BL[n];
  const s = (Math.cosh(b) + Math.cos(b)) / (Math.sinh(b) + Math.sin(b));
  return (Math.cosh(b * u) - Math.cos(b * u) - s * (Math.sinh(b * u) - Math.sin(b * u))) / 2;
}

/** √(EI/ρA) for a rectangular section of thickness h (m) */
export const beamC = (E: number, rho: number, h: number) => Math.sqrt((E * h * h) / (12 * rho));

/** natural frequencies (Hz) of the first four modes */
export const beamFreqs = (E: number, rho: number, h: number, L: number) => BL.map((b) => (b * b * beamC(E, rho, h)) / (2 * Math.PI * L * L));

/** ∫₀¹ φ_n(u)² du (= 0.25 for every mode with this normalization) */
export function modalMassFraction(n: number, steps = 2000): number {
  let s = 0;
  for (let i = 0; i < steps; i++) {
    const u = (i + 0.5) / steps;
    s += phi(n, u) ** 2;
  }
  return s / steps;
}

/**
 * Natural frequency of mode n with a point mass M attached at u = x/L (Rayleigh estimate, mode shape unchanged):
 * f' = f / √(1 + M φ(u)² / (m_beam ∫φ²)).
 */
export function loadedFreq(f: number, n: number, massRatio: number, u: number): number {
  return f / Math.sqrt(1 + (massRatio * phi(n, u) ** 2) / modalMassFraction(n));
}
