// Drive-end bearing on the CWRU rig: SKF 6205-2RS JEM deep-groove ball bearing.
export const BEARING = {
  model: 'SKF 6205-2RS JEM',
  balls: 9,
  ballDiameter: 0.3126, // in
  pitchDiameter: 1.537, // in
  innerDiameter: 0.9843,
  outerDiameter: 2.0472,
  contactAngle: 0, // rad
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
export function faultFrequencies(rpm: number, b = BEARING): FaultFrequencies {
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
