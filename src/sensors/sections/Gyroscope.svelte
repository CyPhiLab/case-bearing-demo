<script lang="ts">
  import SensorSection from '../ui/SensorSection.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import CoriolisGyro from '../viz/CoriolisGyro.svelte';
  import GyroDrift from '../viz/GyroDrift.svelte';

  const spec = {
    measures: 'Angular velocity about one to three axes',
    principle: 'Coriolis force on a vibrating proof mass (MEMS); spinning rotors and optical rings in navigation-grade units',
    output: 'Capacitance change of the sense comb, demodulated to a rate',
    range: '±125 to ±2000 °/s (MEMS)',
    sensitivity: 'e.g. 70 m°/s per count at ±2000 °/s',
    bandwidth: 'DC to a few hundred Hz',
    watch: 'Bias and its temperature drift, noise (angle random walk), vibration sensitivity',
  };
</script>

<SensorSection id="gyroscope" {spec}>
  {#snippet intro()}
    <p>
      A gyroscope measures angular velocity, the rate of rotation in degrees or radians per second. The gyroscopes in phones and drones have no
      spinning parts. They are Coriolis vibratory gyroscopes: a proof mass is kept vibrating along one axis (the drive axis). When the chip
      rotates, the Coriolis effect pushes the moving mass sideways along a second axis (the sense axis):
    </p>
    <div class="eq"><Tex display math={'\\vec F_c = -2m\\,\\vec\\Omega \\times \\vec v'} /></div>
    <p>
      The sideways motion is proportional to the rotation rate Ω and is measured with capacitive combs, as in an accelerometer. This is why the
      slide says the operating principle is similar.
    </p>
  {/snippet}

  <h3>Coriolis force on a vibrating mass</h3>
  <CoriolisGyro />

  <h3>From rate to angle: drift</h3>
  <p class="self-only">
    A gyroscope gives rate, not angle. To track orientation, the rate is integrated over time, and so are its errors. A small constant offset
    (bias) becomes an angle error that grows steadily, and random noise becomes an error that wanders. A gyroscope alone is therefore good for
    fast, short-term changes in orientation but not for holding a heading over minutes. The IMU section shows how this is corrected with the
    accelerometer and magnetometer.
  </p>
  <GyroDrift />

  <Predict question="With the noise set to zero, the bias doubled from 0.5 to 1 °/s, and the recording twice as long (120 s), how much larger is the final angle error?">
    <p>
      Four times: the error from a bias is b·t, and both b and t have doubled (0.5 × 60 = 30° becomes 1 × 120 = 120°).
    </p>
  </Predict>
</SensorSection>

<style>
  .eq { overflow-x: auto; }
</style>
