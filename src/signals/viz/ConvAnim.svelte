<script lang="ts">
  // y[n] = Σ_k h[k] x[n−k], one output sample at a time: flip the kernel, slide, multiply, sum.
  import { onDestroy } from 'svelte';
  import * as d3 from 'd3';
  import Seg from '../../lib/ui/Seg.svelte';
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { convolve, gaussian } from '../../lib/dsp/signals';
  import { app } from '../../lib/state.svelte';

  type K = 'ma' | 'ema' | 'match' | 'diff';
  let kind = $state<K>('ma');
  let M = $state(6);
  const N = 80;
  const nz = gaussian(N, 0.22, 31);
  const burst = (k: number) => Math.sin((2 * Math.PI * k) / 6);
  const x = Float64Array.from({ length: N }, (_, i) => (i >= 18 ? 1 : 0) + (i >= 50 && i < 62 ? 0.8 * burst(i - 50) : 0) + nz[i]);
  const h = $derived.by((): Float64Array => {
    switch (kind) {
      case 'ma': return new Float64Array(M).fill(1 / M);
      case 'ema': { const a = 2 / (M + 1); return Float64Array.from({ length: Math.min(30, 4 * M) }, (_, k) => a * (1 - a) ** k); }
      case 'match': return Float64Array.from({ length: 12 }, (_, k) => burst(11 - k) / 6); // time-reversed copy of the burst
      default: return Float64Array.from([1, -1]);
    }
  });
  const y = $derived(convolve(x, h));
  let n = $state(30);
  let timer = $state<ReturnType<typeof setInterval> | null>(null);
  function toggle() {
    if (timer) { clearInterval(timer); timer = null; return; }
    if (n >= N - 1) n = 0;
    timer = setInterval(() => {
      if (n >= N - 1) { clearInterval(timer!); timer = null; return; }
      n++;
    }, 180);
  }
  onDestroy(() => timer && clearInterval(timer));

  let width = $state(800);
  const ml = 46, mr = 12, rowH = $derived(app.mode === 'lecture' ? 130 : 105), gap = 26;
  const xs = $derived(d3.scaleLinear().domain([-0.5, N - 0.5]).range([ml, width - mr]));
  const yx = $derived(d3.scaleLinear().domain([-1.2, 2.2]).range([rowH, 0]));
  const ks = $derived(Array.from(h, (_, k) => n - k).filter((i) => i >= 0));
  const prods = $derived(ks.map((i) => ({ i, v: h[n - i] * x[i] })));
  const pmax = $derived(Math.max(0.05, ...Array.from({ length: N }, (_, i) => Math.abs(x[i]) * Math.max(...Array.from(h, Math.abs)))));
  const yp = $derived(d3.scaleLinear().domain([-pmax, pmax]).range([rowH, 0]));
  const yr = $derived.by(() => { const e = d3.extent(y) as [number, number]; const p = (e[1] - e[0]) * 0.1 || 0.5; return d3.scaleLinear().domain([e[0] - p, e[1] + p]).range([rowH, 0]); });
  const hmax = $derived(Math.max(...Array.from(h, Math.abs)));
  const fgrid = Float64Array.from({ length: 256 }, (_, i) => (0.5 * i) / 255);
  const H = $derived(
    fgrid.map((f) => {
      let re = 0, im = 0;
      h.forEach((v, k) => { re += v * Math.cos(2 * Math.PI * f * k); im -= v * Math.sin(2 * Math.PI * f * k); });
      return Math.hypot(re, im);
    }),
  );
  const LBL: Record<K, string> = { ma: 'Moving average', ema: 'Exponential', match: 'Matched (sine burst)', diff: 'Derivative [1, −1]' };
</script>

