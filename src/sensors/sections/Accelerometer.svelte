<script lang="ts">
  import SensorSection from '../ui/SensorSection.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import SeismicResponse from '../viz/SeismicResponse.svelte';
  import MemsComb from '../viz/MemsComb.svelte';
  import MassLoading from '../viz/MassLoading.svelte';

  const spec = {
    measures: 'Acceleration along one to three axes (including gravity)',
    principle: 'Deflection of a proof mass on a spring',
    output: 'Capacitance change (MEMS), resistance change (piezoresistive), or charge (piezoelectric)',
    range: '±2 g to ±16 g for MEMS (e.g. ADXL345); ±50 g to ±500 g for vibration sensors',
    sensitivity: 'ADXL345: 3.9 mg per count; vibration sensors 10–100 mV/g',
    bandwidth: 'DC to ~1 kHz (MEMS); up to ~10 kHz (piezoelectric)',
    watch: 'Resonance, mass loading, mounting stiffness, cable noise, cross-axis sensitivity',
  };
</script>

<SensorSection id="accelerometer" {spec}>
  {#snippet intro()}
    <p>
      An accelerometer contains a small <b>proof mass</b> held by a spring inside a case attached to the object. When the case accelerates, the
      spring has to push the mass along with it, so it deflects. Well below the natural frequency of the mass and spring, the deflection is
      proportional to the acceleration:
    </p>
    <div class="eq"><Tex display math={'z = \\frac{a}{\\omega_n^2}, \\qquad \\omega_n = \\sqrt{k/m}'} /></div>
    <p>
      The deflection is converted to an electrical signal by a resistive or capacitive element, as on the slide. Because gravity also pulls on the
      mass, an accelerometer at rest reads 1 g upward. This is how a phone knows which way is down.
    </p>
  {/snippet}

  <h3>One instrument, two regions</h3>
  <p class="self-only">
    The response of the mass to motion of the case depends on the frequency ratio f/fₙ. Below about 0.3 fₙ, the relative motion follows the
    acceleration (blue curve flat at 1). Far above fₙ, the mass stays nearly still in space and the case moves around it, so the relative motion
    equals the displacement of the case (orange curve flat at 1). That is how a seismometer works. A damping ratio near 0.7 keeps the blue curve
    flat to the highest frequency, which is why many accelerometers are designed for it. Lightly damped piezoelectric accelerometers are instead
    used only up to about a fifth of their resonance.
  </p>
  <SeismicResponse />

  <h3>Inside a MEMS accelerometer</h3>
  <p class="self-only">
    The accelerometer in a phone is a micro-electromechanical system (MEMS): a silicon proof mass with comb fingers, a few hundred micrometres
    across. Each moving finger sits between two fixed ones. Acceleration closes one gap and opens the other, so one capacitance rises and the
    other falls. The circuit measures the difference, which is proportional to the displacement and cancels effects common to both sides.
  </p>
  <MemsComb />

  <h3>Mass loading</h3>
  <p class="self-only">
    A sensor attached to a structure becomes part of it. Its mass lowers the natural frequencies of light structures, so the measurement no longer
    describes the structure without the sensor. The effect is largest where the mode moves most (at the tip for a cantilever) and vanishes at
    nodes. A common rule is to keep the sensor mass below about a tenth of the effective mass of the part. Non-contact sensors such as the laser
    Doppler vibrometer avoid the problem entirely.
  </p>
  <MassLoading />

  <Predict question="With the accelerometer at the tip, all three modes drop by the same percentage. Move it to the middle of the beam (x/L = 0.5). Which mode is now hardly affected?">
    <p>
      Mode 3. Its shape has a node close to mid-span, so a mass placed there barely moves in that mode and adds almost nothing to its modal mass.
      Mode 2 moves a lot at mid-span and keeps a large shift; mode 1 moves only about a third as much as at the tip, so its shift becomes small.
    </p>
  </Predict>
</SensorSection>

<style>
  .eq { overflow-x: auto; }
</style>
