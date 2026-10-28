<script lang="ts">
  // Synchronous (ensemble) averaging: repeat a triggered measurement N times; noise falls by √N.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { gaussian, linspace, rms } from '../../lib/dsp/signals';
  import { app } from '../../lib/state.svelte';

  const fs = 1000;
  const L = 400;
  const t = linspace(L, 1 / fs);
  // the repeatable response to a tap (two damped modes), much smaller than the noise
  const truth = t.map((tt) => (tt < 0.05 ? 0 : 0.5 * Math.exp(-(tt - 0.05) * 18) * Math.sin(2 * Math.PI * 35 * (tt - 0.05)) + 0.2 * Math.exp(-(tt - 0.05) * 30) * Math.sin(2 * Math.PI * 90 * (tt - 0.05))));
  let sigma = $state(0.4);
  const Ns = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
  let ni = $state(0);
  const N = $derived(Ns[ni]);
  const MAXN = 512;
  const noise = $derived(Array.from({ length: MAXN }, (_, r) => gaussian(L, sigma, 100 + r)));
  const avgOf = (n: number) => {
    const a = new Float64Array(L);
    for (let r = 0; r < n; r++) for (let i = 0; i < L; i++) a[i] += noise[r][i];
    return a.map((v, i) => truth[i] + v / n);
  };
  const avg = $derived(avgOf(N));
  const single = $derived(t.map((_, i) => truth[i] + noise[0][i]));
  const snrOf = (y: ArrayLike<number>) => 20 * Math.log10(rms(truth) / rms(Float64Array.from(y, (v, i) => v - truth[i])));
  const snr1 = $derived(snrOf(single));
  const snrN = $derived(snrOf(avg));
  const curve = $derived(Ns.map((n) => snrOf(avgOf(n)) - snr1));
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Records averaged N <b>{N}</b></span><input type="range" min="0" max={Ns.length - 1} step="1" bind:value={ni} /></label>
    <label class="control"><span>Noise σ <b>{sigma.toFixed(2)}</b></span><input type="range" min="0.1" max="2" step="0.05" bind:value={sigma} /></label>
  </div>
  <LineChart
    series={[
      { y: single, dx: 1 / fs, color: 'var(--text-muted)', width: 0.8, label: 'one record' },
      { y: truth, dx: 1 / fs, color: 'var(--text-secondary)', width: 1.2, dash: [4, 4], label: 'true response' },
      { y: avg, dx: 1 / fs, color: 'var(--accent)', width: 2, label: `average of ${N}` },
    ]}
    height={app.mode === 'lecture' ? 300 : 240}
    xLabel="time after trigger (s)"
    yLabel="acceleration (g)"
    legend
    ariaLabel="Ensemble average"
  />
  <div class="cols">
    <div class="stats">
      <div class="stat"><span class="value num">{snr1.toFixed(1)} dB</span><span class="label">SNR of one record</span></div>
      <div class="stat"><span class="value num">{snrN.toFixed(1)} dB</span><span class="label">SNR after averaging {N}</span></div>
      <div class="stat"><span class="value num">+{(snrN - snr1).toFixed(1)} dB</span><span class="label">gain; theory 10 log₁₀N = +{(10 * Math.log10(N)).toFixed(1)} dB (noise ÷ √N = {Math.sqrt(N).toFixed(1)})</span></div>
    </div>
    <LineChart
      series={[
        { x: Ns, y: Ns.map((n) => 10 * Math.log10(n)), color: 'var(--text-muted)', width: 1.5, dash: [5, 4], label: 'theory √N' },
        { x: Ns, y: curve, color: 'var(--accent)', width: 2.5, label: 'measured' },
      ]}
      logX
      xDomain={[1, 512]}
      yDomain={[-1, 30]}
      height={170}
      xLabel="N (log scale)"
      yLabel="SNR gain (dB)"
      legend
      markers={[{ x: N, color: 'var(--cls-2)', dash: true }]}
      ariaLabel="SNR gain versus N"
    />
  </div>
  <p class="small secondary">
    Averaging works because the noise is <b>random</b> while the response is <b>synchronized</b> to the trigger. It's the same in every
    record. Doubling N buys only 3 dB, so the returns diminish quickly. Interference that is <i>also</i> locked to the trigger is never
    averaged away.
  </p>
</div>

<style>
  .cols { display: grid; grid-template-columns: minmax(220px, 320px) 1fr; gap: 1rem; align-items: center; margin-top: 0.5rem; }
  .cols > * { min-width: 0; }
  .stats { display: grid; gap: 0.5rem; }
  @media (max-width: 760px) { .cols { grid-template-columns: 1fr; } }
</style>
