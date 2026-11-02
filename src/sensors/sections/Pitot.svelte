<script lang="ts">
  import SensorSection from '../ui/SensorSection.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import PitotManometer from '../viz/PitotManometer.svelte';
  import PitotUncertainty from '../viz/PitotUncertainty.svelte';

  const spec = {
    measures: 'Flow speed at a point (air or water)',
    principle: 'Stagnation pressure minus static pressure equals the dynamic pressure ½ρv²',
    output: 'A differential pressure, read with a manometer or pressure transducer',
    range: '~2 m/s to supersonic (with corrections)',
    sensitivity: 'Δp = 61 Pa at 10 m/s in sea-level air; rises with v²',
    bandwidth: 'Low: tubing and the transducer volume act as a low-pass filter (a few Hz to ~100 Hz)',
    watch: 'Low-speed uncertainty, density (altitude, temperature), misalignment with the flow, blocked ports (icing)',
  };
</script>

<SensorSection id="pitot" title="Pitot tubes" {spec}>
  {#snippet intro()}
    <p>
      A Pitot tube measures flow speed with pressure. The opening at its nose faces the flow and brings the air there to rest, so it senses the
      <b>total</b> (stagnation) pressure. Holes on the side sense the <b>static</b> pressure of the passing flow. By Bernoulli's equation the
      difference is the dynamic pressure:
    </p>
    <div class="eq"><Tex display math={'p_0 - p = \\tfrac{1}{2}\\rho v^2 \\quad\\Rightarrow\\quad v = \\sqrt{\\frac{2\\,(p_0 - p)}{\\rho}}'} /></div>
    <p>
      There are several types, as the slide notes: a simple Pitot tube that senses only total pressure (with static pressure taken from a wall
      tap), the combined Pitot-static (Prandtl) tube shown here, and multi-hole probes that also measure the flow direction. Every aircraft
      carries Pitot tubes for its airspeed indicator.
    </p>
  {/snippet}

  <h3>Measuring the dynamic pressure</h3>
  <p class="self-only">
    The difference between the two pressures pushes the water in the U-tube manometer up on one side. The density of air falls with altitude, so
    at the same true speed the pressure difference is smaller. An airspeed indicator calibrated for sea-level density then reads low. Pilots use
    this "indicated airspeed" anyway, because the aerodynamic forces on the wing depend on the same dynamic pressure.
  </p>
  <PitotManometer />

  <h3>Square-root response and low-speed uncertainty</h3>
  <PitotUncertainty />

  <Predict question="Doubling the flow speed multiplies the manometer reading by how much?">
    <p>Four. The pressure difference is proportional to v², so a manometer that reads about 56 mm at 30 m/s reads about 225 mm at 60 m/s.</p>
  </Predict>
</SensorSection>

<style>
  .eq { overflow-x: auto; }
</style>
