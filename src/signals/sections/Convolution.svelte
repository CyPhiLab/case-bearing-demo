<script lang="ts">
  import Section from '../../lib/ui/Section.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import Quiz from '../../lib/ui/Quiz.svelte';
  import ConvAnim from '../viz/ConvAnim.svelte';
</script>

<Section id="convolution" num={8} kicker="Under the hood" title="Convolution = filtering">
  <p class="self-only">
    Every filter in section 7 that works on samples can be written the same way: each output sample is a weighted sum of recent
    input samples. The list of weights h[k] is the filter's <b>kernel</b> (or <i>impulse response</i>, since it's the output you get
    from a single 1 followed by zeros). Sliding the kernel along the signal and summing products is called <b>convolution</b>.
  </p>
  <div class="eq"><Tex display math={'y[n] = \\sum_{k=0}^{M-1} h[k]\\, x[n-k] \\quad = \\quad (h * x)[n]'} /></div>
  <ConvAnim />
  <p class="self-only">
    Two views of one filter: the kernel (time domain) and its frequency response |H(f)|, which is just the kernel's Fourier
    transform. Smooth, all-positive kernels are low-pass. Kernels with alternating signs respond to change and are high-pass.
    A kernel shaped like a pattern detects that pattern.
  </p>
  <aside class="ahead self-only">
    <b>Looking ahead:</b> the first layer of a convolutional neural network (CNN) is exactly this operation. The difference is that
    the network <i>learns</i> its kernels from data instead of having an engineer design them.
  </aside>
  <Quiz
    question="A kernel h = [0.25, 0.5, 0.25] is applied to a signal. What kind of filter is it?"
    options={['High-pass', 'Low-pass', 'Band-stop at fs/4', 'It just delays the signal']}
    answer={1}
    explain="All weights are positive and sum to 1, so a constant passes unchanged (gain 1 at 0 Hz). At f = fs/2 the samples alternate +1, −1, +1, and 0.25 − 0.5 + 0.25 = 0, so the fastest possible signal is removed completely. It's a smooth low-pass, a triangular moving average."
  />
</Section>

<style>
  .eq { overflow-x: auto; max-width: 100%; }
  .ahead { border-left: 4px solid var(--focus); padding: 0.5rem 0.9rem; background: var(--surface-2); border-radius: 0 8px 8px 0; margin: 1rem 0; max-width: 80ch; }
</style>
