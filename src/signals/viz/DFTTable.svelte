<script lang="ts">
  // Book Examples 2.6–2.7: sample y(t) = 10 sin 2πt with N = 8, δt = 0.125 s, then take the DFT.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import StemChart from './StemChart.svelte';
  import { dftAmplitude, linspace } from '../../lib/dsp/signals';
  import { app } from '../../lib/state.svelte';

  let N = $state(8);
  let dt = $state(0.125);
  let f = $state(1);
  const A = 10;
  const ti = $derived(linspace(N, dt));
  const yi = $derived(ti.map((tt) => A * Math.sin(2 * Math.PI * f * tt)));
  const d = $derived(dftAmplitude(yi, dt));
  const dense = $derived(linspace(600, (N * dt) / 600));
  const df = $derived(1 / (N * dt));
  const fmt = (v: number) => (Math.abs(v) < 5e-10 ? '0' : v.toFixed(2));
</script>

<div class="card">
  <div class="controls">
    <Seg bind:value={N} label="Number of samples N" options={[8, 16, 32].map((v) => ({ value: v, label: `N = ${v}` }))} />
    <Seg bind:value={dt} label="Sample interval" options={[0.125, 0.0625, 0.25].map((v) => ({ value: v, label: `δt = ${v} s` }))} />
    <label class="control"><span>Signal frequency f <b>{f.toFixed(2)} Hz</b></span><input type="range" min="0" max={1 / (2 * dt)} step="0.05" bind:value={f} /></label>
    <button onclick={() => { N = 8; dt = 0.125; f = 1; }}>Reset to Example 2.6</button>
  </div>
  <div class="grid-2">
    <div>
      <LineChart
        series={[{ y: dense.map((tt) => A * Math.sin(2 * Math.PI * f * tt)), dx: (N * dt) / 600, color: 'var(--text-muted)', width: 1, dash: [4, 3] }]}
        xDomain={[0, N * dt]}
        yDomain={[-11.5, 11.5]}
        height={app.mode === 'lecture' ? 220 : 170}
        xLabel="t (s)"
        yLabel="y (V)"
        hover={false}
        ariaLabel="Sampled sine"
      >
        {#snippet overlay({ x, y })}
          {#each yi as v, i}
            <line x1={x(ti[i])} x2={x(ti[i])} y1={y(0)} y2={y(v)} class="stem" />
            <circle cx={x(ti[i])} cy={y(v)} r="4" class="dot" />
          {/each}
        {/snippet}
      </LineChart>
      <StemChart
        stems={Array.from(d.amp, (a, k) => ({ x: d.freq[k], y: a, label: N <= 16 ? a.toFixed(1) : undefined }))}
        xDomain={[-df / 2, 1 / (2 * dt)]}
        yDomain={[0, 12]}
        height={app.mode === 'lecture' ? 200 : 160}
        xLabel="f_k = k / (N δt)  (Hz)"
        yLabel="C(f_k) (V)"
        ariaLabel="DFT amplitude spectrum"
      />
    </div>
    <div class="tables">
      <table class="num">
        <thead><tr><th>r</th><th>t = rδt</th><th>y(rδt)</th></tr></thead>
        <tbody>{#each yi as v, i}<tr><td>{i}</td><td>{ti[i].toFixed(3)}</td><td>{fmt(v)}</td></tr>{/each}</tbody>
      </table>
      <table class="num">
        <thead><tr><th>f_k (Hz)</th><th>Re Y</th><th>Im Y</th><th>C(f_k)</th></tr></thead>
        <tbody>
          {#each d.amp as a, k}
            <tr class:hl={a > 1}><td>{d.freq[k].toFixed(2)}</td><td>{fmt((d.re[k] * (k ? 2 : 1)) / N)}</td><td>{fmt((-d.im[k] * (k ? 2 : 1)) / N)}</td><td><b>{fmt(a)}</b></td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
  <p class="small secondary">
    Y(f_k) = (2/N) Σ y(rδt) e<sup>−i2πrk/N</sup>, with C(f_k) = |Y(f_k)|. Frequencies are spaced by δf = 1/(Nδt) =
    <b class="num">{df.toFixed(3)} Hz</b>, up to the Nyquist frequency 1/(2δt) = <b class="num">{(1 / (2 * dt)).toFixed(2)} Hz</b>.
    {#if Math.abs(f / df - Math.round(f / df)) < 1e-6}
      f falls exactly on a bin, so the full {A} V appears in one line.
    {:else}
      f = {f.toFixed(2)} Hz falls <i>between</i> bins ({(f / df).toFixed(2)} δf), so the amplitude spreads into neighboring bins. This is
      <b>leakage</b>, discussed next.
    {/if}
  </p>
</div>

<style>
  .stem { stroke: var(--accent); stroke-width: 1.5; }
  .dot { fill: var(--accent); }
  .tables { display: grid; grid-template-columns: auto 1fr; gap: 0.8rem; align-items: start; max-height: 380px; overflow: auto; }
  table { border-collapse: collapse; font-size: 0.82rem; width: 100%; }
  th, td { padding: 0.15rem 0.45rem; text-align: right; border-bottom: 1px solid var(--grid); }
  th { color: var(--text-muted); font-weight: 600; position: sticky; top: 0; background: var(--surface-1); }
  tr.hl td { background: color-mix(in srgb, var(--accent) 12%, transparent); }
  @media (max-width: 520px) { .tables { grid-template-columns: 1fr; max-height: none; } }
</style>
