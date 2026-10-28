<script lang="ts">
  // Build classic waveforms from sines (book Ex. 2.4 square wave, Ex. 2.5 rectified sine) and watch the Gibbs ripple.
  import { onDestroy } from 'svelte';
  import LineChart from '../../lib/charts/LineChart.svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import Ref from '../../lib/ui/Ref.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import StemChart from './StemChart.svelte';
  import { exactWave, fourierSeries, linspace } from '../../lib/dsp/signals';
  import { app } from '../../lib/state.svelte';

  type Kind = 'square' | 'sawtooth' | 'triangle' | 'rectified';
  let kind = $state<Kind>('square');
  let terms = $state(3);
  const n = 1200;
  const t = linspace(n, 2 / n);
  const exact = $derived(t.map((tt) => exactWave(kind, tt)));
  const partial = $derived(t.map((tt) => fourierSeries(kind, tt, terms)));
  const lastTerm = $derived(t.map((tt) => fourierSeries(kind, tt, terms) - fourierSeries(kind, tt, terms - 1)));
  // Gibbs overshoot as a fraction of the jump (2A)
  const overshoot = $derived(kind === 'square' ? ((Math.max(...partial) - 1) / 2) * 100 : null);

  const TEX: Record<Kind, string> = {
    square: 'y(t) = \\frac{4A}{\\pi}\\sum_{n=1,3,5,\\dots}\\frac{1}{n}\\sin\\frac{2\\pi n t}{T}',
    sawtooth: 'y(t) = \\frac{2A}{\\pi}\\sum_{n=1}^{\\infty}\\frac{(-1)^{n+1}}{n}\\sin\\frac{2\\pi n t}{T}',
    triangle: 'y(t) = \\frac{8A}{\\pi^2}\\sum_{n=1,3,5,\\dots}\\frac{(-1)^{(n-1)/2}}{n^2}\\sin\\frac{2\\pi n t}{T}',
    rectified: 'y(t) = \\frac{2A}{\\pi} - \\frac{4A}{\\pi}\\sum_{n=2,4,6,\\dots}\\frac{\\cos(n\\pi t/T)}{n^2-1}',
  };
  // amplitude of each term vs its frequency in multiples of 1/T
  const stems = $derived.by(() => {
    const out: { x: number; y: number }[] = [];
    for (let k = 1; k <= terms; k++) {
      if (kind === 'square') out.push({ x: 2 * k - 1, y: 4 / (Math.PI * (2 * k - 1)) });
      else if (kind === 'sawtooth') out.push({ x: k, y: 2 / (Math.PI * k) });
      else if (kind === 'triangle') out.push({ x: 2 * k - 1, y: 8 / (Math.PI ** 2 * (2 * k - 1) ** 2) });
      else out.push({ x: k, y: 4 / (Math.PI * (4 * k * k - 1)) });
    }
    if (kind === 'rectified') out.unshift({ x: 0, y: 2 / Math.PI });
    return out;
  });

  let timer = $state<ReturnType<typeof setInterval> | null>(null);
  function animate() {
    if (timer) { clearInterval(timer); timer = null; return; }
    terms = 1;
    timer = setInterval(() => {
      if (terms >= 30) { clearInterval(timer!); timer = null; return; }
      terms++;
    }, 260);
  }
  onDestroy(() => timer && clearInterval(timer));
</script>

<div class="card">
  <div class="controls">
    <Seg
      bind:value={kind}
      label="Waveform"
      options={[
        { value: 'square', label: 'Square (Ex. 2.4)' },
        { value: 'sawtooth', label: 'Sawtooth' },
        { value: 'triangle', label: 'Triangle' },
        { value: 'rectified', label: 'Rectified sine (Ex. 2.5)' },
      ]}
    />
    <label class="control"><span>Terms <b>{terms}</b></span><input type="range" min="1" max="60" step="1" bind:value={terms} /></label>
    <button onclick={animate}>{timer ? 'Stop' : '▶ Add terms one at a time'}</button>
  </div>
  <div class="formula"><Tex display math={TEX[kind]} /> <Ref ex={kind === 'square' ? '2.4' : kind === 'rectified' ? '2.5' : undefined} sec={kind === 'square' || kind === 'rectified' ? undefined : '2.4'} /></div>
  <LineChart
    series={[
      { y: exact, dx: 2 / n, color: 'var(--text-muted)', width: 1.5, dash: [5, 4], label: 'target' },
      { y: lastTerm, dx: 2 / n, color: 'var(--cls-3)', width: 1, label: 'newest term' },
      { y: partial, dx: 2 / n, color: 'var(--accent)', width: 2.5, label: `sum of ${terms} term${terms > 1 ? 's' : ''}` },
    ]}
    xDomain={[0, 2]}
    yDomain={[-1.35, 1.35]}
    height={app.mode === 'lecture' ? 300 : 240}
    xLabel="t / T"
    yLabel="y / A"
    legend
    ariaLabel="Fourier series partial sum"
  />
  <div class="row">
    <div class="stems">
      <StemChart stems={stems} xDomain={[-0.5, Math.max(10, stems[stems.length - 1].x + 1)]} yDomain={[0, 1.4]} height={150} xLabel="harmonic n (frequency n/T)" yLabel="|coefficient| / A" ariaLabel="Harmonic amplitudes" />
    </div>
    <p class="small secondary">
      {#if kind === 'square'}
        Book Example 2.4 is this wave with A = 5 and T = 2π. Only <b>odd</b> harmonics are present, decreasing as 1/n. The discontinuities require infinitely many terms. Near each jump the partial sum overshoots by
        <b class="num">{overshoot!.toFixed(1)}%</b> of the jump. The overshoot does not vanish as terms are added (it tends to ≈9%, the <i>Gibbs phenomenon</i>);
        it only narrows toward the jump.
      {:else if kind === 'triangle'}
        Odd harmonics only, decreasing as 1/n². The wave has no discontinuities, so a few terms give a close approximation.
      {:else if kind === 'sawtooth'}
        <b>All</b> harmonics are present, decreasing as 1/n. The discontinuity in each period produces the same Gibbs overshoot as in the square wave.
      {:else}
        Book Example 2.5: a full-wave rectified 60 Hz line (|120 sin 120πt| V). It has a large DC term, 2A/π ≈ {(240 / Math.PI).toFixed(1)} V for A = 120 V, and only
        <b>even</b> multiples of the original 60 Hz (120, 240, … Hz). For this reason the ripple of a full-wave rectifier is at 120 Hz.
      {/if}
    </p>
  </div>
</div>

<style>
  .formula { display: flex; align-items: center; gap: 0.5rem; overflow-x: auto; }
  .row { display: grid; grid-template-columns: 1fr minmax(220px, 340px); gap: 1rem; align-items: center; margin-top: 0.5rem; }
  .row > * { min-width: 0; }
  @media (max-width: 760px) { .row { grid-template-columns: 1fr; } }
</style>
