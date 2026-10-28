<script lang="ts">
  const TOPICS = [
    { id: 'signal', t: 'What is a signal?' },
    { id: 'classes', t: 'Static vs dynamic' },
    { id: 'noise', t: 'Noise vs interference' },
    { id: 'rms', t: 'Mean, RMS & power' },
    { id: 'fourier', t: 'Fourier models & transform' },
    { id: 'sampling', t: 'Sampling, aliasing, quantization' },
    { id: 'filters', t: 'Filters' },
    { id: 'convolution', t: 'Convolution' },
    { id: 'averaging', t: 'Averaging, SNR & dB' },
    { id: 'mic', t: 'Microphone lab' },
    { id: 'phone', t: 'Phone accelerometer lab' },
  ];
</script>

<div id="top" class="hero">
  <div class="kicker">Measurements · Signals &amp; Data</div>
  <h1>Signals and Data</h1>
  <p class="lede">
    Interactive notes for the Signals &amp; Data lecture. Every measurement produces a signal, a quantity that varies in time. Interpreting
    it requires knowing how the signal is described, what is noise, what is lost when it is sampled, and what a filter does to it. Each
    topic from the lecture has an interactive figure. The last two sections use the microphone in a laptop and the accelerometer in a
    phone as measurement systems.
  </p>
  <ol class="topics">
    {#each TOPICS as tp, i}
      <li><a href="#{tp.id}"><span class="n">{i + 1}</span>{tp.t}</a></li>
    {/each}
  </ol>
  <div class="how self-only">
    <div>
      <b>How to use this page.</b> All figures are interactive. Purple <span class="tag p">Predict</span>
      boxes ask you to commit to a guess first. Blue <span class="tag c">Check</span> boxes are quick self-tests. Small <span class="refchip">F&amp;B Eq. 2.6</span>
      tags point to the matching place in Figliola &amp; Beasley, ch. 2.
    </div>
    <div class="muted small">
      For teaching, switch to <b>Lecture</b> mode (top right) for big type and visuals only. PageDown/PageUp (or a presentation clicker)
      steps through sections. You can also link directly to it with <code>?mode=lecture</code>.
    </div>
  </div>
</div>

<style>
  .hero { max-width: var(--content); margin: 0 auto; padding: 4rem 1.25rem 3rem; }
  .kicker { font-size: 0.8rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent-ink); margin-bottom: 0.6rem; }
  h1 { font-size: clamp(2.1rem, 5vw, 3.6rem); letter-spacing: -0.02em; margin-bottom: 1rem; }
    .lede { font-size: 1.15rem; color: var(--text-secondary); max-width: 68ch; }
  .topics { list-style: none; padding: 0; margin: 2rem 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 0.5rem; }
  .topics a { display: flex; gap: 0.5rem; align-items: baseline; padding: 0.55rem 0.75rem; border-radius: var(--radius); background: var(--surface-1); border: 1px solid var(--grid); color: var(--text-primary); text-decoration: none; font-weight: 600; font-size: 0.92rem; }
  .topics a:hover { border-color: var(--accent); }
  .n { font-family: var(--mono); font-size: 0.75rem; color: var(--accent-ink); }
  .how { display: grid; gap: 0.4rem; padding: 0.9rem 1rem; border-radius: var(--radius); background: var(--surface-2); font-size: 0.9rem; max-width: 92ch; }
  .tag { font-size: 0.68rem; text-transform: uppercase; color: #fff; padding: 0.05em 0.45em; border-radius: 4px; letter-spacing: 0.05em; }
  .tag.p { background: var(--focus); }
  .tag.c { background: var(--accent); }
  .refchip { font-size: 0.68rem; font-weight: 600; color: var(--text-muted); border: 1px solid var(--axis); border-radius: 4px; padding: 0 0.35em; }
</style>
