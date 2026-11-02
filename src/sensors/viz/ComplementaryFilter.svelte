<script lang="ts">
  // Fusing a gyroscope and an accelerometer to estimate tilt. The accelerometer gives an absolute but noisy angle
  // that is wrong whenever the sensor also accelerates; the integrated gyro is smooth but drifts. The complementary
  // filter takes the high frequencies from the gyro and the low frequencies from the accelerometer.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { gaussian } from '../../lib/dsp/signals';
  import { complementaryFilter, integrate } from '../lib/physics';
  import { app } from '../../lib/state.svelte';

  const fs = 100, T = 30, n = fs * T, dt = 1 / fs;
  const t = Float64Array.from({ length: n }, (_, i) => i * dt);
  const ramp = (s: number, a: number, w: number) => {
    const u = Math.min(1, Math.max(0, (s - a) / w));
    return u * u * (3 - 2 * u);
  };
  const truth = t.map((s) => 30 * ramp(s, 3, 2) - 20 * ramp(s, 10, 1.5) + 10 * ramp(s, 22, 2));
  const shaking = (s: number) => (s > 14 && s < 19 ? 1 : 0);
  let bias = $state(0.5); // °/s
  let accNoise = $state(2); // °
  let shake = $state(15); // ° of apparent tilt from linear acceleration while shaking
  let alpha = $state(0.98);
  const g = gaussian(n, 1, 11);
  const g2 = gaussian(n, 1, 12);
  const accAngle = $derived(t.map((s, i) => truth[i] + accNoise * g[i] + shake * shaking(s) * Math.sin(2 * Math.PI * 3 * s)));
  const gyroRate = $derived(truth.map((v, i) => (i ? (v - truth[i - 1]) * fs : 0) + bias + 0.3 * g2[i]));
  const gyroAngle = $derived(integrate(gyroRate, dt));
  const fused = $derived(complementaryFilter(gyroRate, accAngle, dt, alpha, 0));
  const rmsErr = (x: ArrayLike<number>) => Math.sqrt(Array.from(x).reduce((s, v, i) => s + (v - truth[i]) ** 2, 0) / n);
  const fc = $derived((1 - alpha) / (2 * Math.PI * alpha * dt));
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Filter weight α <b>{alpha.toFixed(3)}</b> (crossover {fc < 1 ? fc.toFixed(2) : fc.toFixed(1)} Hz)</span><input type="range" min="0.8" max="0.999" step="0.001" bind:value={alpha} /></label>
    <label class="control"><span>Gyro bias <b>{bias.toFixed(1)} °/s</b></span><input type="range" min="0" max="2" step="0.1" bind:value={bias} /></label>
    <label class="control"><span>Accelerometer noise <b>{accNoise.toFixed(1)}°</b></span><input type="range" min="0" max="6" step="0.1" bind:value={accNoise} /></label>
    <label class="control"><span>Shaking (14–19 s) <b>{shake}°</b></span><input type="range" min="0" max="30" step="1" bind:value={shake} /></label>
  </div>
  <LineChart
    series={[
      { y: accAngle, dx: dt, color: 'var(--axis)', width: 1, label: 'accelerometer tilt' },
      { y: gyroAngle, dx: dt, color: 'var(--cls-2)', width: 1.8, label: 'integrated gyro' },
      { y: fused, dx: dt, color: 'var(--accent)', width: 2.2, label: 'complementary filter' },
      { y: truth, dx: dt, color: 'var(--text-primary)', width: 1.4, label: 'true tilt', dash: [5, 4] },
    ]}
    xDomain={[0, T]}
    yDomain={[-30, 70]}
    height={app.mode === 'lecture' ? 300 : 250}
    xLabel="time (s)"
    yLabel="tilt (°)"
    legend
    ariaLabel="Tilt estimates"
  />
  <div class="stats">
    <div class="stat"><span class="value num">{rmsErr(accAngle).toFixed(1)}°</span><span class="label">rms error, accelerometer only</span></div>
    <div class="stat"><span class="value num">{rmsErr(gyroAngle).toFixed(1)}°</span><span class="label">rms error, gyro only</span></div>
    <div class="stat"><span class="value num">{rmsErr(fused).toFixed(1)}°</span><span class="label">rms error, fused</span></div>
  </div>
</div>

<style>
  .stats { display: flex; flex-wrap: wrap; gap: 0.6rem 2rem; margin-top: 0.6rem; }
</style>
