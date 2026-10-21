<script lang="ts">
  // Step-by-step 1D convolution with one of the CNN's real first-layer filters:
  // slide the 32 taps along the input, multiply pointwise, sum, add the bias, apply ReLU.
  // The numbers are the network's own (tests/cnn.test.ts checks them against TensorFlow.js).
  import { onMount } from 'svelte';
  import LineChart from '../charts/LineChart.svelte';
  import type { BearingCNN } from '../ml/cnn';
  import { powerSpectrum } from '../dsp/fft';

  interface Props {
    cnn: BearingCNN;
    input: ArrayLike<number>; // raw window, g
    fs: number;
  }
  let { cnn, input, fs }: Props = $props();

  const K = $derived(cnn.kernels[0].length);
  const N = $derived(cnn.spec.frame);
  const T = $derived(N - K + 1);

  // default to the filter with the strongest peak inside the 2–5 kHz resonance band
  const peakInfo = $derived(
    cnn.kernels.map((k) => {
      const p = new Float64Array(256);
      p.set(k);
      const P = powerSpectrum(p);
      let best = 0;
      for (let i = 1; i < P.length; i++) if (P[i] > P[best]) best = i;
      return { hz: (best * fs) / 256, power: P[best] };
    }),
  );
  let filter = $state(-1);
  $effect(() => {
    if (filter < 0) {
      let best = 0;
      peakInfo.forEach((p, i) => {
        const inBand = p.hz >= 2000 && p.hz <= 5000;
        const bestIn = peakInfo[best].hz >= 2000 && peakInfo[best].hz <= 5000;
        if ((inBand && !bestIn) || (inBand === bestIn && p.power > peakInfo[best].power)) best = i;
      });
      filter = best;
    }
  });
  const f = $derived(Math.max(0, filter));
  const kernel = $derived(cnn.kernels[f]);
  const bias = $derived(cnn.conv1Bias[f]);

  const x = $derived(cnn.normalize(input));
  const out = $derived.by(() => {
    const o = new Float64Array(T);
    for (let t = 0; t < T; t++) {
      let s = bias;
      for (let j = 0; j < K; j++) s += x[t + j] * kernel[j];
      o[t] = Math.max(0, s);
    }
    return o;
  });

  let t = $state(0);
  let playing = $state(false);
  const SPEEDS = [
    { label: 'Slow motion', perSec: 6 },
    { label: 'Medium', perSec: 60 },
    { label: 'Fast', perSec: 500 },
  ];
  let speed = $state(1);
  const ti = $derived(Math.min(T - 1, Math.max(0, Math.floor(t))));

  // what's under the box right now
  const seg = $derived(Array.from({ length: K }, (_, j) => x[ti + j]));
  const prods = $derived(seg.map((v, j) => v * kernel[j]));
  const sum = $derived(prods.reduce((a, b) => a + b, 0));
  const z = $derived(sum + bias);

  const xMax = $derived(Math.max(1e-9, ...Array.from(x, Math.abs)));
  const kMax = $derived(Math.max(1e-9, ...kernel.map(Math.abs)));
  const pMax = $derived(Math.max(1e-9, ...prods.map(Math.abs), (xMax * kMax) / 4));

  // output drawn so far, centred under the box; plus the max-pooled version
  const outSoFar = $derived(out.subarray(0, ti + 1));
  const pooled = $derived.by(() => {
    const n = Math.floor((ti + 1) / 2);
    const p = new Float64Array(n);
    for (let i = 0; i < n; i++) p[i] = Math.max(out[2 * i], out[2 * i + 1]);
    return p;
  });

  onMount(() => {
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (playing) {
        t += SPEEDS[speed].perSec * dt;
        if (t >= T - 1) {
          t = T - 1;
          playing = false;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  function toggle() {
    if (!playing && ti >= T - 1) t = 0;
    playing = !playing;
  }
  function step(d: number) {
    playing = false;
    t = Math.max(0, Math.min(T - 1, ti + d));
  }

  let zoomW = $state(600);
  const PAD = 70;
  const colW = $derived((zoomW - PAD - 8) / K);
  const ROW = 64;
  const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));
</script>

<div class="conv">
  <div class="controls">
    <button class="primary" onclick={toggle}>{playing ? '❚❚ Pause' : ti >= T - 1 ? '↺ Replay' : '▶ Play'}</button>
    <button onclick={() => step(-1)} aria-label="Step back one sample">◀ 1</button>
    <button onclick={() => step(1)} aria-label="Step forward one sample">1 ▶</button>
    <label class="control">
      Speed
      <select bind:value={speed}>{#each SPEEDS as s, i}<option value={i}>{s.label}</option>{/each}</select>
    </label>
    <label class="control">
      Filter
      <select bind:value={filter}>
        {#each cnn.kernels as _, i}<option value={i}>#{i + 1} (peak ≈ {(peakInfo[i].hz / 1000).toFixed(1)} kHz)</option>{/each}
      </select>
    </label>
    <span class="small muted num">position {ti + 1} / {T}</span>
  </div>

  <div class="row-label">Input window (z-scored), with the filter's 32-sample footprint. Drag to move it.</div>
  <LineChart
    series={[{ y: x, color: 'var(--text-secondary)', width: 1 }]}
    xDomain={[0, N]}
    height={110}
    margin={{ top: 6, right: 14, bottom: 6, left: 56 }}
    xFormat={() => ''}
    bands={[{ x0: ti, x1: ti + K, fill: 'color-mix(in srgb, var(--focus) 35%, transparent)' }]}
    hover={false}
    onpoint={(xv) => {
      playing = false;
      t = Math.max(0, Math.min(T - 1, Math.round(xv - K / 2)));
    }}
    ariaLabel="Input window with sliding filter"
  />

  <div class="zoom" bind:clientWidth={zoomW}>
    <svg width={zoomW} height={ROW * 3 + 30} role="img" aria-label="Pointwise products of the input segment and the filter">
      {#each [{ label: 'input × ', vals: seg, max: xMax, cls: 'in' }, { label: 'filter = ', vals: kernel, max: kMax, cls: 'k' }, { label: 'products', vals: prods, max: pMax, cls: 'p' }] as rowDef, r}
        {@const y0 = r * (ROW + 10) + ROW / 2}
        <text x={0} y={y0} dy="0.32em" class="rl">{rowDef.label}</text>
        <line x1={PAD} x2={zoomW - 8} y1={y0} y2={y0} class="axis" />
        {#each rowDef.vals as v, j}
          {@const cx = PAD + (j + 0.5) * colW}
          {@const h = (Math.max(-1, Math.min(1, v / rowDef.max)) * ROW) / 2}
          {#if rowDef.cls === 'p'}
            <rect x={cx - colW * 0.35} width={colW * 0.7} y={h > 0 ? y0 - h : y0} height={Math.abs(h)} rx="1.5" class={v >= 0 ? 'pos' : 'neg'} />
          {:else}
            <line x1={cx} x2={cx} y1={y0} y2={y0 - h} class="stem {rowDef.cls}" />
            <circle cx={cx} cy={y0 - h} r="2.6" class="dot {rowDef.cls}" />
          {/if}
        {/each}
      {/each}
    </svg>
    <div class="eq num" aria-live="polite">
      <span>Σ products <b>{fmt(sum)}</b></span>
      <span>+ bias <b>{fmt(bias)}</b></span>
      <span>= <b>{fmt(z)}</b></span>
      <span>→ ReLU → <b class="outv" class:zero={z <= 0}>{fmt(Math.max(0, z))}</b></span>
    </div>
  </div>

  <div class="row-label">Output: feature map for filter #{f + 1}, one value per position, drawn as the filter slides</div>
  <LineChart
    series={[
      { y: outSoFar, xStart: K / 2, color: 'var(--focus)', width: 1.3, fill: true, label: 'conv + ReLU' },
      { y: pooled, xStart: K / 2 + 0.5, dx: 2, color: 'var(--cls-2)', width: 1.2, label: 'after max-pool ÷2', dash: [3, 2] },
    ]}
    xDomain={[0, N]}
    yDomain={[0, Math.max(1e-6, ...out) * 1.08]}
    height={130}
    margin={{ top: 6, right: 14, bottom: 22, left: 56 }}
    xFormat={(v) => `${((v / fs) * 1000).toFixed(0)} ms`}
    markers={[{ x: ti + K / 2, color: 'var(--focus)' }]}
    legend
    hover={false}
    ariaLabel="Output feature map"
  />
</div>

<style>
  .conv { display: grid; gap: 0.4rem; }
  .controls { align-items: center; }
  .row-label { font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.4rem; }
  .zoom { position: relative; background: var(--surface-2); border-radius: 8px; padding: 0.5rem 0 0.4rem; }
  svg { display: block; width: 100%; }
  .rl { font-size: var(--chart-label); fill: var(--text-secondary); font-weight: 600; }
  .axis { stroke: var(--axis); }
  .stem { stroke-width: 1.5; }
  .stem.in { stroke: var(--text-secondary); }
  .dot.in { fill: var(--text-secondary); }
  .stem.k { stroke: var(--focus); }
  .dot.k { fill: var(--focus); }
  .pos { fill: var(--div-pos); }
  .neg { fill: var(--div-neg); }
  .eq { display: flex; flex-wrap: wrap; gap: 0.3rem 0.9rem; padding: 0.2rem 0.8rem 0; font-size: 0.95rem; }
  .outv { color: var(--focus); font-size: 1.1rem; }
  .outv.zero { color: var(--text-muted); }
</style>
