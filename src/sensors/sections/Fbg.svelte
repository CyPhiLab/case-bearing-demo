<script lang="ts">
  import SensorSection from '../ui/SensorSection.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import FbgSpectrum from '../viz/FbgSpectrum.svelte';

  const spec = {
    measures: 'Strain and temperature at points along an optical fiber',
    principle: 'A periodic refractive-index pattern in the fiber core reflects one wavelength; strain and heat shift it',
    output: 'Reflected (Bragg) wavelength, read with an optical interrogator',
    range: '±5000 µε; −40 to 300 °C (standard gratings)',
    sensitivity: '≈ 1.2 pm/µε and ≈ 10 pm/°C at 1550 nm',
    bandwidth: 'DC to kHz (set by the interrogator)',
    watch: 'Temperature cross-sensitivity, bonding to the structure, cost of the interrogator',
  };
</script>

<SensorSection id="fbg" title="Fiber Bragg gratings" {spec}>
  {#snippet intro()}
    <p>
      A fiber Bragg grating (FBG) is a short section of optical fiber whose core has a periodic variation of refractive index, written with an
      ultraviolet laser. Each period reflects a tiny amount of light, and for one wavelength all the reflections add up in phase. That
      <b>Bragg wavelength</b> is reflected strongly while all others pass:
    </p>
    <div class="eq"><Tex display math={'\\lambda_B = 2\\,n_{eff}\\,\\Lambda, \\qquad \\frac{\\Delta\\lambda_B}{\\lambda_B} = (1 - p_e)\\,\\varepsilon + (\\alpha + \\xi)\\,\\Delta T'} /></div>
    <p>
      where Λ is the grating period and n<sub>eff</sub> the effective refractive index. Stretching the fiber lengthens the period, and heating it
      changes both the period and the index, so the reflected wavelength shifts. Because each grating can be written at a different wavelength,
      dozens of sensors can share one fiber and one instrument. They are immune to electromagnetic interference and are used in bridges, wind
      turbine blades, aircraft and medical devices.
    </p>
  {/snippet}

  <h3>Several sensors on one fiber</h3>
  <p class="self-only">
    Like a strain gauge, an FBG responds to temperature as well as strain: 1 °C shifts it about as much as 8 µε. The usual remedy parallels the
    dummy gauge in a strain-gauge bridge. A grating that is not bonded to the structure sees only the temperature, and its shift is subtracted
    from the others.
  </p>
  <FbgSpectrum />

  <Predict question="With no load, the temperature rises by 20 °C. Without compensation, what strain would FBG 1 appear to show?">
    <p>
      About 170 µε: 20 °C × 10.4 pm/°C = 208 pm, divided by 1.21 pm/µε. Set the strain to zero and the temperature to 20 °C, then toggle the
      compensation.
    </p>
  </Predict>
</SensorSection>

<style>
  .eq { overflow-x: auto; }
</style>
