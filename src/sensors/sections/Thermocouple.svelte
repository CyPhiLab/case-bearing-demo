<script lang="ts">
  import SensorSection from '../ui/SensorSection.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import ThermocoupleCJC from '../viz/ThermocoupleCJC.svelte';
  import PlungeTest from '../viz/PlungeTest.svelte';

  const spec = {
    measures: 'Temperature difference between two junctions',
    principle: 'Seebeck effect: a temperature gradient along a conductor creates a voltage that depends on the material',
    output: 'mV-level voltage; converted with standard reference tables (NIST ITS-90)',
    range: 'Type K: −200 to 1250 °C (other types to ~1800 °C)',
    sensitivity: 'Type K ≈ 41 µV/°C',
    bandwidth: 'Set by the bead size: τ from milliseconds to tens of seconds',
    watch: 'Cold-junction temperature, nonlinearity, small signal (noise), slow response of sheathed probes',
  };
</script>

<SensorSection id="thermocouple" title="Thermocouples" {spec}>
  {#snippet intro()}
    <p>
      A thermocouple is two wires of different metals joined at the point where the temperature is measured. When a conductor has a temperature
      gradient along it, a small voltage develops between its ends (the <b>Seebeck effect</b>), and its size depends on the metal. With two different
      metals between the same two temperatures, the voltages do not cancel, and the net voltage depends on the temperature difference between the
      measuring junction and the <b>reference junction</b>, where the wires meet the copper of the instrument:
    </p>
    <div class="eq"><Tex display math={'V = E(T_{hot}) - E(T_{ref}) \\approx S\\,(T_{hot} - T_{ref})'} /></div>
    <p>
      For the common type K (chromel–alumel), the sensitivity S is about 41 µV/°C. Thermocouples are cheap, rugged and cover a very wide range,
      which makes them the standard sensor for furnaces, engines and exhausts.
    </p>
  {/snippet}

  <h3>The reference junction and the calibration curve</h3>
  <p class="self-only">
    Because the output depends on the temperature of the reference junction, it must be known. Laboratories once kept it in an ice bath at 0 °C.
    Today the instrument measures the temperature of its terminals with a separate sensor, such as a thermistor, and adds the corresponding voltage
    (<b>cold-junction compensation</b>). The relation between voltage and temperature is also not quite linear; instruments use the standard
    polynomials published by NIST.
  </p>
  <ThermocoupleCJC />

  <h3>Response time</h3>
  <p class="self-only">
    A thermocouple measures the temperature of its own junction, which has to heat up or cool down to match its surroundings. For a small bead, this
    is a first-order system with time constant τ = ρcV/(hA) = ρcd/(6h), set by the bead size and the heat-transfer coefficient h of the medium.
  </p>
  <PlungeTest />

  <Predict question="A type K thermocouple measures 300 °C with its terminals at 25 °C, but the instrument has no cold-junction compensation. What does it read?">
    <p>
      About 275 °C. The meter sees E(300) − E(25) and converts it as if the reference were at 0 °C, so the reading is low by roughly the
      terminal temperature. Uncheck the compensation box to see it.
    </p>
  </Predict>
</SensorSection>

<style>
  .eq { overflow-x: auto; }
</style>
