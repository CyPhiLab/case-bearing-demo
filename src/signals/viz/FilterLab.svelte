<script lang="ts">
  // The filter lab: any clip on the page through a Butterworth, moving-average or exponential filter.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import { clips, request } from '../lib/clips.svelte';
  import { playClip, stop } from '../lib/listen';
  import { butter, ema, emaResponse, movingAverage, movingAverageResponse, sosfilt, sosfiltfilt, sosResponse, toDb, type FilterType } from '../../lib/dsp/filters';
  import { welch } from '../../lib/dsp/signals';
  import { app } from '../../lib/state.svelte';

  type Family = 'butter' | 'sma' | 'ema';
  let clipId = $state('hum');
  const clip = $derived(clips.find((c) => c.id === clipId) ?? clips[0]);
  $effect(() => {
    if (request.filter) {
      clipId = request.filter;
      request.filter = '';
    }
  });
  let family = $state<Family>('butter');
  let type = $state<FilterType>('lowpass');
  let order = $state(4);
  let M = $state(10);
  let phase = $state<'causal' | 'zero'>('causal');
  const zeroPhase = $derived(phase === 'zero');
  const fN = $derived(clip.fs / 2);
  const fmin = $derived(fN / 1000);
  // cutoffs live on a log slider u ∈ [0, 1]
  let u1 = $state(0.6);
  let u2 = $state(0.75);
  const fromU = (u: number) => fmin * (0.98 * fN / fmin) ** u;
  const f1 = $derived(fromU(Math.min(u1, u2 - 0.01)));
  const f2 = $derived(fromU(Math.max(u2, u1 + 0.01)));
  const band = $derived(type === 'bandpass' || type === 'bandstop');

  const sos = $derived(family === 'butter' ? butter(type, order, band ? [f1, f2] : f1, clip.fs) : null);
  const rev = (x: ArrayLike<number>) => Float64Array.from(x).reverse();
  const run = (x: ArrayLike<number>): Float64Array => {
    if (sos) return zeroPhase ? sosfiltfilt(sos, x) : sosfilt(sos, x);
    const f = (v: ArrayLike<number>) => (family === 'sma' ? movingAverage(v, M) : ema(v, M));
    return zeroPhase ? rev(f(rev(f(x)))) : f(x);
  };
  const y = $derived(run(clip.x));

  const nseg = $derived(Math.min(8192, 2 ** Math.floor(Math.log2(clip.x.length / 2))));
  const sIn = $derived(welch(clip.x, clip.fs, nseg));
  const sOut = $derived(welch(y, clip.fs, nseg));
  const ref = $derived(Math.max(...sIn.amp.slice(1)));
  const dbIn = $derived(sIn.amp.map((a) => toDb(a / ref)));
  const dbOut = $derived(sOut.amp.map((a) => toDb(a / ref)));
  const freqs = $derived(Float64Array.from({ length: 400 }, (_, i) => fmin * (fN / fmin) ** (i / 399)));
  const G = $derived.by(() => {
    const mag = sos ? sosResponse(sos, freqs, clip.fs).mag : family === 'sma' ? movingAverageResponse(M, freqs, clip.fs) : emaResponse(M, freqs, clip.fs);
    return mag.map((m) => toDb(zeroPhase ? m * m : m));
  });

  // strongest lines in the input, and what the filter did to each
  const peaks = $derived.by(() => {
    const a = sIn.amp;
    const sorted = Array.from(a).slice(1).sort((p, q) => p - q);
    const floor = sorted[Math.floor(sorted.length / 2)];
    const c: number[] = [];
    for (let k = 2; k < a.length - 1; k++) if (a[k] > a[k - 1] && a[k] >= a[k + 1] && a[k] > 8 * floor) c.push(k);
    return c.sort((p, q) => a[q] - a[p]).slice(0, 4).sort((p, q) => p - q)
      .map((k) => ({ f: sIn.freq[k], change: toDb(sOut.amp[k] / a[k]) }));
  });

  const PRESETS: { label: string; apply: () => void }[] = [
    { label: 'Remove the 60 Hz hum', apply: () => set('hum', 'butter', 'bandstop', 2, [55, 65]) },
    { label: 'Keep only the 5 Hz signal', apply: () => set('hum', 'butter', 'lowpass', 6, [12]) },
    { label: 'Smooth slide 5 (Butterworth)', apply: () => set('slide5', 'butter', 'lowpass', 4, [3]) },
    { label: 'Smooth slide 5 (moving average)', apply: () => set('slide5', 'sma', 'lowpass', 4, [3], 20) },
  ];
  function set(id: string, fam: Family, ty: FilterType, n: number, fc: number[], m = M) {
    clipId = id;
    family = fam;
    type = ty;
    order = n;
    M = m;
    const c = clips.find((k) => k.id === id)!;
    const lo = c.fs / 2000, hi = 0.98 * c.fs / 2;
    const uu = (f: number) => Math.log(f / lo) / Math.log(hi / lo);
    u1 = uu(fc[0]);
    u2 = fc[1] ? uu(fc[1]) : Math.min(1, u1 + 0.1);
  }
  let playing = $state<string | null>(null);
  function listen(which: 'in' | 'out') {
    if (playing === which) { stop(); playing = null; return; }
    playing = which;
    playClip(which === 'in' ? clip.x : y, clip.fs, () => (playing = null));
  }
  const view = $derived(clip.x.length / clip.fs > 3 ? 3 : clip.x.length / clip.fs);
  const fmt = (f: number) => (f >= 1000 ? `${(f / 1000).toFixed(2)} kHz` : f >= 10 ? `${f.toFixed(1)} Hz` : `${f.toFixed(2)} Hz`);
