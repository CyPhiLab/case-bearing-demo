<script lang="ts">
  // A scanning vibrometer measures the vibration at a grid of points on a structure, one after another, without
  // touching it. Normalized to a reference, the amplitudes at a resonance trace out the mode shape.
  import { onDestroy, onMount } from 'svelte';
  import LineChart from '../../lib/charts/LineChart.svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import { MATERIALS, beamFreqs, phi } from '../../lib/beam';
  import { gaussian } from '../../lib/dsp/signals';
  import { app } from '../../lib/state.svelte';

  const L = 0.3, h = 0.002;
  const f0 = beamFreqs(MATERIALS.steel.E, MATERIALS.steel.rho, h, L);
  let mode = $state(0);
  const NP = 21;
  const us = Array.from({ length: NP }, (_, i) => 0.05 + (0.95 * i) / (NP - 1));
  const noise = gaussian(NP * 4, 0.02, 21);
  const meas = $derived(us.map((u, i) => phi(mode, u) + noise[mode * NP + i]));
  let k = $state(NP);
  const ucurve = Array.from({ length: 200 }, (_, i) => i / 199);
  const theory = $derived(ucurve.map((u) => phi(mode, u)));

  let t = $state(0);
  let raf = 0;
  let timer = 0;
  onMount(() => {
    let last = performance.now();
    const tick = (now: number) => {
      t += (now - last) / 1000;
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
  onDestroy(() => { cancelAnimationFrame(raf); clearInterval(timer); });
  function scan() {
    clearInterval(timer);
    k = 0;
    timer = window.setInterval(() => {
      if (++k >= NP) clearInterval(timer);
    }, 150);
  }
  const X0 = 30, X1 = 410, Y0 = 110;
  const shape = $derived(ucurve.map((u) => `${X0 + u * (X1 - X0)},${Y0 - 35 * phi(mode, u) * Math.sin(2 * Math.PI * 1.2 * t)}`).join(' '));
  const spot = $derived(k < NP ? us[k] : null);
</script>

<div class="card">
  <div class="controls">
    <Seg options={f0.map((f, n) => ({ value: n, label: `Mode ${n + 1} (${f.toFixed(0)} Hz)` }))} bind:value={mode} onchange={scan} label="Mode" />
    <button class="primary" onclick={scan}>Scan the beam</button>
  </div>
  <svg viewBox="0 0 440 160" class="rig" role="img" aria-label="Laser vibrometer scanning a cantilever">
    <rect x="10" y="80" width="20" height="60" class="wall" />
    <rect x="200" y="4" width="40" height="18" rx="3" class="head" />
    <text x="220" y="17" text-anchor="middle" class="hl">LDV</text>
    {#if spot !== null}
      <line x1="220" y1="22" x2={X0 + spot * (X1 - X0)} y2={Y0 - 35 * phi(mode, spot) * Math.sin(2 * Math.PI * 1.2 * t)} class="laser" />
    {/if}
    <polyline points={shape} class="beam" />
    {#each us.slice(0, k) as u}<circle cx={X0 + u * (X1 - X0)} cy={Y0 + 30} r="2" class="done" />{/each}
  </svg>
  <LineChart
    series={[{ x: ucurve, y: theory, color: 'var(--text-muted)', width: 1.5, dash: [4, 3], label: 'theoretical mode shape' }]}
    xDomain={[0, 1]}
    yDomain={[-1.3, 1.3]}
    height={app.mode === 'lecture' ? 220 : 180}
    xLabel="position x/L"
    yLabel="amplitude (re tip)"
    legend
    ariaLabel="Measured mode shape"
  >
    {#snippet overlay({ x, y })}
      {#each us.slice(0, k) as u, i}<circle cx={x(u)} cy={y(meas[i])} r="4" fill="var(--accent)" />{/each}
    {/snippet}
  </LineChart>
  <p class="small secondary">
    Blue points: amplitude measured at each scan point while the beam vibrates at mode {mode + 1}. The measurement adds no mass, so the natural
    frequencies are those of the bare beam (compare the mass-loading figure in the accelerometer section).
  </p>
</div>

<style>
  .rig { width: 100%; max-height: 190px; }
  .wall { fill: var(--axis); }
  .head { fill: var(--text-primary); }
  .hl { fill: var(--surface-1); font-size: 10px; font-weight: 700; }
  .laser { stroke: #e33; stroke-width: 1.5; }
  .beam { fill: none; stroke: var(--text-secondary); stroke-width: 5; stroke-linecap: round; }
  .done { fill: var(--accent); }
</style>
