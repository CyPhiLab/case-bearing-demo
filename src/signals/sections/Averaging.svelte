<script lang="ts">
  import Section from '../../lib/ui/Section.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Quiz from '../../lib/ui/Quiz.svelte';
  import DbScale from '../viz/DbScale.svelte';
  import Ensemble from '../viz/Ensemble.svelte';
  import WelchDemo from '../viz/WelchDemo.svelte';
</script>

<Section id="averaging" num={9} kicker="Noise reduction" title="Averaging, SNR and decibels">
  <p class="self-only">
    Signal levels span large ranges: a microphone responds to both a whisper and a jet engine, and a spectrum can contain lines a
    million times weaker than its peak. Levels are therefore compared as <b>ratios</b> on a logarithmic scale, in <b>decibels</b>. The
    most important ratio is the <b>signal-to-noise ratio</b>.
  </p>
  <div class="eqs">
    <Tex display math={'L = 20\\log_{10}\\frac{A_1}{A_2} = 10\\log_{10}\\frac{P_1}{P_2}\\ \\text{dB}'} />
    <Tex display math={'\\text{SNR} = 20\\log_{10}\\frac{\\text{signal}_{\\text{rms}}}{\\text{noise}_{\\text{rms}}}\\ \\text{dB}'} />
  </div>
  <DbScale />

  <h3>Ensemble averaging</h3>
  <p class="self-only">
    If a measurement can be repeated, for example by striking a structure with a hammer and triggering on the impact, every record
    contains the same response plus <i>different</i> noise. Averaging N records leaves the response untouched and divides the noise RMS by √N.
  </p>
  <div class="eqs"><Tex display math={'\\sigma_{\\bar y} = \\frac{\\sigma}{\\sqrt N} \\quad\\Rightarrow\\quad \\Delta\\text{SNR} = 10\\log_{10}N\\ \\text{dB}'} /></div>
  <Ensemble />

  <Predict question="Your averaged response still looks too noisy after 16 records. How many records do you need to halve the remaining noise?">
    <p>64. Halving the noise requires √N to double, so N must increase by a factor of 4. Halving it again requires 256. For this
      reason averaging is usually combined with better sensors, shielding and filtering.</p>
  </Predict>

  <h3>Welch's method</h3>
  <p class="self-only">
    A single long FFT of a noisy signal has a noise floor that fluctuates randomly, and a longer record does not reduce the
    fluctuation; it only adds bins. Welch's method divides the record into overlapping segments, windows each one, and
    <b>averages their spectra</b>, which reduces the fluctuation in each bin. It is the default spectral estimate in most analysis software.
  </p>
  <WelchDemo />

  <Quiz
    question="An amplifier raises a signal from 2 mV to 2 V RMS. What is its gain in dB?"
    options={['30 dB', '60 dB', '1000 dB', '3 dB']}
    answer={1}
    explain="The amplitude ratio is 2 V / 2 mV = 1000, and 20 log₁₀(1000) = 60 dB. The power ratio is 10⁶, and 10 log₁₀(10⁶) gives the same 60 dB. The result in decibels is the same for either ratio."
  />
</Section>

<style>
  h3 { margin-top: 2rem; }
  .eqs { display: flex; flex-wrap: wrap; gap: 0 2.5rem; overflow-x: auto; max-width: 100%; }
</style>
