<script lang="ts">
  // Position from double integration of acceleration: a constant bias gives an error ½ b t².
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { gaussian } from '../../lib/dsp/signals';
  import { deadReckonError, integrate } from '../lib/physics';
  import { app } from '../../lib/state.svelte';

  const fs = 100, T = 60, n = fs * T;
  let biasMg = $state(1);
  let noiseMg = $state(5);
  let seed = $state(1);
  const b = $derived(biasMg * 1e-3 * 9.81);
  const pos = $derived.by(() => {
    const g = gaussian(n, noiseMg * 1e-3 * 9.81, seed);
    const a = g.map((v) => v + b);
    return integrate(integrate(a, 1 / fs), 1 / fs).map(Math.abs);
  });
  const theory = $derived(Array.from({ length: n }, (_, i) => deadReckonError(b, i / fs)));
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Accelerometer bias <b>{biasMg.toFixed(1)} mg</b></span><input type="range" min="0" max="10" step="0.1" bind:value={biasMg} /></label>
    <label class="control"><span>Accelerometer noise <b>{noiseMg} mg rms</b></span><input type="range" min="0" max="30" step="1" bind:value={noiseMg} /></label>
    <button onclick={() => seed++}>New run</button>
  </div>
  <LineChart
    series={[
      { y: pos, dx: 1 / fs, color: 'var(--accent)', width: 2, label: 'position error (simulated)' },
      { y: theory, dx: 1 / fs, color: 'var(--text-muted)', width: 1.4, label: '½ b t²', dash: [5, 3] },
    ]}
    logY
    xDomain={[0, T]}
    yDomain={[1e-4, 1e3]}
    height={app.mode === 'lecture' ? 240 : 200}
    xLabel="time (s)"
    yLabel="position error (m)"
    legend
    ariaLabel="Dead-reckoning position error"
  />
  <p class="small secondary">
    After 10 s: <b class="num">{deadReckonError(b, 10).toFixed(2)} m</b>; after 60 s: <b class="num">{deadReckonError(b, 60).toFixed(1)} m</b> from the bias
    alone. A bias of 1 mg is typical for a good MEMS accelerometer after calibration. This is why phones and cars combine inertial sensors with GPS,
    wheel speed or cameras instead of navigating on the accelerometer alone.
  </p>
</div>
