<script lang="ts">
  // "Fourier models: fit models to data". Least-squares fit of A0 + Σ C_n sin(2πn f0 t + φ_n) to noisy samples.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import StemChart from './StemChart.svelte';
  import { fitFourier, gaussian, linspace, rms } from '../../lib/dsp/signals';
  import { app } from '../../lib/state.svelte';

  const fs = 100;
  const T = 2;
  const t = linspace(T * fs, 1 / fs);
  // a "pump pressure" record whose period the student doesn't know: f0 = 2.5 Hz, three harmonics
  const TRUE = { f0: 2.5, A0: 1.2, C: [1, 0.45, 0.25], phi: [0, 0.8, 2.1] };
  let sigma = $state(0.15);
  let seed = $state(4);
  const noise = $derived(gaussian(t.length, sigma, seed));
  const data = $derived(t.map((tt, i) => TRUE.A0 + TRUE.C.reduce((s, c, n) => s + c * Math.sin(2 * Math.PI * (n + 1) * TRUE.f0 * tt + TRUE.phi[n]), 0) + noise[i]));

  let f0 = $state(1.5);
  let K = $state(1);
  const fit = $derived(fitFourier(t, data, f0, K));
  const resid = $derived(data.map((v, i) => v - fit.fitted[i]));
  const dense = linspace(800, T / 800);
  const curve = $derived(dense.map((tt) => fit.A0 + fit.C.reduce((s, c, n) => s + c * Math.sin(2 * Math.PI * (n + 1) * f0 * tt + fit.phi[n]), 0)));

  function search() {
    // scan f0 and keep the best R²: the "model selection" step done by brute force
    let best = f0, bestR = -Infinity;
    for (let f = 0.5; f <= 5.0001; f += 0.01) {
      const r = fitFourier(t, data, f, Math.max(K, 1)).r2;
      if (r > bestR) { bestR = r; best = f; }
    }
    f0 = Math.round(best * 100) / 100;
  }
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Guess f₀ <b>{f0.toFixed(2)} Hz</b></span><input type="range" min="0.5" max="5" step="0.01" bind:value={f0} /></label>
    <label class="control"><span>Terms K <b>{K}</b></span><input type="range" min="0" max="8" step="1" bind:value={K} /></label>
    <label class="control"><span>Measurement noise σ <b>{sigma.toFixed(2)}</b></span><input type="range" min="0" max="0.6" step="0.01" bind:value={sigma} /></label>
    <button onclick={search}>Search f₀ for best R²</button>
    <button onclick={() => seed++}>New data</button>
  </div>
  <LineChart
    series={[
      { y: data, dx: 1 / fs, color: 'var(--text-muted)', width: 0.8, label: 'data' },
      { y: curve, dx: T / 800, color: 'var(--cls-2)', width: 2.5, label: `model, K = ${K}` },
    ]}
        xDomain={[0, T]}
    yDomain={[-1.5, 3.5]}
    height={app.mode === 'lecture' ? 280 : 220}
    xLabel="t (s)"
    yLabel="pressure (kPa)"
    legend
    ariaLabel="Data and Fourier model"
  >
    {#snippet overlay({ x, y })}
      {#each data as v, i}
        <circle cx={x(t[i])} cy={y(v)} r="2" class="pt" />
      {/each}
    {/snippet}
  </LineChart>
  <div class="row3">
    <div class="stat"><span class="value num" class:good={fit.r2 > 0.9}>{fit.r2.toFixed(3)}</span><span class="label">R² (1 = perfect fit)</span></div>
    <div class="stat"><span class="value num">{rms(resid).toFixed(3)}</span><span class="label">RMS residual (noise σ = {sigma.toFixed(2)})</span></div>
    <div class="stat"><span class="value num">{fit.A0.toFixed(2)}</span><span class="label">A₀ (mean)</span></div>
    <div class="stems">
      <StemChart
        stems={fit.C.map((c, n) => ({ x: (n + 1) * f0, y: c, label: c.toFixed(2) }))}
        xDomain={[0, Math.max(8, (K + 1) * f0)]}
        yDomain={[0, 1.3]}
        height={140}
        xLabel="frequency nf₀ (Hz)"
        yLabel="Cₙ"
        ariaLabel="Fitted amplitudes"
      />
    </div>
  </div>
</div>

<style>
  .pt { fill: var(--text-secondary); opacity: 0.5; }
  .row3 { display: grid; grid-template-columns: repeat(3, minmax(90px, 140px)) 1fr; gap: 1rem; align-items: center; margin-top: 0.5rem; }
  .row3 > * { min-width: 0; }
  .good { color: var(--good); }
  @media (max-width: 760px) { .row3 { grid-template-columns: repeat(3, 1fr); } .stems { grid-column: 1 / -1; } }
</style>
