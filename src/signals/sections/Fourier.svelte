<script lang="ts">
  import Section from '../../lib/ui/Section.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import Ref from '../../lib/ui/Ref.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Quiz from '../../lib/ui/Quiz.svelte';
  import FourierFit from '../viz/FourierFit.svelte';
  import SeriesBuilder from '../viz/SeriesBuilder.svelte';
  import NaturalFreq from '../viz/NaturalFreq.svelte';
  import BeamModes from '../viz/BeamModes.svelte';
  import DFTTable from '../viz/DFTTable.svelte';
  import Leakage from '../viz/Leakage.svelte';
</script>

<Section id="fourier" num={5} kicker="Fourier review" title="Fourier analysis">
  <p class="self-only">
    Any periodic signal can be written as a constant plus sines at whole multiples of one fundamental frequency.
    This is used in two ways. A <b>Fourier model</b> fits that sum to measured data, so that a record is described by a few coefficients (A₀, Cₙ, φₙ).
    The <b>Fourier transform</b> turns a signal into its <i>spectrum</i>, which shows the frequencies it contains, such as the natural
    frequencies of a structure. <Ref sec="2.4" /> <Ref sec="2.5" />
  </p>
  <div class="eq"><Tex display math={'y(t) = A_0 + \\sum_{n=1}^{K} C_n \\sin(n\\omega t + \\phi_n), \\qquad \\omega = 2\\pi f_0'} /></div>

  <h3>Fourier models</h3>
  <p class="self-only">
    The data are pressure readings from a pump running at an unknown speed. For a chosen fundamental f₀ and number of harmonics K, a
    least-squares fit gives A₀, Cₙ and φₙ. With an incorrect f₀, no number of terms gives a good fit. With the correct f₀, two or three
    terms describe the record.
  </p>
  <FourierFit />

  <h3>Fourier series</h3>
  <p class="self-only">
    A periodic signal with period T can be written as a <b>Fourier series</b>: its mean value plus cosine and sine terms at the
    fundamental frequency f₀ = 1/T and its integer multiples, the <b>harmonics</b>. Each coefficient is found by integrating the signal
    against the corresponding cosine or sine over one period. If the signal is an odd function, y(−t) = −y(t), only sine terms remain.
    If it is even, y(−t) = y(t), only cosine terms remain. In practice the series is truncated, and the <i>partial sum</i> of the first
    few terms approximates the waveform. <Ref eq="2.17, 2.18" />
  </p>
  <div class="eq"><Tex display math={'y(t) = A_0 + \\sum_{n=1}^{\\infty}\\left(A_n \\cos n\\omega t + B_n \\sin n\\omega t\\right)'} /></div>
  <div class="eq"><Tex display math={'A_0 = \\frac{1}{T}\\int_{-T/2}^{T/2} y(t)\\,dt, \\qquad A_n = \\frac{2}{T}\\int_{-T/2}^{T/2} y(t)\\cos n\\omega t\\,dt, \\qquad B_n = \\frac{2}{T}\\int_{-T/2}^{T/2} y(t)\\sin n\\omega t\\,dt'} /></div>
  <p class="self-only small secondary">The amplitude of harmonic n is C<sub>n</sub> = √(A<sub>n</sub>² + B<sub>n</sub>²), the quantity plotted in the stem chart below. <Ref eq="2.21" /></p>
  <SeriesBuilder />

  <Predict question="A square wave and a triangle wave have the same period. Which one needs more terms to look right, and why?">
    <p>
      The square wave. Its coefficients decrease as 1/n, while those of the triangle wave decrease as 1/n². Sharp features require
      high frequencies: a discontinuity requires infinitely many terms, a corner fewer, and a smooth curve only a few. The same reasoning
      determines the bandwidth a sensor needs to capture a fast edge.
    </p>
  </Predict>

  <h3>Fourier transform and natural frequencies</h3>
  <p class="self-only">
    Measured signals are generally not periodic. Letting f₀ tend to zero turns the sum into an integral over all frequencies, the
    Fourier transform. A sampled record is analyzed with the <b>discrete</b> Fourier transform (DFT), computed with the FFT. A struck
    single-degree-of-freedom system vibrates at its natural frequency, which appears as a peak in the spectrum.
  </p>
  <NaturalFreq />

  <h3>Example: modes of a cantilever beam</h3>
  <p class="self-only">
    A continuous structure has many natural frequencies, one for each mode of vibration. An impact excites several modes at once, and
    the measured response is their sum. The Fourier transform separates them into individual peaks.
  </p>
  <BeamModes />

  <h3>The discrete Fourier transform <span class="muted small">(book Examples 2.6–2.7)</span></h3>
  <p class="self-only">
    A measured record is a finite set of N samples y(rδt), r = 0 … N−1, taken at intervals δt. The DFT converts these N samples into
    amplitudes at N/2 discrete frequencies f<sub>k</sub> = k/(Nδt), from 0 up to the Nyquist frequency 1/(2δt). The spacing between
    frequencies, the <b>frequency resolution</b> δf = 1/(Nδt), is the inverse of the record length. With the 2/N scaling used here, a
    sine of amplitude C that falls exactly on a frequency f<sub>k</sub> appears as a single line of height C. The FFT is an efficient
    algorithm for computing the DFT.
  </p>
  <div class="eq"><Tex display math={'Y(f_k) = \\frac{2}{N}\\sum_{r=0}^{N-1} y(r\\,\\delta t)\\, e^{-i2\\pi rk/N}, \\qquad f_k = \\frac{k}{N\\,\\delta t}'} /> <Ref eq="2.38" /></div>
  <DFTTable />

  <h3 id="leakage">Leakage and windowing</h3>
  <p class="self-only">
    The DFT uses N samples and treats them as one period of a signal that repeats indefinitely. When a tone completes a whole number
    of cycles in the record, the repeated copies join continuously. Otherwise there is a discontinuity at each joint, and the energy of
    the tone <b>leaks</b> into many bins. A <b>window</b> (here Hann) tapers the record to zero at both ends to remove the
    discontinuities. A longer record (larger N) gives finer resolution, δf = 1/(Nδt). <b>Zero-padding</b> only interpolates the same
    spectrum; it cannot separate two tones that the N samples do not resolve.
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
