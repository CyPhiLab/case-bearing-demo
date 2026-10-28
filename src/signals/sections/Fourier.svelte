<script lang="ts">
  import Section from '../../lib/ui/Section.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import Ref from '../../lib/ui/Ref.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Quiz from '../../lib/ui/Quiz.svelte';
  import FourierFit from '../viz/FourierFit.svelte';
  import SeriesBuilder from '../viz/SeriesBuilder.svelte';
  import NaturalFreq from '../viz/NaturalFreq.svelte';
  import DFTTable from '../viz/DFTTable.svelte';
  import Leakage from '../viz/Leakage.svelte';
</script>

<Section id="fourier" num={5} kicker="Fourier review" title="Every signal is a sum of sines">
  <p class="self-only">
    Fourier's idea: any periodic signal can be written as a constant plus sines at whole multiples of one fundamental frequency.
    We use it two ways. A <b>Fourier model</b> fits that sum to measured data, so a messy record becomes a few numbers (A₀, Cₙ, φₙ).
    The <b>Fourier transform</b> turns a signal into its <i>spectrum</i>, so you can see which frequencies it contains, such as a
    structure's natural frequencies. <Ref sec="2.4" /> <Ref sec="2.5" />
  </p>
  <div class="eq"><Tex display math={'y(t) = A_0 + \\sum_{n=1}^{K} C_n \\sin(n\\omega t + \\phi_n), \\qquad \\omega = 2\\pi f_0'} /></div>

  <h3>Fourier models: fit a model to data</h3>
  <p class="self-only">
    These are pressure readings from a pump. You don't know the pump's speed. Choose a fundamental f₀ and a number of harmonics K,
    and least squares finds the best A₀, Cₙ and φₙ. If the guessed f₀ is wrong, no number of terms will fit. Get f₀ right and two or
    three terms describe the whole record.
  </p>
  <FourierFit />

  <h3>Fourier series: building shapes from sines</h3>
  <SeriesBuilder />

  <Predict question="A square wave and a triangle wave have the same period. Which one needs more terms to look right, and why?">
    <p>
      The square wave. Its coefficients fall like 1/n, while the triangle's fall like 1/n². Sharp features need high frequencies:
      a jump needs infinitely many, a corner needs fewer, and a smooth curve needs only a few. The same rule tells you how much
      bandwidth a sensor needs to capture a fast edge.
    </p>
  </Predict>

  <h3>Fourier transform: what frequencies are in there?</h3>
  <p class="self-only">
    Real signals aren't perfectly periodic, so we let f₀ shrink to zero and the sum becomes an integral over every frequency, the
    Fourier transform. A measured, sampled record gets the <b>discrete</b> Fourier transform (DFT), computed with the FFT. A struck
    structure rings at its natural frequency, and the spectrum shows it immediately.
  </p>
  <NaturalFreq />

  <h3>The DFT step by step <span class="muted small">(book Examples 2.6–2.7)</span></h3>
  <div class="eq"><Tex display math={'Y(f_k) = \\frac{2}{N}\\sum_{r=0}^{N-1} y(r\\,\\delta t)\\, e^{-i2\\pi rk/N}, \\qquad f_k = \\frac{k}{N\\,\\delta t}'} /> <Ref eq="2.38" /></div>
  <DFTTable />

  <h3 id="leakage">Leakage and windowing</h3>
  <p class="self-only">
    The DFT only ever sees N samples, and it treats them as one period of a signal that repeats forever. When a tone completes a whole
    number of cycles in the record, the copies join seamlessly. When it doesn't, every seam has a jump, and the tone's energy
    <b>leaks</b> into many bins. A <b>window</b> (here Hann) fades the record in and out to hide the seams. Two more knobs matter: a longer
    record (bigger N) gives truly finer resolution, δf = 1/(Nδt). <b>Zero-padding</b> only interpolates the same spectrum more smoothly.
    It can't separate two tones that N samples can't.
  </p>
  <Leakage />

  <Quiz
    question="You record vibration at fs = 1000 Hz for 0.5 s. Two gear-mesh tones sit 1.5 Hz apart. Which change lets you see them as two separate peaks?"
    options={['Zero-pad the record to 8× its length', 'Apply a Hann window', 'Record for 2 s instead', 'Raise fs to 4000 Hz']}
    answer={2}
    explain="Resolution is δf = 1/(N δt) = 1/T, the inverse of the record length. 0.5 s gives 2 Hz bins, too coarse for tones 1.5 Hz apart. 2 s gives 0.5 Hz bins. Zero-padding only interpolates, a window slightly widens peaks, and a faster fs just adds more bins above the frequencies you care about."
  />
</Section>

<style>
  h3 { margin-top: 2rem; }
  .eq { display: flex; align-items: center; gap: 0.5rem; overflow-x: auto; max-width: 100%; }
</style>
