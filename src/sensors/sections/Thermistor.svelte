<script lang="ts">
  import SensorSection from '../ui/SensorSection.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import ThermistorCurves from '../viz/ThermistorCurves.svelte';
  import ThermistorDivider from '../viz/ThermistorDivider.svelte';

  const spec = {
    measures: 'Temperature',
    principle: 'Resistance of a semiconducting metal oxide falls steeply with temperature (NTC)',
    output: 'Resistance, usually read as a voltage-divider output',
    range: 'About −50 to 150 °C',
    sensitivity: '≈ −4 %/°C at 25 °C (10 kΩ, β = 3950 K)',
    bandwidth: 'τ ≈ 1–10 s for small beads in still air',
    watch: 'Strong nonlinearity, self-heating, limited range, part-to-part tolerance',
  };
</script>

<SensorSection id="thermistor" title="Thermistors" {spec}>
  {#snippet intro()}
    <p>
      A thermistor (thermal resistor) is a small bead of semiconducting metal oxide whose resistance depends strongly on temperature. The common
      negative-temperature-coefficient (NTC) type loses about 4 % of its resistance per degree near room temperature, ten times more than a
      platinum resistance thermometer, which is why the slide calls it more sensitive. The relation is exponential, usually written with a material
      constant β or with the more accurate Steinhart–Hart equation:
    </p>
    <div class="eq"><Tex display math={'R(T) = R_0\\, e^{\\beta\\left(\\frac{1}{T} - \\frac{1}{T_0}\\right)}, \\qquad \\frac{1}{T} = A + B\\ln R + C(\\ln R)^3'} /></div>
    <p>
      with temperatures in kelvin. The material only behaves this way over a limited range, roughly −50 to 150 °C, so thermistors are used in
      appliances, batteries, medical thermometers and electronics rather than furnaces.
    </p>
  {/snippet}

  <h3>Sensitivity versus range</h3>
  <ThermistorCurves />

  <h3>Reading a thermistor</h3>
  <p class="self-only">
    The simplest circuit is a voltage divider. Its output is nonlinear in temperature, but the fixed resistor can be chosen so that the S-shaped
    curve is nearly straight over the range of interest. A good choice is a little below the thermistor's resistance at the middle of the range,
    R<sub>f</sub> ≈ R(T<sub>m</sub>)(β − 2T<sub>m</sub>)/(β + 2T<sub>m</sub>) with T<sub>m</sub> in kelvin. The current through the thermistor
    also heats it above the temperature of its surroundings. Lower supply voltages and larger resistances reduce this self-heating error.
  </p>
  <ThermistorDivider />

  <Predict question="For 0 to 50 °C, which fixed resistor gives the most linear output: 1 kΩ, 7.4 kΩ or 33 kΩ?">
    <p>
      7.4 kΩ, from the rule above with R(25 °C) = 10 kΩ and β = 3950 K. The output then stays within about 1.2 °C of a straight line. With 1 kΩ or
      33 kΩ the curve bends at one end of the range and the deviation grows to about 6 °C. Try the three values.
    </p>
  </Predict>
</SensorSection>

<style>
  .eq { overflow-x: auto; }
</style>
