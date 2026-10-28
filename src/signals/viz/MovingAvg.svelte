<script lang="ts">
  // Slide 11: simple vs exponential moving average. Easy, low-pass, but it lags and loses fast content.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import { ema, emaResponse, movingAverage, movingAverageResponse } from '../../lib/dsp/filters';
  import { gaussian, linspace, rms } from '../../lib/dsp/signals';
  import { app } from '../../lib/state.svelte';

  const fs = 20;
  const T = 12;
  const t = linspace(T * fs, 1 / fs);
  const tStep = 5;
  const truth = t.map((tt) => 20 + (tt >= tStep ? 4 : 0) + (tt > 8 ? 1.5 * Math.sin(2 * Math.PI * 0.6 * (tt - 8)) : 0));
  const noise = gaussian(t.length, 0.7, 21);
  const raw = truth.map((v, i) => v + noise[i]);
  let M = $state(14);
  const sma = $derived(movingAverage(raw, M));
  const em = $derived(ema(raw, M));
  // 3–5 s: flat, and past the start-up of the widest window
  const quiet = (y: ArrayLike<number>) => rms(Array.from({ length: 40 }, (_, i) => y[60 + i] - truth[60 + i]));
  const lag = (y: ArrayLike<number>) => {
    for (let i = tStep * fs; i < t.length; i++) if (y[i] >= 22) return t[i] - tStep;
    return NaN;
  };
  const freqs = linspace(400, fs / 2 / 399);
  const hS = $derived(movingAverageResponse(M, freqs, fs));
  const hE = $derived(emaResponse(M, freqs, fs));
</script>

<div class="card">
  <div class="top">
    <div class="eq"><Tex display math={'y[n] = \\frac{1}{M}\\sum_{k=0}^{M-1} x[n-k]'} /><span class="small muted">simple (SMA)</span></div>
    <div class="eq"><Tex display math={'y[n] = \\alpha x[n] + (1-\\alpha)\\,y[n-1], \\quad \\alpha = \\tfrac{2}{M+1}'} /><span class="small muted">exponential (EMA)</span></div>
    <label class="control"><span>Window M <b>{M}</b> samples ({(M / fs).toFixed(2)} s)</span><input type="range" min="1" max="60" step="1" bind:value={M} /></label>
  </div>
  <LineChart
    series={[
      { y: raw, dx: 1 / fs, color: 'var(--text-muted)', width: 1, label: 'raw' },
      { y: truth, dx: 1 / fs, color: 'var(--text-secondary)', width: 1.2, dash: [4, 4], label: 'true' },
      { y: sma, dx: 1 / fs, color: 'var(--accent)', width: 2.5, label: `SMA(${M})` },
      { y: em, dx: 1 / fs, color: 'var(--cls-2)', width: 2.5, label: `EMA(${M})` },
    ]}
    height={app.mode === 'lecture' ? 300 : 250}
    xLabel="t (s)"
    yLabel="temperature (°C)"
    legend
    markers={[{ x: tStep, label: 'step', color: 'var(--axis)', dash: true }]}
    ariaLabel="Simple and exponential moving averages"
  />
  <div class="cols">
    <table class="num">
      <thead><tr><th></th><th>noise left (RMS)</th><th>lag to reach 50% of step</th></tr></thead>
      <tbody>
        <tr><td>raw</td><td>{quiet(raw).toFixed(2)} °C</td><td>0 s</td></tr>
        <tr><td class="s">SMA</td><td>{quiet(sma).toFixed(2)} °C</td><td>{lag(sma).toFixed(2)} s <span class="muted">(theory (M−1)/2·δt = {(((M - 1) / 2) / fs).toFixed(2)} s)</span></td></tr>
        <tr><td class="e">EMA</td><td>{quiet(em).toFixed(2)} °C</td><td>{lag(em).toFixed(2)} s</td></tr>
      </tbody>
    </table>
    <LineChart
      series={[
        { x: freqs, y: hS, color: 'var(--accent)', width: 2, label: 'SMA' },
        { x: freqs, y: hE, color: 'var(--cls-2)', width: 2, label: 'EMA' },
      ]}
      xDomain={[0, fs / 2]}
      yDomain={[0, 1.05]}
      height={150}
      xLabel="frequency (Hz)"
      yLabel="|G|"
      legend
      markers={M > 1 && fs / M < fs / 2 ? [{ x: fs / M, label: 'first null fs/M', color: 'var(--axis)', dash: true }] : []}
      ariaLabel="Moving average frequency responses"
    />
  </div>
  <p class="small secondary">
    <b>Pros:</b> simple to compute, and it reduces noise (by about √M for the SMA). <b>Cons:</b> it also rounds off the step and attenuates
    the 0.6 Hz oscillation after t = 8 s (loss of high-frequency content), and the output <b>lags</b> the true signal. The EMA responds
    faster initially but has a long tail, and its frequency response never reaches zero. The SMA response has nulls at multiples of
    f<sub>s</sub>/M, with sidelobes that pass some high-frequency content.
  </p>
</div>

<style>
  .top { display: flex; flex-wrap: wrap; gap: 0.5rem 2rem; align-items: center; }
  .eq { display: flex; align-items: center; gap: 0.5rem; overflow-x: auto; max-width: 100%; }
  .cols { display: grid; grid-template-columns: minmax(260px, 1fr) 1fr; gap: 1rem; align-items: center; margin-top: 0.5rem; }
  .cols > * { min-width: 0; }
  table { border-collapse: collapse; font-size: 0.85rem; }
  th, td { padding: 0.25rem 0.5rem; text-align: left; border-bottom: 1px solid var(--grid); }
  th { color: var(--text-muted); font-weight: 600; }
  td.s { color: var(--accent); font-weight: 700; }
  td.e { color: var(--cls-2); font-weight: 700; }
  @media (max-width: 800px) { .cols { grid-template-columns: 1fr; } }
</style>
