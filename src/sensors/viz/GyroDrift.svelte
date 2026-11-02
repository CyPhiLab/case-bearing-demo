<script lang="ts">
  // Integrating a gyroscope: a constant bias makes the angle error grow linearly, noise makes it wander (random walk).
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { gaussian } from '../../lib/dsp/signals';
  import { integrate } from '../lib/physics';
  import { app } from '../../lib/state.svelte';

  const fs = 50, T = 60, n = fs * T;
  const t = Float64Array.from({ length: n }, (_, i) => i / fs);
  // true motion: turn 90° at 3 s, turn back at 30 s
  const smooth = (s: number, a: number, w: number) => Math.min(1, Math.max(0, (s - a) / w));
  const ease = (u: number) => u * u * (3 - 2 * u);
  const truth = t.map((s) => 90 * (ease(smooth(s, 3, 3)) - ease(smooth(s, 30, 3))));
  const rate = truth.map((v, i) => (i ? (v - truth[i - 1]) * fs : 0));
  let bias = $state(0.5); // °/s
  let sigma = $state(1); // °/s per sample
  let seed = $state(1);
  const meas = $derived.by(() => {
    const g = gaussian(n, sigma, seed);
    return rate.map((r, i) => r + bias + g[i]);
  });
  const angle = $derived(integrate(meas, 1 / fs));
  const err = $derived(angle[n - 1] - truth[n - 1]);
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Gyro bias <b>{bias.toFixed(2)} °/s</b></span><input type="range" min="0" max="1" step="0.01" bind:value={bias} /></label>
    <label class="control"><span>Gyro noise <b>{sigma.toFixed(1)} °/s rms</b></span><input type="range" min="0" max="5" step="0.1" bind:value={sigma} /></label>
    <button onclick={() => seed++}>New run</button>
  </div>
  <LineChart
    series={[
      { y: truth, dx: 1 / fs, color: 'var(--text-muted)', width: 2, label: 'true angle', dash: [5, 3] },
      { y: angle, dx: 1 / fs, color: 'var(--accent)', width: 2, label: 'integrated gyro rate' },
    ]}
    xDomain={[0, T]}
    yDomain={[-30, 150]}
    height={app.mode === 'lecture' ? 260 : 220}
    xLabel="time (s)"
    yLabel="angle (°)"
    legend
    ariaLabel="Angle from an integrated gyroscope"
  />
  <p class="small secondary">
    Angle error after {T} s: <b class="num">{err.toFixed(1)}°</b>. A bias b alone gives b·t = {(bias * T).toFixed(0)}°. Noise adds a random walk
    that grows with √t. Consumer MEMS gyros have biases of order 0.1–1 °/s that change with temperature; navigation-grade gyros reach 0.01 °/h.
  </p>
</div>
