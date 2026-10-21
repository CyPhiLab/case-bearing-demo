export interface BearingGeometry {
  model: string;
  rig: string;
  balls: number; // rolling elements per row
  ballDiameter: number; // in
  pitchDiameter: number; // in
  innerDiameter: number; // in (bore, for drawing)
  outerDiameter: number; // in (for drawing)
  contactAngle: number; // rad
  rpm: number; // shaft speed used on that rig
  element: 'ball' | 'roller';
}

// Drive-end bearing on the CWRU rig: SKF 6205-2RS JEM deep-groove ball bearing.
export const BEARING: BearingGeometry = {
  model: 'SKF 6205-2RS JEM',
  rig: 'CWRU motor test stand (seeded faults)',
  balls: 9,
  ballDiameter: 0.3126, // in
  pitchDiameter: 1.537, // in
  innerDiameter: 0.9843,
  outerDiameter: 2.0472,
  contactAngle: 0, // rad
  rpm: 1772,
  element: 'ball',
};

// IMS / NASA run-to-failure rig: Rexnord ZA-2115 double-row spherical roller bearing (Qiu et al., 2006).
// Bore and outer diameter are drawing approximations; the kinematics only need d, D, n and the contact angle.
export const IMS_BEARING: BearingGeometry = {
  model: 'Rexnord ZA-2115',
  rig: 'IMS run-to-failure rig (natural wear)',
  balls: 16,
  ballDiameter: 0.331,
  pitchDiameter: 2.815,
  innerDiameter: 2.815 - 2.6 * 0.331,
  outerDiameter: 2.815 + 2.6 * 0.331,
  contactAngle: (15.17 * Math.PI) / 180,
  rpm: 2000,
  element: 'roller',
};

// Paderborn (KAt) test rig: 6203 deep-groove ball bearing, run at 1500 rpm in the data used here.
export const PU_BEARING: BearingGeometry = {
  model: '6203 ball bearing',
  rig: 'Paderborn KAt rig (machined and real damage)',
  balls: 8,
  ballDiameter: 6.75 / 25.4,
  pitchDiameter: 28.55 / 25.4,
  innerDiameter: 17 / 25.4,
  outerDiameter: 40 / 25.4,
  contactAngle: 0,
  rpm: 1500,
  element: 'ball',
};

export const RIG_RPM = 1772; // 1 hp load

export interface FaultFrequencies {
  shaft: number; // Hz
  ftf: number; // cage (fundamental train)
  bpfo: number; // ball pass, outer race
  bpfi: number; // ball pass, inner race
  bsf: number; // ball spin
}

/** Classic kinematic defect frequencies for a rotating inner race and stationary outer race. */
export function faultFrequencies(rpm: number, b: BearingGeometry = BEARING): FaultFrequencies {
  const fr = rpm / 60;
  const r = (b.ballDiameter / b.pitchDiameter) * Math.cos(b.contactAngle);
  return {
    shaft: fr,
    ftf: (fr / 2) * (1 - r),
    bpfo: ((b.balls * fr) / 2) * (1 - r),
    bpfi: ((b.balls * fr) / 2) * (1 + r),
    bsf: ((b.pitchDiameter * fr) / (2 * b.ballDiameter)) * (1 - r * r),
  };
}
