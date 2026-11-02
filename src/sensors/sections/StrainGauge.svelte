<script lang="ts">
  import SensorSection from '../ui/SensorSection.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import GaugeBeam from '../viz/GaugeBeam.svelte';
  import BridgeBuilder from '../viz/BridgeBuilder.svelte';

  const spec = {
    measures: 'Surface strain (and, through calibration, force, pressure, torque)',
    principle: 'Resistance of a bonded foil grid changes as it stretches',
    output: 'ΔR/R, read as mV/V from a Wheatstone bridge',
    range: '±3000 µε for foil gauges (up to ~5 % for special gauges)',
    sensitivity: 'GF ≈ 2.0 (foil); 120 or 350 Ω',
    bandwidth: 'DC to tens of kHz; limited by the amplifier',
    watch: 'Temperature, lead resistance, poor bonding, creep, transverse strain',
  };
</script>

<SensorSection id="strain-gauge" {spec}>
  {#snippet intro()}
    <p>
      A strain gauge is a thin metal-foil grid on a plastic backing, glued to the surface of a part. When the surface stretches, the grid
      becomes longer and thinner and its resistance rises. The fractional change is proportional to the strain:
    </p>
    <div class="eq"><Tex display math={'\\frac{\\Delta R}{R} = GF \\cdot \\varepsilon'} /></div>
    <p>
      The gauge factor <i>GF</i> is about 2 for metal foil. Strains in machine parts are small, typically less than 0.1 % (1000 µε), so a 350 Ω
      gauge changes by less than 1 Ω. Measuring such a change directly is impractical. Instead, the gauge is placed in a Wheatstone bridge, which
      outputs a voltage proportional to the change.
    </p>
  {/snippet}

  <h3>Strain in a loaded cantilever</h3>
  <p class="self-only">
    Bending stretches the top surface and compresses the bottom one by the same amount. The strain is largest at the clamp and falls linearly to
    zero at the tip, so gauges are placed near the root. The aluminum beam bends about three times as much as the steel one under the same load,
    because its modulus is about a third.
  </p>
  <GaugeBeam />

  <h3>The Wheatstone bridge</h3>
  <p class="self-only">
    The bridge has four arms. When all four resistances are equal, the output is zero. A change in any arm unbalances it. For small changes:
  </p>
  <div class="eq self-only"><Tex display math={'\\frac{V_{out}}{V_{ex}} \\approx \\frac{1}{4}\\left(\\frac{\\Delta R_1}{R} - \\frac{\\Delta R_2}{R} + \\frac{\\Delta R_3}{R} - \\frac{\\Delta R_4}{R}\\right)'} /></div>
  <p class="self-only">
    Adjacent arms subtract and opposite arms add. This is what makes bridges useful beyond simple measurement. Two gauges in adjacent arms that
    see the same temperature change cancel each other's temperature error. A gauge on the top surface and one on the bottom, in adjacent arms,
    double the bending signal and cancel axial strain, because axial strain stretches both surfaces equally.
  </p>
  <dl class="defs self-only">
    <dt>Quarter bridge</dt>
    <dd>One active gauge, three fixed resistors. Output GF·ε/4. Any temperature change of the gauge appears as strain.</dd>
    <dt>Quarter + dummy</dt>
    <dd>A second, unstrained gauge on the same material in the adjacent arm. Same output, but the temperature effect cancels.</dd>
    <dt>Half bridge</dt>
    <dd>Gauges on the top and bottom surfaces in adjacent arms. Output GF·ε/2, temperature compensated, axial strain rejected.</dd>
    <dt>Full bridge</dt>
    <dd>Four active gauges. Output GF·ε, the largest signal, with the same compensation. Load cells and force sensors use full bridges.</dd>
  </dl>
  <BridgeBuilder />
  <p class="self-only small secondary">
    The temperature effect is modeled as an apparent strain of 10 µε/°C, typical of a gauge not matched to the material. Self-temperature-
    compensated gauges reduce it to about 1 µε/°C over a limited range, but bridge compensation is still standard. With poor adhesion, only part
    of the strain reaches the grid, and the glue line slowly relaxes (creep) under constant load.
  </p>

  <Predict question="A quarter bridge on an unloaded beam reads 200 µε after the lab warms by 20 °C. What would a half bridge on the same beam read?">
    <p>
      Zero. Both gauges of the half bridge are on the same beam and warm by the same amount. They sit in adjacent arms, so their resistance
      changes subtract. Set the bending and axial strain to zero, ΔT to 20 °C, and switch between configurations to confirm.
    </p>
  </Predict>
</SensorSection>

<style>
  .eq { overflow-x: auto; }
</style>
