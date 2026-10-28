<script lang="ts">
  import Section from '../../lib/ui/Section.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import Ref from '../../lib/ui/Ref.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Quiz from '../../lib/ui/Quiz.svelte';
  import FilterTypes from '../viz/FilterTypes.svelte';
  import MovingAvg from '../viz/MovingAvg.svelte';
  import ButterBode from '../viz/ButterBode.svelte';
  import FilterLab from '../viz/FilterLab.svelte';
</script>

<Section id="filters" num={7} kicker="Signal conditioning" title="Filters">
  <p class="self-only">
    A filter removes unwanted frequency content, such as high-frequency noise, slow drift or 60 Hz hum, and passes the rest.
    Filters are either analog or digital:
  </p>
  <div class="ad">
    <div class="card">
      <svg viewBox="0 0 220 80" class="rc" aria-label="RC low-pass circuit">
        <path d="M10 25 H55 l5 -8 l10 16 l10 -16 l10 16 l10 -16 l5 8 H170" class="w" />
        <path d="M140 25 V45 M128 45 H152 M128 53 H152 M140 53 V70 M10 70 H210" class="w" />
        <circle cx="10" cy="25" r="3" class="n" /><circle cx="170" cy="25" r="3" class="n" />
        <text x="78" y="12" class="lbl">R</text><text x="158" y="52" class="lbl">C</text>
        <text x="4" y="42" class="lbl s">in</text><text x="176" y="29" class="lbl s">out</text>
      </svg>
      <b>Analog</b>
      <p class="small secondary">
        Resistors, capacitors and op-amps acting on the voltage <i>before</i> it is digitized. A single RC stage is a first-order
        (n = 1) Butterworth low-pass with f<sub>c</sub> = 1/(2πRC). Only an analog filter can prevent aliasing, because it acts before
        sampling.
      </p>
    </div>
    <div class="card">
      <pre class="code">for n in range(N):
    y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2]
         - a1*y[n-1] - a2*y[n-2]</pre>
      <b>Digital</b>
      <p class="small secondary">
        Arithmetic on the samples <i>after</i> the ADC. It is exactly repeatable and easy to change, and offline it can be run
        forwards and backwards to cancel the lag (zero-phase). All filters on this page are digital.
      </p>
    </div>
  </div>

  <h3>Filter classifications</h3>
  <p class="self-only">
    Filters are named by the band they <b>pass</b>. The <b>cutoff frequency</b> f<sub>c</sub> marks the edge of the passband. The
    <b>roll-off</b> is how fast the gain falls beyond it.
  </p>
  <FilterTypes />

  <h3>Moving-average filters</h3>
  <p class="self-only">
    Each sample is replaced by the average of the last M samples. Random noise partly cancels, while slow variations are preserved, so
    the moving average is a low-pass filter. The exponential version weights recent samples more heavily. <Ref fig="2.22" />
  </p>
  <MovingAvg />

  <Predict question="You double the moving-average window M. What happens to the noise, the lag and the first null frequency?">
    <p>
      The noise decreases by a further factor of about √2, the lag doubles (it is about (M−1)/2 samples), and the first null moves to
      half the frequency, f<sub>s</sub>/M. A moving average has a single parameter, which trades smoothing against lag and loss of
      detail. A Butterworth filter allows the cutoff and the steepness to be chosen separately.
    </p>
  </Predict>

  <h3>Butterworth filters</h3>
  <p class="self-only">
    The Butterworth filter is the most common general-purpose design. Its magnitude response is as flat as possible in the passband,
    with no ripple, and falls smoothly through −3 dB at the cutoff frequency. Beyond the cutoff the gain decreases by 20n dB per decade,
    where the order n is the number of energy-storage elements (capacitors and inductors) in an analog implementation, or the number
    of poles in a digital one. A higher order gives a sharper transition but more phase shift and a longer delay. The same low-pass
    prototype is transformed to make high-pass, band-pass and band-stop versions.
  </p>
  <div class="eq"><Tex display math={'|G(\\omega)| = \\frac{1}{\\sqrt{1 + (\\omega/\\omega_c)^{2n}}}'} /> <span class="small secondary">n = order (controls the roll-off), ω<sub>c</sub> = cutoff</span></div>
  <ButterBode />

  <h3 id="filter-lab">Filter lab</h3>
  <p class="self-only">
    Any signal on the page can be filtered here: the slide 5 signal, the hum example, the sweep, or a recording from the microphone
    or phone labs. The blue curve is the filter gain, drawn over the signal spectrum. Where the gain is low, that part of the spectrum
    is attenuated.
  </p>
  <FilterLab />

  <Quiz
    question="You need to remove 60 Hz hum from a strain-gauge signal whose useful content runs from 0 to 200 Hz. Which filter do you choose?"
    options={['A low-pass at 50 Hz', 'A high-pass at 70 Hz', 'A narrow band-stop (notch) around 60 Hz', 'A moving average with M = fs/60']}
    answer={2}
    explain="The signal content extends on both sides of 60 Hz, so a low-pass or high-pass filter would remove part of it. A narrow band-stop takes out only the hum. (A moving average with M = fs/60 does put a null at 60 Hz, but it also rolls off everything above a few Hz.)"
  />
</Section>

<style>
  h3 { margin-top: 2rem; }
  .ad { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.5rem; }
  .ad > * { min-width: 0; }
  .rc { width: 100%; max-width: 260px; height: 80px; display: block; }
  .w { fill: none; stroke: var(--text-secondary); stroke-width: 2; stroke-linejoin: round; }
  .n { fill: var(--accent); }
  .lbl { font-size: 13px; fill: var(--text-primary); font-style: italic; }
  .lbl.s { font-size: 11px; font-style: normal; fill: var(--text-muted); }
  .code { font-family: var(--mono); font-size: 0.78rem; background: var(--surface-2); padding: 0.5rem 0.7rem; border-radius: 8px; overflow-x: auto; margin: 0 0 0.4rem; }
  .eq { display: flex; align-items: center; flex-wrap: wrap; gap: 0.3rem 1rem; overflow-x: auto; max-width: 100%; }
  @media (max-width: 700px) { .ad { grid-template-columns: 1fr; } }
</style>
