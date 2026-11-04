<script lang="ts">
  // The complementary filter in the frequency domain: a low-pass on the accelerometer angle plus a high-pass on the
  // gyro angle, with the same crossover. The two magnitudes trade places around f_c.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { complementaryCrossover, complementaryResponse } from '../lib/fusion';
  import { app } from '../../lib/state.svelte';

  const fs = 100, dt = 1 / fs;
  let alpha = $state(0.98);
  const fsx = Array.from({ length: 300 }, (_, i) => 10 ** (-3 + (i / 299) * 4.69)); // up to fs/2
  const resp = $derived(fsx.map((f) => complementaryResponse(f, alpha, dt)));
  const fc = $derived(complementaryCrossover(alpha, dt));
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Filter weight α <b>{alpha.toFixed(3)}</b></span><input type="range" min="0.8" max="0.999" step="0.001" bind:value={alpha} /></label>
    <span class="small secondary">crossover f<sub>c</sub> = (1 − α)/(2π α δt) = <b class="num">{fc < 1 ? fc.toFixed(3) : fc.toFixed(2)} Hz</b> at {fs} Hz sampling, time constant τ = <b class="num">{(1 / (2 * Math.PI * fc)).toFixed(2)} s</b></span>
  </div>
  <LineChart
    series={[
      { x: fsx, y: resp.map((r) => r.lp), color: 'var(--text-secondary)', width: 2.2, label: 'accelerometer path (low-pass)' },
      { x: fsx, y: resp.map((r) => r.hp), color: 'var(--cls-2)', width: 2.2, label: 'gyro path (high-pass)' },
    ]}
    logX
    xDomain={[0.001, 50]}
    yDomain={[0, 1.1]}
    height={app.mode === 'lecture' ? 230 : 190}
    xLabel="frequency of the motion (Hz)"
    yLabel="gain"
    legend
    markers={[{ x: fc, label: 'f_c', color: 'var(--text-muted)', dash: true }]}
    ariaLabel="Complementary filter frequency response"
  />
</div>
