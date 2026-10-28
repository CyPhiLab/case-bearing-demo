<script lang="ts">
  // Slide 12: |G(ω)| = 1/√(1 + (ω/ωc)^{2n}) for different orders, on the slide's dB / log-ω axes.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import { butterworthMag, toDb } from '../../lib/dsp/filters';
  import { app } from '../../lib/state.svelte';

  let n = $state(3);
  let scale = $state<'db' | 'lin'>('db');
  const w = Float64Array.from({ length: 400 }, (_, i) => 10 ** (-1 + (2 * i) / 399));
  const ys = (k: number) => w.map((v) => (scale === 'db' ? toDb(butterworthMag(v, 1, k)) : butterworthMag(v, 1, k)));
  const others = $derived([1, 2, 3, 4, 5].filter((k) => k !== n).map((k) => ({ x: w, y: ys(k), color: 'var(--axis)', width: 1, label: '' })));
  const at = (r: number) => toDb(butterworthMag(r, 1, n));
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Order n <b>{n}</b></span><input type="range" min="1" max="8" step="1" bind:value={n} /></label>
    <Seg bind:value={scale} label="Magnitude scale" options={[{ value: 'db', label: 'dB' }, { value: 'lin', label: 'linear' }]} />
  </div>
  <div class="cols">
    <LineChart
      series={[...others, { x: w, y: ys(n), color: 'var(--accent)', width: 3, label: `n = ${n}` }]}
      logX
      xDomain={[0.1, 10]}
      yDomain={scale === 'db' ? [-80, 5] : [0, 1.08]}
      height={app.mode === 'lecture' ? 300 : 240}
      xLabel="ω / ω_c (log scale)"
      yLabel={scale === 'db' ? '20 log₁₀|G| (dB)' : '|G|'}
      markers={[{ x: 1, label: 'ω_c', color: 'var(--cls-2)', dash: true }]}
      ariaLabel="Butterworth magnitude responses"
    >
      {#snippet overlay({ x, y })}
        {@const v = scale === 'db' ? -3.01 : Math.SQRT1_2}
        <line x1={x(0.1)} x2={x(10)} y1={y(v)} y2={y(v)} class="m3" />
        <text x={x(0.1) + 4} y={y(v) + 14} class="m3t">{scale === 'db' ? '−3 dB' : '1/√2 ≈ 0.707'}: every order passes through here at ω_c</text>
      {/snippet}
    </LineChart>
    <div class="stats">
      <div class="stat"><span class="value num">{at(2).toFixed(1)} dB</span><span class="label">at 2 ω_c (one octave up)</span></div>
      <div class="stat"><span class="value num">{at(10).toFixed(1)} dB</span><span class="label">at 10 ω_c (one decade up)</span></div>
      <div class="stat"><span class="value num">−{20 * n} dB/decade</span><span class="label">roll-off = −20n dB/decade (−{6 * n} dB/octave)</span></div>
      <p class="small secondary">Butterworth filters are <i>maximally flat</i>: no ripple in the passband. Raising n gives a sharper edge, at the cost of more components (analog) or more computation and more phase lag (digital).</p>
    </div>
  </div>
</div>

<style>
  .cols { display: grid; grid-template-columns: 1fr minmax(200px, 270px); gap: 1rem; align-items: start; }
  .cols > * { min-width: 0; }
  .stats { display: grid; gap: 0.6rem; }
  .m3 { stroke: var(--cls-2); stroke-dasharray: 3 3; }
  .m3t { font-size: var(--chart-font); fill: var(--text-secondary); paint-order: stroke; stroke: var(--surface-1); stroke-width: 3px; }
  @media (max-width: 800px) { .cols { grid-template-columns: 1fr; } }
</style>
