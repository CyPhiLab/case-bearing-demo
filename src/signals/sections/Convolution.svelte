<script lang="ts">
  import Section from '../../lib/ui/Section.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import Quiz from '../../lib/ui/Quiz.svelte';
  import ConvAnim from '../viz/ConvAnim.svelte';
</script>

<Section id="convolution" num={8} kicker="Digital filtering" title="Convolution">
  <p class="self-only">
    Each digital filter in section 7 can be written in the same form: every output sample is a weighted sum of recent
    input samples. The list of weights h[k] is the filter's <b>kernel</b> (or <i>impulse response</i>, since it is the output produced
    by a single 1 followed by zeros). Sliding the kernel along the signal and summing the products is called <b>convolution</b>.
  </p>
  <div class="eq"><Tex display math={'y[n] = \\sum_{k=0}^{M-1} h[k]\\, x[n-k] \\quad = \\quad (h * x)[n]'} /></div>
  <ConvAnim />
  <p class="self-only">
    A filter can be described by its kernel (time domain) or by its frequency response |H(f)|, the Fourier transform of the
    kernel. Smooth kernels with positive weights are low-pass. Kernels with alternating signs respond to changes and are high-pass.
    A kernel with the shape of a pattern responds most strongly to that pattern.
  </p>
  <aside class="ahead self-only">
    <b>Connection to neural networks:</b> the first layer of a convolutional neural network (CNN) performs this operation. The
    difference is that the network <i>learns</i> its kernels from data rather than having them designed.
  </aside>
  <Quiz
    question="A kernel h = [0.25, 0.5, 0.25] is applied to a signal. What kind of filter is it?"
    options={['High-pass', 'Low-pass', 'Band-stop at fs/4', 'It just delays the signal']}
    answer={1}
    explain="All weights are positive and sum to 1, so a constant passes unchanged (gain 1 at 0 Hz). At f = fs/2 the samples alternate +1, −1, +1, and 0.25 − 0.5 + 0.25 = 0, so the highest representable frequency is removed. It is a low-pass filter, a triangular moving average."
  />
</Section>

<style>
  .eq { overflow-x: auto; max-width: 100%; }
  .ahead { border-left: 4px solid var(--focus); padding: 0.5rem 0.9rem; background: var(--surface-2); border-radius: 0 8px 8px 0; margin: 1rem 0; max-width: 80ch; }
</style>
