<script lang="ts">
  import SensorSection from '../ui/SensorSection.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import TofPulse from '../viz/TofPulse.svelte';
  import LidarRoom from '../viz/LidarRoom.svelte';

  const spec = {
    measures: 'Distance to a surface; with scanning, the shape of a scene',
    principle: 'Round-trip time of a light pulse, or phase shift of modulated light',
    output: 'Distance (digital), or a point cloud',
    range: '~4 cm to 2 m (e.g. VL53L0X); up to ~200 m for automotive lidar',
    sensitivity: 'Resolution ~1 mm to a few cm; 1 cm of distance is 67 ps of round-trip time',
    bandwidth: '10–100 measurements/s (single point); ~10⁵–10⁶ points/s (scanning lidar)',
    watch: 'Dark or shiny surfaces, sunlight, multipath, phase wrapping, shadowing',
  };
</script>

<SensorSection id="tof" title="Time-of-flight sensors and lidar" {spec}>
  {#snippet intro()}
    <p>
      A time-of-flight (ToF) sensor sends out light and measures how long it takes to come back from a surface. Since light travels at a known
      speed, the delay gives the distance:
    </p>
    <div class="eq"><Tex display math={'d = \\frac{c\\,\\Delta t}{2}'} /></div>
    <p>
      The factor of 2 accounts for the trip out and back. Light covers 30 cm in a nanosecond, so the electronics have to resolve picoseconds:
      1 cm of distance corresponds to 67 ps. Small ToF chips such as the VL53L0X on the slide measure one distance; a <b>lidar</b> sweeps the beam
      across the scene and builds up a point cloud.
    </p>
  {/snippet}

  <h3>Pulsed and phase-shift time of flight</h3>
  <p class="self-only">
    There are two ways to measure the delay. A pulsed sensor times a short flash directly. A phase-shift (indirect) sensor modulates its light
    at a frequency f and compares the phase of the returned modulation with the emitted one. The phase is easier to measure precisely than a
    picosecond delay, but it repeats every period, so distances are only known modulo c/2f.
  </p>
  <TofPulse />

  <h3>A scanning lidar</h3>
  <LidarRoom />

  <Predict question="A phase-shift sensor modulates at 20 MHz and the wall is 9 m away. What does it report?">
    <p>
      The unambiguous range is c/2f = 7.5 m, so 9 m wraps to 9 − 7.5 = 1.5 m. Switch to "Phase shift" and set the distance to 9 m to see it.
    </p>
  </Predict>
</SensorSection>

<style>
  .eq { overflow-x: auto; }
</style>