</script>

<div class="card lab" data-testid="filter-lab">
  <div class="presets">
    <span class="small muted">Presets:</span>
    {#each PRESETS as p}<button onclick={p.apply}>{p.label}</button>{/each}
  </div>
  <div class="controls">
    <label class="control"><span>Signal</span>
      <select bind:value={clipId}>{#each clips as c}<option value={c.id}>{c.recorded ? '● ' : ''}{c.name}</option>{/each}</select>
    </label>
    <Seg bind:value={family} label="Filter family" options={[{ value: 'butter', label: 'Butterworth' }, { value: 'sma', label: 'Moving avg' }, { value: 'ema', label: 'Exponential MA' }]} />
    {#if family === 'butter'}
      <Seg bind:value={type} label="Type" options={[{ value: 'lowpass', label: 'LP' }, { value: 'highpass', label: 'HP' }, { value: 'bandpass', label: 'BP' }, { value: 'bandstop', label: 'BS' }]} />
      <label class="control"><span>Order n <b>{order}</b></span><input type="range" min="1" max="8" step="1" bind:value={order} /></label>
      <label class="control"><span>{band ? 'f₁' : 'Cutoff f_c'} <b>{fmt(f1)}</b></span><input type="range" min="0" max="1" step="0.001" bind:value={u1} /></label>
      {#if band}<label class="control"><span>f₂ <b>{fmt(f2)}</b></span><input type="range" min="0" max="1" step="0.001" bind:value={u2} /></label>{/if}
    {:else}
      <label class="control"><span>Window M <b>{M}</b> ({fmt(clip.fs / M)} first null)</span><input type="range" min="2" max="200" step="1" bind:value={M} /></label>
    {/if}
    <Seg bind:value={phase} label="Phase" options={[{ value: 'causal', label: 'causal (real time)' }, { value: 'zero', label: 'zero-phase (offline)' }]} />
  </div>

  <LineChart
    series={[
      { x: sIn.freq, y: dbIn, color: 'var(--text-muted)', width: 1, label: 'input spectrum' },
      { x: sOut.freq, y: dbOut, color: 'var(--cls-2)', width: 1.2, label: 'output spectrum' },
      { x: freqs, y: G, color: 'var(--accent)', width: 3, label: zeroPhase ? 'filter |G|² (applied twice)' : 'filter |G|' },
    ]}
    logX
    xDomain={[fmin, fN]}
    yDomain={[-90, 6]}
    height={app.mode === 'lecture' ? 300 : 250}
    xLabel="frequency (Hz, log scale)"
    yLabel="dB"
    legend
    markers={family === 'butter' ? (band ? [{ x: f1, color: 'var(--accent)', dash: true }, { x: f2, color: 'var(--accent)', dash: true }] : [{ x: f1, label: 'f_c', color: 'var(--accent)', dash: true }]) : []}
    ariaLabel="Filter response over the signal spectrum"
  >
    {#snippet overlay({ x, y: yy })}
      <line x1={x(fmin)} x2={x(fN)} y1={yy(-3)} y2={yy(-3)} class="m3" />
      <text x={x(fmin) + 4} y={yy(-3) + 12} class="m3t">−3 dB</text>
    {/snippet}
  </LineChart>

  <div class="cols">
    <div>
      <div class="head">
        <b class="small">Time domain{view < clip.x.length / clip.fs ? ` (first ${view} s)` : ''}</b>
        {#if clip.fs >= 1000}
          <span><button onclick={() => listen('in')}>{playing === 'in' ? '■' : '▶'} before</button> <button onclick={() => listen('out')}>{playing === 'out' ? '■' : '▶'} after</button></span>
        {/if}
      </div>
      <LineChart
        series={[
          { y: clip.x, dx: 1 / clip.fs, color: 'var(--text-muted)', width: 1, label: 'before' },
          { y, dx: 1 / clip.fs, color: 'var(--accent)', width: 2, label: 'after' },
        ]}
        xDomain={[0, view]}
        height={app.mode === 'lecture' ? 240 : 200}
        xLabel="t (s)"
        yLabel={clip.units || 'y'}
        legend
        ariaLabel="Signal before and after filtering"
      />
    </div>
    <div class="peaks">
      <b class="small">Change in each spectral line</b>
      {#if peaks.length}
        <table class="num" data-testid="peak-table">
          <thead><tr><th>line</th><th>change</th></tr></thead>
          <tbody>
            {#each peaks as p}<tr><td>{fmt(p.f)}</td><td data-f={p.f.toFixed(0)} class:cut={p.change < -10}>{p.change > -0.05 ? '0.0' : p.change.toFixed(1)} dB</td></tr>{/each}
          </tbody>
        </table>
      {:else}
        <p class="small muted">No distinct spectral lines in this signal.</p>
      {/if}
      {#if clip.note}<p class="small muted">{clip.note}</p>{/if}
      <p class="small secondary">
        {#if zeroPhase}A zero-phase filter is applied forwards and then backwards. There is no lag, but the whole record is required (offline only), and the magnitude response is applied twice.
        {:else}A causal filter uses only past samples, so it can run in real time. Its output is delayed, which is visible at the edges.{/if}
      </p>
    </div>
  </div>
</div>

<style>
  .presets { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; margin-bottom: 0.6rem; }
  .cols { display: grid; grid-template-columns: 1fr minmax(200px, 280px); gap: 1rem; align-items: start; margin-top: 0.6rem; }
  .cols > * { min-width: 0; }
  .head { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
  .peaks { display: grid; gap: 0.4rem; }
  table { border-collapse: collapse; font-size: 0.88rem; }
  th, td { padding: 0.2rem 0.6rem; text-align: right; border-bottom: 1px solid var(--grid); }
  th { color: var(--text-muted); font-weight: 600; }
  td.cut { color: var(--critical); font-weight: 700; }
  .m3 { stroke: var(--accent); stroke-dasharray: 2 3; opacity: 0.7; }
  .m3t { font-size: var(--chart-font); fill: var(--text-secondary); }
  @media (max-width: 800px) { .cols { grid-template-columns: 1fr; } }
</style>
