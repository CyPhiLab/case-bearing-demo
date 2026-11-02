<script lang="ts">
  import SensorSection from '../ui/SensorSection.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import ComplementaryFilter from '../viz/ComplementaryFilter.svelte';
  import DeadReckoning from '../viz/DeadReckoning.svelte';

  const spec = {
    measures: 'Orientation (roll, pitch, heading); with integration, velocity and position',
    principle: 'Three-axis accelerometer + gyroscope (+ magnetometer) combined by a fusion filter',
    output: 'Raw rates and accelerations, or a fused orientation (angles or quaternion)',
    range: 'Set by the individual sensors (e.g. ±16 g, ±2000 °/s)',
    sensitivity: 'Fused tilt accuracy ~1° (consumer), heading ~2–5°',
    bandwidth: 'Fused output typically 100–1000 Hz',
    watch: 'Gyro drift, linear acceleration mistaken for tilt, magnetic disturbances, sensor misalignment',
  };
</script>

<SensorSection id="imu" title="Inertial measurement units" {spec}>
  {#snippet intro()}
    <p>
      An inertial measurement unit (IMU) packages a three-axis accelerometer and a three-axis gyroscope, often with a three-axis magnetometer.
      None of them gives orientation reliably on its own. The accelerometer measures the direction of gravity and so gives tilt, but only when
      the device is not accelerating. The gyroscope follows fast rotations but drifts. The magnetometer gives heading but is disturbed by
      nearby iron. Combining them gives an absolute orientation that is both stable and responsive, as the slide says. IMUs are critical in
      cars, phones, drones and robots.
    </p>
  {/snippet}

  <h3>Combining gyroscope and accelerometer</h3>
  <p class="self-only">
    The simplest fusion method is the <b>complementary filter</b>. At each time step, it advances the previous angle using the gyro rate, then
    pulls the result slightly toward the accelerometer angle:
  </p>
  <div class="eq self-only"><Tex display math={'\\theta_k = \\alpha\\,(\\theta_{k-1} + \\omega_k\\,\\delta t) + (1-\\alpha)\\,\\theta_{acc,k}'} /></div>
  <p class="self-only">
    This is a high-pass filter on the gyro angle and a low-pass filter on the accelerometer angle with the same crossover frequency, so together
    they pass the true angle unchanged. Above the crossover the gyro is trusted, below it the accelerometer. Try α close to 1 (the gyro drift
    leaks in) and α near 0.8 (the accelerometer noise and the shaking leak in). Kalman filters, used in most products, do the same with weights
    that adapt to the estimated noise.
  </p>
  <ComplementaryFilter />

  <h3>Position from acceleration</h3>
  <p class="self-only">
    Integrating acceleration once gives velocity, twice gives position. Errors are integrated too. A constant bias b produces a velocity error
    b·t and a position error that grows with the square of time:
  </p>
  <div class="eq self-only"><Tex display math={'e_x(t) = \\tfrac{1}{2}\\, b\\, t^2'} /></div>
  <DeadReckoning />

  <Predict question="A drone holds its tilt using only the accelerometer while it accelerates forward at 2 m/s². What tilt does it think it has?">
    <p>
      About 11.5°. The accelerometer measures gravity plus the reaction to the forward acceleration, so the apparent "down" tips backward by
      atan(2/9.81). The gyro shows no rotation, which is why fusing the two avoids the error.
    </p>
  </Predict>
</SensorSection>

<style>
  .eq { overflow-x: auto; }
</style>
