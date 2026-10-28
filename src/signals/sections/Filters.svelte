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

<Section id="filters" num={7} kicker="Filters" title="Filters: keep what you want, remove what you don't">
  <p class="self-only">
    A filter removes unwanted frequency content, such as high-frequency noise, slow drift, or a 60 Hz hum, and passes the rest.
    Filters come in two forms:
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
        Resistors, capacitors and op-amps acting on the voltage <i>before</i> it is digitized. This one RC circuit is a first-order
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
        Arithmetic on the samples <i>after</i> the ADC. It's exactly repeatable and easy to change, and offline it can even run
        backwards to cancel lag (zero-phase). Every filter on this page is digital, a few lines of code like these.
      </p>
    </div>
  </div>

  <h3>Classifications</h3>
  <p class="self-only">
    Filters are named by what they <b>pass</b>. The <b>cutoff frequency</b> f<sub>c</sub> marks the edge of the passband. The
    <b>roll-off</b> is how fast the gain falls beyond it.
  </p>
  <FilterTypes />

  <h3>The simplest filter: a moving average</h3>
  <p class="self-only">
    Replace each sample with the average of the last M samples. Random noise partly cancels out, while slow changes survive: a
    low-pass filter. The exponential version weights recent samples more heavily. <Ref fig="2.22" />
  </p>
  <MovingAvg />

  <Predict question="You double the moving-average window M. What happens to the noise, the lag and the first null frequency?">
    <p>
      The noise drops by about another √2, the lag doubles (to about (M−1)/2 samples), and the first null moves down to half the
      frequency, f<sub>s</sub>/M. A moving average gives you one knob, and it trades smoothing directly against lag and lost detail.
      A Butterworth filter lets you choose the cutoff and the steepness separately.
    </p>
  </Predict>

  <h3>Butterworth filters</h3>
  <div class="eq"><Tex display math={'|G(\\omega)| = \\frac{1}{\\sqrt{1 + (\\omega/\\omega_c)^{2n}}}'} /> <span class="small secondary">n = order (controls the roll-off), ω<sub>c</sub> = cutoff</span></div>
  <ButterBode />

  <h3 id="filter-lab">Filter lab</h3>
  <p class="self-only">
    Run any signal on the page through any filter: the slide 5 signal, the hum example, the sweep, or something you recorded in
    the microphone or phone labs. The blue curve is the filter's gain, drawn over the signal's spectrum. Wherever it dips, that
    part of the spectrum is removed.
  </p>
  <FilterLab />

  <Quiz
    question="You need to remove 60 Hz hum from a strain-gauge signal whose useful content runs from 0 to 200 Hz. Which filter do you choose?"
    options={['A low-pass at 50 Hz', 'A high-pass at 70 Hz', 'A narrow band-stop (notch) around 60 Hz', 'A moving average with M = fs/60']}
    answer={2}
    explain="Your signal overlaps 60 Hz on both sides, so a low-pass or high-pass would remove real content. A narrow band-stop takes out only the hum. (A moving average with M = fs/60 does put a null at 60 Hz, but it also rolls off everything above a few Hz.)"
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
