<script lang="ts">
  import SensorSection from '../ui/SensorSection.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import SoftStretch from '../viz/SoftStretch.svelte';
  import GelSight from '../viz/GelSight.svelte';

  const spec = {
    measures: 'Stretch, bending, pressure and contact shape on soft or moving surfaces',
    principle: 'Conductive elastomers or liquid metal (resistive), elastomer capacitors, or a camera watching a gel',
    output: 'Resistance or capacitance change; images (camera-based)',
    range: 'Strains of 10–300 %',
    sensitivity: 'Gauge factor ≈ 2 for liquid-metal traces; larger but less stable for composites',
    bandwidth: 'Limited by viscoelastic relaxation of the material (Hz to tens of Hz); camera frame rate',
    watch: 'Hysteresis, drift, creep, temperature, fatigue and delamination',
  };
</script>

<SensorSection id="soft" title="Soft sensors" {spec}>
  {#snippet intro()}
    <p>
      Rigid sensors cannot follow skin, fabric or the bodies of soft robots, which stretch by tens of percent. Soft sensors are made from elastomers
      such as silicone rubber. In a <b>resistive</b> soft sensor, a channel of liquid metal or a conductive composite gets longer and thinner as the
      rubber stretches. Because the rubber keeps its volume, the resistance rises roughly with the square of the stretch ratio λ = L/L₀. In a
      <b>capacitive</b> soft sensor, two stretchable electrodes sandwich a rubber layer; stretching enlarges the electrodes and thins the layer,
      so the capacitance rises roughly in proportion to λ. A different approach, used in the GelSight sensor from the lecture, puts a camera behind
      a soft gel and measures touch from images.
    </p>
  {/snippet}

  <h3>Stretchable resistive and capacitive sensors</h3>
  <p class="self-only">
    Rubber is viscoelastic: when it is stretched, part of the deformation appears only after a delay. The sensor output therefore lags the
    stretch, and the loading and unloading curves differ (hysteresis). Conductive composites also change their internal structure with each cycle,
    so their baseline drifts. These effects, rather than sensitivity, usually limit the accuracy of soft sensors.
  </p>
  <SoftStretch />

  <h3>Touch from images</h3>
  <GelSight />

  <Predict question="A liquid-metal strain sensor is stretched to twice its length. By what factor does its resistance change?">
    <p>
      About four. The channel becomes twice as long and, since the volume is constant, its cross-section halves: R ∝ L/A grows by 2 × 2 = 4. For
      small strains this corresponds to a gauge factor of 2, the same as a metal-foil strain gauge.
    </p>
  </Predict>
</SensorSection>
