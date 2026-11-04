<script lang="ts">
  // A two-state Kalman filter (angle and gyro bias) on simulated data, compared with the complementary filter.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { gaussian } from '../../lib/dsp/signals';
  import { TiltKalman, complementaryFilter } from '../lib/fusion';
  import { app } from '../../lib/state.svelte';

  const fs = 100, T = 40, n = fs * T, dt = 1 / fs;
  const t = Float64Array.from({ length: n }, (_, i) => i * dt);
  const ease = (s: number, a: number, w: number) => {
    const u = Math.min(1, Math.max(0, (s - a) / w));
    return u * u * (3 - 2 * u);
  };
  const truth = t.map((s) => 30 * ease(s, 4, 2) - 45 * ease(s, 14, 2) + 25 * ease(s, 30, 1.5));
  const trueBias = t.map((s) => (s < 22 ? 1.5 : -0.8));
  const shake = (s: number) => (s > 17 && s < 21 ? 12 * Math.sin(2 * Math.PI * 3 * s) : 0);
  let sigA = $state(3); // accelerometer angle noise, °
  let logR = $state(Math.log10(9));
  let logQb = $state(Math.log10(0.003));
  const R = $derived(10 ** logR);
  const Qb = $derived(10 ** logQb);
  const ga = gaussian(n, 1, 31), gg = gaussian(n, 1, 32);
  const acc = $derived(t.map((s, i) => truth[i] + sigA * ga[i] + shake(s)));
  const rate = truth.map((v, i) => (i ? (v - truth[i - 1]) * fs : 0) + trueBias[i] + 0.3 * gg[i]);
  const run = $derived.by(() => {
    const k = new TiltKalman(0.001, Qb, R);
    k.reset(acc[0], 0);
    const th = new Float64Array(n), b = new Float64Array(n), K = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      k.step(rate[i], acc[i], dt);
      th[i] = k.theta;
      b[i] = k.bias;
      K[i] = k.gain;
    }
    return { th, b, K };
  });
  const comp = $derived(complementaryFilter(rate, acc, dt, 0.98, acc[0]));
  const rms = (x: ArrayLike<number>) => Math.sqrt(Array.from(x).reduce((s, v, i) => s + (v - truth[i]) ** 2, 0) / n);
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Accelerometer noise (true) <b>{sigA.toFixed(1)}°</b></span><input type="range" min="0.5" max="8" step="0.1" bind:value={sigA} /></label>
    <label class="control"><span>Filter's measurement variance R <b>{R < 1 ? R.toFixed(2) : R.toFixed(0)} deg²</b> (σ = {Math.sqrt(R).toFixed(1)}°)</span><input type="range" min="-1" max="3" step="0.01" bind:value={logR} /></label>
    <label class="control"><span>Filter's bias process noise Q_b <b>{Qb.toExponential(0)}</b></span><input type="range" min="-6" max="0" step="0.01" bind:value={logQb} /></label>
  </div>
  <LineChart
    series={[
      { y: acc, dx: dt, color: 'var(--axis)', width: 1, label: 'accelerometer' },
      { y: comp, dx: dt, color: 'var(--cls-3)', width: 1.6, label: 'complementary (α = 0.98)' },
      { y: run.th, dx: dt, color: 'var(--accent)', width: 2.2, label: 'Kalman' },
      { y: truth, dx: dt, color: 'var(--text-primary)', width: 1.4, dash: [5, 4], label: 'true' },
    ]}
    xDomain={[0, T]}
    yDomain={[-40, 60]}
    height={app.mode === 'lecture' ? 270 : 230}
    xLabel="time (s); shaking 17–21 s, gyro bias changes at 22 s"
    yLabel="tilt (°)"
    legend
    ariaLabel="Kalman and complementary filter estimates"
  />
  <div class="grid-2">
    <LineChart
      series={[
        { y: trueBias, dx: dt, color: 'var(--text-primary)', width: 1.4, dash: [5, 4], label: 'true gyro bias' },
        { y: run.b, dx: dt, color: 'var(--cls-2)', width: 2, label: 'Kalman estimate' },
      ]}
      xDomain={[0, T]}
      yDomain={[-2.5, 2.5]}
      height={app.mode === 'lecture' ? 200 : 170}
      xLabel="time (s)"
      yLabel="bias (°/s)"
      legend
      ariaLabel="Gyro bias estimate"
    />
    <LineChart
      series={[{ y: run.K, dx: dt, color: 'var(--focus)', width: 2 }]}
      logY
      xDomain={[0, T]}
      yDomain={[1e-4, 1]}
      height={app.mode === 'lecture' ? 200 : 170}
      xLabel="time (s)"
      yLabel="Kalman gain K"
      ariaLabel="Kalman gain over time"
    />
  </div>
  <div class="stats">
    <div class="stat"><span class="value num">{rms(acc).toFixed(1)}°</span><span class="label">rms error, accelerometer</span></div>
    <div class="stat"><span class="value num">{rms(comp).toFixed(1)}°</span><span class="label">rms error, complementary</span></div>
    <div class="stat"><span class="value num">{rms(run.th).toFixed(1)}°</span><span class="label">rms error, Kalman</span></div>
  </div>
</div>

<style>
  .stats { display: flex; flex-wrap: wrap; gap: 0.6rem 2rem; margin-top: 0.6rem; }
</style>
