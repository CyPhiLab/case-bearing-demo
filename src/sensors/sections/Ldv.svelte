<script lang="ts">
  import SensorSection from '../ui/SensorSection.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import LdvDoppler from '../viz/LdvDoppler.svelte';
  import ScanningLdv from '../viz/ScanningLdv.svelte';

  const spec = {
    measures: 'Surface velocity along the laser beam (and, integrated, displacement)',
    principle: 'Doppler shift of reflected laser light, detected by interference with a reference beam',
    output: 'Voltage proportional to velocity (e.g. 1–1000 mm/s per V)',
    range: 'µm/s to ~10 m/s',
    sensitivity: 'Resolution down to ~0.01 µm/s/√Hz',
    bandwidth: 'DC to several MHz',
    watch: 'Speckle dropouts on rough surfaces, line-of-sight only, motion of the instrument itself, cost',
  };
</script>

<SensorSection id="ldv" title="Laser Doppler vibrometers" {spec}>
  {#snippet intro()}
    <p>
      A laser Doppler vibrometer (LDV) points a laser at a vibrating surface. Light reflected from a moving surface comes back with its frequency
      shifted by the Doppler effect:
    </p>
    <div class="eq"><Tex display math={'f_D = \\frac{2v}{\\lambda}'} /></div>
    <p>
      where <i>v</i> is the surface velocity along the beam and λ the wavelength. The shift is tiny compared with the frequency of light, so the
      instrument mixes the returned light with a reference beam in an interferometer. The two beams interfere and produce a beat at f<sub>D</sub>,
      which a photodetector can measure. LDVs are widely used for vibration analysis because they do not touch the structure: no mass loading,
      no mounting, and the beam can be scanned over a surface.
    </p>
  {/snippet}

  <h3>From Doppler shift to velocity</h3>
  <LdvDoppler />

  <h3>Scanning a structure</h3>
  <ScanningLdv />

  <Predict question="A surface vibrates at 1 kHz with a peak velocity of 10 mm/s. What is its displacement amplitude?">
    <p>
      X = V/ω = 0.01/(2π · 1000) ≈ 1.6 µm. The LDV measures it through about 8X/λ ≈ 20 fringes per cycle. An accelerometer would see a peak
      acceleration of Vω ≈ 63 m/s² (6.4 g).
    </p>
  </Predict>
</SensorSection>

<style>
  .eq { overflow-x: auto; }
</style>
