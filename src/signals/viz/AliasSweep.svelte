<script lang="ts">
  // Slide 8: sweep a sine past f_s/2 and watch the samples trace out a slower "alias".
  import { onDestroy } from 'svelte';
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { aliasFrequency, linspace } from '../../lib/dsp/signals';
  import { app } from '../../lib/state.svelte';

  let fs = $state(10);
  let f = $state(2);
  let dots = $state(false);
  const T = 1;
  const dense = linspace(1001, T / 1000);
  const fa = $derived(aliasFrequency(f, fs));
  const sign = $derived((((f % fs) + fs) % fs) <= fs / 2 ? 1 : -1);
  const ns = $derived(Math.floor(fs * T) + 1);
  const st = $derived(Array.from({ length: ns }, (_, i) => i / fs));
  const sv = $derived(st.map((tt) => Math.sin(2 * Math.PI * f * tt)));
  const truth = $derived(dense.map((tt) => Math.sin(2 * Math.PI * f * tt)));
  const alias = $derived(dense.map((tt) => sign * Math.sin(2 * Math.PI * fa * tt)));
  const aliased = $derived(f > fs / 2 + 1e-9);
  const ratio = $derived(fs / Math.max(f, 1e-9));

  let timer = $state<number | null>(null);
  function sweep() {
    if (timer !== null) { cancelAnimationFrame(timer); timer = null; return; }
    const start = performance.now();
    const top = 1.25 * fs;
    const tick = (now: number) => {
      const p = (now - start) / 12000;
      if (p >= 1) { timer = null; return; }
      f = Math.round(p * top * 20) / 20;
      timer = requestAnimationFrame(tick);
    };
    timer = requestAnimationFrame(tick);
  }
  onDestroy(() => timer !== null && cancelAnimationFrame(timer));

  // spectrum strip: sampling makes copies of the line at k·fs ± f; the copy inside [0, fs/2] is what you see
  const images = $derived(
    [1, 2].flatMap((k) => [k * fs - f, k * fs + f]).filter((v) => v > 0 && v <= 2 * fs + 1e-9),
  );
  const SW = 600, SH = 90;
  const sx = (v: number) => 20 + (v / (2 * fs)) * (SW - 40);
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Signal frequency f <b>{f.toFixed(2)} Hz</b></span><input type="range" min="0" max={1.25 * fs} step="0.05" bind:value={f} /></label>
    <label class="control"><span>Sample rate f<sub>s</sub> <b>{fs} Hz</b></span><input type="range" min="2" max="40" step="1" bind:value={fs} /></label>
    <button class="primary" onclick={sweep}>{timer !== null ? '■ Stop' : '▶ Sweep f from 0 to 1.25 fs'}</button>
    <label class="check"><input type="checkbox" bind:checked={dots} /> connect the dots</label>
  </div>
  <LineChart
    series={[
      { y: truth, dx: T / 1000, color: 'var(--text-muted)', width: 1.2, label: `true signal, ${f.toFixed(2)} Hz` },
      ...(aliased ? [{ y: alias, dx: T / 1000, color: 'var(--cls-2)', width: 2.5, dash: [7, 4], label: `apparent signal, ${fa.toFixed(2)} Hz` }] : []),
    ]}
    xDomain={[0, T]}
    yDomain={[-1.25, 1.25]}
    height={app.mode === 'lecture' ? 300 : 230}
    xLabel="t (s)"
    yLabel="y"
    legend
    hover={false}
    ariaLabel="Sampled sine and its alias"
  >
    {#snippet overlay({ x, y })}
      {#if dots}<polyline points={st.map((tt, i) => `${x(tt)},${y(sv[i])}`).join(' ')} class="joined" />{/if}
      {#each st as tt, i}<circle cx={x(tt)} cy={y(sv[i])} r="4.5" class="dot" />{/each}
    {/snippet}
  </LineChart>

  <div class="bottom">
    <svg viewBox="0 0 {SW} {SH}" class="strip" role="img" aria-label="Spectrum with sampling images">
      <rect x={sx(0)} y="16" width={sx(fs / 2) - sx(0)} height="44" class="base" />
      <text x={(sx(0) + sx(fs / 2)) / 2} y="12" text-anchor="middle" class="t muted">observable range: 0 to f_N</text>
      <line x1={sx(0)} x2={sx(2 * fs)} y1="60" y2="60" class="axis" />
      {#each [0, 0.5, 1, 1.5, 2] as k}
        <line x1={sx(k * fs)} x2={sx(k * fs)} y1="60" y2="65" class="axis" />
        <text x={sx(k * fs)} y="78" text-anchor="middle" class="t">{k === 0 ? '0' : k === 0.5 ? 'f_N = fs/2' : k === 1 ? 'fs' : `${k} fs`}</text>
      {/each}
      {#each images as v}<line x1={sx(v)} x2={sx(v)} y1="60" y2="30" class="img" />{/each}
      {#if f <= 2 * fs}<line x1={sx(f)} x2={sx(f)} y1="60" y2="20" class="true" />{/if}
      <line x1={sx(fa)} x2={sx(fa)} y1="60" y2="24" class="seen" />
      <circle cx={sx(fa)} cy="24" r="4" class="seenDot" />
    </svg>
    <div class="stats">
      <div class="stat">
        <span class="value num" class:bad={aliased}>{fa.toFixed(2)} Hz</span>
        <span class="label">apparent frequency{aliased ? ` (aliased from ${f.toFixed(2)} Hz)` : ''}</span>
      </div>
      <div class="small">
        f<sub>s</sub> / f = <b class="num">{f > 0 ? ratio.toFixed(1) : '∞'}</b>
        {#if !aliased && ratio >= 10}<span class="ok">✓ meets the 10× rule of thumb</span>
        {:else if !aliased}<span class="warn">no aliasing (f &lt; f<sub>s</sub>/2), but below 10×: the waveform shape is poorly resolved</span>
        {:else}<span class="badtxt">✗ above the Nyquist frequency: aliased</span>{/if}
      </div>
    </div>
  </div>
  <p class="small secondary self-only">
    The gray lines in the strip are the images that sampling creates at k·f<sub>s</sub> ± f. The samples identify only the image
    between 0 and f<sub>N</sub> = f<sub>s</sub>/2 (orange). Above f<sub>N</sub> the apparent frequency folds back:
    f<sub>a</sub> = |f − k·f<sub>s</sub>|.
  </p>
</div>

<style>
  .dot { fill: var(--accent); stroke: var(--surface-1); stroke-width: 1.5; }
  .joined { fill: none; stroke: var(--accent); stroke-width: 1.5; }
  .bottom { display: grid; grid-template-columns: 1fr minmax(220px, 320px); gap: 1rem; align-items: center; margin-top: 0.4rem; }
  .bottom > * { min-width: 0; }
  .strip { width: 100%; height: auto; max-height: 120px; }
  .base { fill: color-mix(in srgb, var(--accent) 10%, transparent); }
  .axis { stroke: var(--axis); }
  .t { font-size: 11px; fill: var(--text-secondary); }
  .t.muted { fill: var(--text-muted); }
  .img { stroke: var(--text-muted); stroke-width: 2; stroke-dasharray: 3 2; }
  .true { stroke: var(--text-secondary); stroke-width: 3; }
  .seen { stroke: var(--cls-2); stroke-width: 3; }
  .seenDot { fill: var(--cls-2); }
  .stats { display: grid; gap: 0.4rem; }
  .bad { color: var(--cls-2); }
  .ok { color: var(--good); font-weight: 600; margin-left: 0.3rem; }
  .warn { color: var(--text-secondary); margin-left: 0.3rem; }
  .badtxt { color: var(--critical); font-weight: 600; margin-left: 0.3rem; }
  .check { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--text-secondary); }
  @media (max-width: 760px) { .bottom { grid-template-columns: 1fr; } }
</style>
