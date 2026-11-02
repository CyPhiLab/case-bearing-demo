<script lang="ts">
  import SensorSection from '../ui/SensorSection.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import MagCal from '../viz/MagCal.svelte';
  import AnomalySurvey from '../viz/AnomalySurvey.svelte';

  const spec = {
    measures: 'Magnetic field vector (three axes)',
    principle: 'Hall effect, anisotropic magnetoresistance (AMR), fluxgate, or optically pumped atoms for surveys',
    output: 'Field in µT or nT per axis',
    range: '±4900 µT (phone chips); Earth field is 25–65 µT',
    sensitivity: '0.1–0.3 µT per count (phone); 0.01–0.1 nT (survey instruments)',
    bandwidth: 'Tens to hundreds of Hz',
    watch: 'Hard-iron offsets from magnets, soft-iron distortion from steel, currents in nearby wires',
  };
</script>

<SensorSection id="magnetometer" {spec}>
  {#snippet intro()}
    <p>
      A magnetometer measures the strength and direction of the magnetic field. The Earth's field is about 50 µT; in the northern United States
      it points north and steeply downward. A three-axis magnetometer in a phone measures the components of this field in the phone's own
      coordinates. With the phone held flat, the two horizontal components give the compass heading:
    </p>
    <div class="eq"><Tex display math={'\\psi = \\operatorname{atan2}(-B_y,\\; B_x)'} /></div>
    <p>
      Phone and drone magnetometers use the Hall effect or magnetoresistance. Survey instruments, like the ones NOAA tows behind ships to find
      wrecks, use more sensitive principles and resolve changes of a fraction of a nanotesla.
    </p>
  {/snippet}

  <h3>Heading and calibration</h3>
  <p class="self-only">
    The sensor measures every field at its location, not only the Earth's. Magnets and magnetized steel nearby add a constant offset, called
    <b>hard-iron</b> error. Unmagnetized steel bends the field lines and stretches the response along some directions, called <b>soft-iron</b>
    error. Rotating the sensor through a full turn should trace a circle centered on the origin. With these errors it traces an offset ellipse,
    and the heading can be wrong by tens of degrees. This is why phones ask to be waved in a figure eight. The readings collected during the
    motion are used to find the center and the scale of the ellipse and to correct later readings.
  </p>
  <MagCal />

  <h3>Finding buried iron</h3>
  <p class="self-only">
    An iron object becomes magnetized by the Earth's field and adds a small field of its own, which falls off with the cube of the distance. A
    magnetometer towed along survey lines records the total field. A buried object shows up as a local bump, an anomaly, of a few to a few
    thousand nanotesla on top of the steady 50 000 nT background.
  </p>
  <AnomalySurvey />

  <Predict question="The cannon gives a peak anomaly of about 180 nT when the magnetometer passes 15 m above it. What would it give at 30 m?">
    <p>
      About 22 nT. The dipole field falls off as 1/r³, so doubling the distance divides the anomaly by 8. Check it with the depth slider.
    </p>
  </Predict>
</SensorSection>

<style>
  .eq { overflow-x: auto; }
</style>
