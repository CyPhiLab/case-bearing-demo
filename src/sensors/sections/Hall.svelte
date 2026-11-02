<script lang="ts">
  import SensorSection from '../ui/SensorSection.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import HallPlate from '../viz/HallPlate.svelte';
  import ToothedWheel from '../viz/ToothedWheel.svelte';

  const spec = {
    measures: 'Magnetic field component perpendicular to the chip',
    principle: 'Lorentz force on charge carriers in a thin semiconductor plate',
    output: 'Voltage (linear sensors) or a switched logic level (switches, latches)',
    range: '±10 mT to ±1 T for linear sensors',
    sensitivity: '1–100 mV/mT (with on-chip amplifier)',
    bandwidth: 'DC to ~100 kHz',
    watch: 'Offset and its temperature drift, stray fields, distance to the magnet',
  };
</script>

<SensorSection id="hall" title="Hall-effect sensors" {spec}>
  {#snippet intro()}
    <p>
      When a current flows through a conductor in a magnetic field, the magnetic force pushes the moving charges toward one side. Charge builds
      up on that side until the electric field it creates balances the magnetic force. The voltage that appears across the plate is the
      <b>Hall voltage</b>:
    </p>
    <div class="eq"><Tex display math={'V_H = \\frac{I B}{n q t}'} /></div>
    <p>
      where <i>n</i> is the density of charge carriers, <i>q</i> their charge and <i>t</i> the plate thickness. The voltage is proportional to the
      field, so with a known current the sensor measures B. Hall sensors are cheap, contactless and robust, which is why they are, as the slide
      says, used everywhere: in ignition timing, wheel-speed sensors for anti-lock brakes, gear-shifter position, phone compasses, and the
      position encoders of robot joints and brushless motors.
    </p>
  {/snippet}

  <h3>The Hall voltage</h3>
  <HallPlate />

  <h3>Speed and position from a toothed wheel</h3>
  <p class="self-only">
    Many Hall sensors are used as switches rather than for measuring field strength. A magnet behind the sensor faces a steel wheel. A tooth in
    front of the sensor draws in the field, a gap lets it weaken, so the output toggles once per tooth. A comparator with hysteresis (a Schmitt
    trigger) turns the analog field into clean pulses. Wheel-speed sensors for anti-lock brakes and crankshaft sensors for ignition timing both
    work this way.
  </p>
  <ToothedWheel />

  <Predict question="The crank wheel has 36 − 1 teeth and the engine runs at 1200 rpm. What is the time between ordinary pulses, and how long is the gap?">
    <p>
      1200 rpm is 20 rev/s, so one tooth pitch (10°) takes 1/(36 × 20) = 1.39 ms. At the missing tooth, the gap between pulses is two pitches,
      2.78 ms. The controller recognizes the reference angle by this longer interval.
    </p>
  </Predict>
</SensorSection>

<style>
  .eq { overflow-x: auto; }
</style>
