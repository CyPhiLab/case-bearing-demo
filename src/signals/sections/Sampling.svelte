<script lang="ts">
  import Section from '../../lib/ui/Section.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import Ref from '../../lib/ui/Ref.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Quiz from '../../lib/ui/Quiz.svelte';
  import AliasSweep from '../viz/AliasSweep.svelte';
  import AudioAlias from '../viz/AudioAlias.svelte';
  import Quantize from '../viz/Quantize.svelte';
</script>

<Section id="sampling" num={6} kicker="Sampling" title="Aliasing: when samples lie">
  <p class="self-only">
    A computer only stores samples y<sub>i</sub> = y(iδt), taken at the sample rate f<sub>s</sub> = 1/δt. Between samples it knows
    nothing. As long as the signal contains no frequency above the <b>Nyquist frequency</b> f<sub>N</sub> = f<sub>s</sub>/2, the samples
    pin it down uniquely. Put it the other way round: you must sample faster than the <b>Nyquist rate</b>, twice the highest frequency
    present. Above f<sub>N</sub>, a fast sine produces exactly the same samples as a slow one. That's <b>aliasing</b>, and once the data
    is recorded, nothing can undo it. <Ref sec="2.5" />
  </p>
  <div class="eqs">
    <div><Tex display math={'f_N = \\frac{f_s}{2}, \\qquad f_s > 2 f_{max}'} /></div>
    <div><Tex display math={'f_a = |f - k f_s| \\quad (k \\text{ so that } 0 \\le f_a \\le f_N)'} /></div>
    <div class="rule"><b>Rule of thumb:</b> f<sub>s</sub> ≈ 10 × f<sub>max</sub>, so the samples also show the <i>shape</i>, not only the frequency.</div>
  </div>
  <AliasSweep />

  <Predict question="A wagon wheel in a film (24 frames/s) has 12 spokes and spins at 2.1 rev/s. Which way does it appear to turn, and how fast?">
    <p>
      The spoke pattern repeats 12 × 2.1 = 25.2 times per second, which is just above the frame rate of 24. The apparent rate is
      25.2 − 24 = 1.2 patterns per second, or 0.1 rev/s forwards: barely creeping. A little slower, at 1.9 rev/s (22.8 patterns/s),
      gives 22.8 − 24 = −1.2, so the wheel appears to creep <i>backwards</i>. Same folding as the strip above.
    </p>
  </Predict>

  <h3>Hear it</h3>
  <p class="self-only">
    A sweep from 100 Hz to 6 kHz, resampled to a lower rate by keeping every n-th sample. Any part of the sweep above the new
    f<sub>N</sub> gets reflected back down. Turn on the anti-aliasing filter to see (and hear) the fix. Record yourself in the
    microphone lab (section 10) and your own recording shows up in this list.
  </p>
  <AudioAlias />

  <h3 id="quantization">Quantization: sampling in amplitude</h3>
  <p class="self-only">
    Sampling discretizes time. The ADC also discretizes <i>amplitude</i>: an N-bit converter can only output 2<sup>N</sup> codes, so
    every sample is rounded to the nearest level. The rounding error acts like a small added noise of RMS LSB/√12. Together the two
    steps turn an analog signal into a digital one. <Ref fig="2.3" />
  </p>
  <Quantize />

  <Quiz
    question="A machine's bearing defect shows up at 3.2 kHz, and you sample at 5 kHz with no anti-aliasing filter. Where does the defect appear in your spectrum?"
    options={['At 3.2 kHz', 'At 1.8 kHz', 'At 2.5 kHz', 'It disappears']}
    answer={1}
    explain="f_N = 2.5 kHz. 3.2 kHz is above it, so it folds: f_a = |3.2 − 5| = 1.8 kHz. The real danger is that 1.8 kHz looks like a perfectly believable vibration peak."
  />
</Section>

<style>
  h3 { margin-top: 2rem; }
  .eqs { display: flex; flex-wrap: wrap; gap: 0 2.2rem; align-items: center; margin-bottom: 0.5rem; }
  .eqs > div { overflow-x: auto; max-width: 100%; }
  .rule { font-size: 0.92rem; padding: 0.4rem 0.7rem; background: var(--surface-2); border-radius: 8px; }
</style>
