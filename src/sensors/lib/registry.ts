// The sensors on the page, in lecture order, and the groups shown in the top navigation.

export interface GroupInfo {
  id: string;
  label: string;
}
export interface SensorInfo {
  id: string;
  name: string;
  group: string;
  slide: number | null; // slide number in the lecture, null for sensors beyond the slides
  d: string; // one-line description for the overview grid
}

export const GROUPS: GroupInfo[] = [
  { id: 'strain', label: 'Strain' },
  { id: 'accel', label: 'Acceleration' },
  { id: 'rotation', label: 'Rotation' },
  { id: 'magnetic', label: 'Magnetic' },
  { id: 'imu', label: 'IMU' },
  { id: 'optical', label: 'Optical' },
  { id: 'flow', label: 'Flow' },
  { id: 'temperature', label: 'Temperature' },
  { id: 'emerging', label: 'Soft & fiber' },
  { id: 'lab', label: 'Phone lab' },
];

export const SENSORS: SensorInfo[] = [
  { id: 'strain-gauge', name: 'Strain gauge', group: 'strain', slide: 2, d: 'Resistance changes with strain; read with a Wheatstone bridge' },
  { id: 'accelerometer', name: 'Accelerometer', group: 'accel', slide: 5, d: 'A mass on a spring; its deflection gives acceleration' },
  { id: 'gyroscope', name: 'Gyroscope', group: 'rotation', slide: 8, d: 'Coriolis force on a vibrating mass gives angular velocity' },
  { id: 'hall', name: 'Hall-effect sensor', group: 'magnetic', slide: 9, d: 'A voltage across a current-carrying plate in a magnetic field' },
  { id: 'magnetometer', name: 'Magnetometer', group: 'magnetic', slide: 10, d: 'Measures the magnetic field vector; a compass' },
  { id: 'imu', name: 'IMU', group: 'imu', slide: 11, d: 'Accelerometer, gyroscope and magnetometer fused into orientation' },
  { id: 'tof', name: 'Time of flight and lidar', group: 'optical', slide: 12, d: 'Distance from the round-trip time of light' },
  { id: 'ldv', name: 'Laser Doppler vibrometer', group: 'optical', slide: 13, d: 'Surface velocity from the Doppler shift of laser light' },
  { id: 'pitot', name: 'Pitot tube', group: 'flow', slide: 14, d: 'Flow speed from the stagnation pressure' },
  { id: 'thermocouple', name: 'Thermocouple', group: 'temperature', slide: 15, d: 'A voltage from a junction of two metals' },
  { id: 'thermistor', name: 'Thermistor', group: 'temperature', slide: 16, d: 'A resistor whose resistance falls steeply with temperature' },
  { id: 'soft', name: 'Soft sensors', group: 'emerging', slide: 17, d: 'Stretchable resistive and capacitive skins, camera-based touch' },
  { id: 'fbg', name: 'Fiber Bragg grating', group: 'emerging', slide: 18, d: 'A reflected wavelength that shifts with strain and temperature' },
  { id: 'phone', name: 'Phone sensor lab', group: 'lab', slide: null, d: 'Tilt, rotation and heading from the sensors in a phone' },
];

export const sensorNum = (id: string) => SENSORS.findIndex((s) => s.id === id) + 1;
export const groupOf = (id: string) => SENSORS.find((s) => s.id === id)?.group ?? '';
export const groupLabel = (g: string) => GROUPS.find((x) => x.id === g)?.label ?? '';

const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`;
/** videos and links embedded in the lecture slides */
export const VIDEOS: Record<string, { title: string; url: string }[]> = {
  'strain-gauge': [
    { title: 'Strain gauge sensors in concrete (structural health monitoring)', url: yt('pXWPoPVKvEw') },
    { title: 'Six-axis force/torque sensor (product animation)', url: yt('NNBGrozRyo4') },
  ],
  accelerometer: [
    { title: 'What is an accelerometer and how does it work?', url: yt('q4_VZte-8wg') },
    { title: 'How it works: MEMS accelerometer', url: yt('ObXspXB9sJI') },
  ],
  gyroscope: [{ title: 'How does Hubble orient itself in space?', url: yt('84Nq0iWPM1k') }],
  hall: [{ title: 'What is the Hall effect and how Hall-effect sensors work', url: yt('wpAA3qeOYiI') }],
  magnetometer: [{ title: 'NOAA Ocean Exploration: magnetometers', url: 'https://oceanexplorer.noaa.gov/technology/magnetometer/' }],
  tof: [{ title: 'Top five applications of lidar technology', url: yt('Ao5pL3qvulg') }],
  ldv: [
    { title: 'Basic principles of laser Doppler vibrometry', url: yt('ob2Eq4iAh7U') },
    { title: 'Laser Doppler vibrometry (University of Lincoln)', url: yt('yRxYIfZUxW8') },
  ],
  pitot: [{ title: 'The Pitot tube: measuring air speed with a manometer', url: yt('DcSUjLyqYHI') }],
  thermocouple: [{ title: 'What is a thermocouple? How do they work?', url: yt('QOmR6IGQrxI') }],
  soft: [
    { title: 'GelSight sensor gives robots touch', url: yt('slIq89RO2Go') },
    { title: 'Two-axis soft sensor demo', url: yt('w1EBdbe4Nes') },
  ],
  fbg: [{ title: 'FBG sensor principle', url: yt('gi1KDEvs8c4') }],
};