<div class="card">
  <div class="controls">
    <Seg bind:value={kind} label="Kernel h" options={(Object.keys(LBL) as K[]).map((k) => ({ value: k, label: LBL[k] }))} />
    {#if kind === 'ma' || kind === 'ema'}<label class="control"><span>M <b>{M}</b></span><input type="range" min="2" max="20" step="1" bind:value={M} /></label>{/if}
    <label class="control"><span>Output sample n <b>{n}</b></span><input type="range" min="0" max={N - 1} step="1" bind:value={n} /></label>
    <button class="primary" onclick={toggle}>{timer ? '■ Pause' : '▶ Animate'}</button>
  </div>
  <div class="host" bind:clientWidth={width}>
    <svg {width} height={3 * rowH + 2 * gap + 24} role="img" aria-label="Convolution, step by step">
      <!-- row 1: input and flipped kernel window -->
      <g>
        <text x="4" y="12" class="rl">x[k] and the flipped kernel h[n−k]</text>
        {#if ks.length}
          <rect x={xs(Math.min(...ks) - 0.5)} y="0" width={xs(n + 0.5) - xs(Math.min(...ks) - 0.5)} height={rowH} class="win" />
        {/if}
        <line x1={ml} x2={width - mr} y1={yx(0)} y2={yx(0)} class="zero" />
        {#each x as v, i}
          <line x1={xs(i)} x2={xs(i)} y1={yx(0)} y2={yx(v)} class="xs" class:on={ks.includes(i)} />
          <circle cx={xs(i)} cy={yx(v)} r="2.6" class="xd" class:on={ks.includes(i)} />
        {/each}
        {#each ks as i}
          {@const hy = yx((2.1 * h[n - i]) / hmax)}
          <rect x={xs(i) - 3} y={Math.min(yx(0), hy)} width="6" height={Math.abs(yx(0) - hy)} class="hb" />
        {/each}
      </g>
      <!-- row 2: products -->
      <g transform="translate(0,{rowH + gap})">
        <text x="4" y="-6" class="rl">products h[n−k]·x[k]</text>
        <line x1={ml} x2={width - mr} y1={yp(0)} y2={yp(0)} class="zero" />
        {#each prods as p}
          <line x1={xs(p.i)} x2={xs(p.i)} y1={yp(0)} y2={yp(p.v)} class="ps" />
          <circle cx={xs(p.i)} cy={yp(p.v)} r="3" class="pd" />
        {/each}
        <text x={width - mr} y="12" text-anchor="end" class="sum num">Σ = {y[n].toFixed(3)}</text>
      </g>
      <!-- row 3: output so far -->
      <g transform="translate(0,{2 * (rowH + gap)})">
        <text x="4" y="-6" class="rl">output y[n]</text>
        <line x1={ml} x2={width - mr} y1={yr(0)} y2={yr(0)} class="zero" />
        {#each y as v, i}
          {#if i <= n}
            <line x1={xs(i)} x2={xs(i)} y1={yr(0)} y2={yr(v)} class="ys" class:cur={i === n} />
            <circle cx={xs(i)} cy={yr(v)} r={i === n ? 5 : 2.6} class="yd" class:cur={i === n} />
          {/if}
        {/each}
        {#each [0, 20, 40, 60, 79] as tk}<text x={xs(tk)} y={rowH + 16} text-anchor="middle" class="tk">{tk}</text>{/each}
      </g>
    </svg>
  </div>
  <div class="cols">
    <div>
      <b class="small">Kernel h[k]</b>
      <svg viewBox="0 0 300 70" class="kern" aria-label="Kernel taps">
        <line x1="0" x2="300" y1="35" y2="35" class="zero" />
        {#each h as v, k}
          {@const px = 10 + (k * 280) / Math.max(1, h.length - 1 || 1)}
          <line x1={px} x2={px} y1="35" y2={35 - (30 * v) / hmax} class="hs" />
          <circle cx={px} cy={35 - (30 * v) / hmax} r="3" class="hd" />
        {/each}
      </svg>
    </div>
    <LineChart
      series={[{ x: fgrid, y: H, color: 'var(--cls-2)', width: 2 }]}
            xDomain={[0, 0.5]}
      yDomain={[0, 2.1]}
      height={140}
      xLabel="frequency (cycles per sample, f/fs)"
      yLabel="|H(f)|"
      ariaLabel="Kernel frequency response"
    />
  </div>
  <p class="small secondary">
    {#if kind === 'ma'}All taps equal 1/M: this is the moving average from section 7, with the same low-pass frequency response.
    {:else if kind === 'ema'}Exponentially decaying taps: the EMA is also a convolution, with an infinitely long kernel (truncated here).
    {:else if kind === 'match'}The kernel is a time-reversed copy of the burst at n = 50–61. The output is largest where the input resembles the kernel. This is a <b>matched filter</b>, a band-pass filter centered on the burst frequency.
    {:else}[1, −1] gives x[n] − x[n−1], a discrete derivative. The output is large at the step and small for slowly varying content: a high-pass filter and an edge detector.{/if}
  </p>
</div>

<style>
  .host { width: 100%; min-width: 0; overflow: hidden; }
  svg { display: block; }
  .rl { font-size: var(--chart-font); fill: var(--text-secondary); font-weight: 600; }
  .tk { font-size: var(--chart-font); fill: var(--text-muted); }
  .zero { stroke: var(--axis); }
  .win { fill: color-mix(in srgb, var(--cls-2) 10%, transparent); stroke: var(--cls-2); stroke-dasharray: 3 3; }
  .xs { stroke: var(--text-muted); }
  .xd { fill: var(--text-muted); }
  .xs.on { stroke: var(--accent); stroke-width: 2; }
  .xd.on { fill: var(--accent); }
  .hb { fill: color-mix(in srgb, var(--cls-2) 55%, transparent); }
  .ps { stroke: var(--focus); stroke-width: 2; }
  .pd { fill: var(--focus); }
  .sum { font-size: 0.95rem; font-weight: 700; fill: var(--focus); }
  .ys { stroke: var(--accent); opacity: 0.6; }
  .yd { fill: var(--accent); }
  .ys.cur { stroke: var(--focus); opacity: 1; stroke-width: 2.5; }
  .yd.cur { fill: var(--focus); }
  .cols { display: grid; grid-template-columns: minmax(200px, 320px) 1fr; gap: 1rem; align-items: center; margin-top: 0.5rem; }
  .cols > * { min-width: 0; }
  .kern { width: 100%; height: 70px; }
  .hs { stroke: var(--cls-2); stroke-width: 2; }
  .hd { fill: var(--cls-2); }
  @media (max-width: 700px) { .cols { grid-template-columns: 1fr; } }
</style>
