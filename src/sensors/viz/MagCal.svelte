<script lang="ts">
  // Compass heading from a 2-axis magnetometer, and hard-/soft-iron calibration. Rotating the sensor through a full
  // turn should trace a circle centred on the origin; nearby iron and magnets shift it (hard iron) and squash it
  // (soft iron). The min/max method recentres and rescales the ellipse.
  import { onDestroy } from 'svelte';
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { heading } from '../lib/physics';
  import { gaussian } from '../../lib/dsp/signals';
  import { app } from '../../lib/state.svelte';

  const H = 20; // horizontal Earth field, µT (northern United States)
  let psi = $state(30); // true heading, degrees
  let ox = $state(12);
  let oy = $state(-8);
  let sx = $state(1.3); // soft-iron scale on x
  let calibrated = $state(false);
  let pts = $state<[number, number][]>([]);

  const meas = (deg: number, k = 0): [number, number] => {
    const a = (deg * Math.PI) / 180;
    const nz = gaussian(2, 0.4, 1000 + k);
    return [sx * H * Math.cos(a) + ox + nz[0], H * -Math.sin(a) + oy + nz[1]];
  };
  const cur = $derived(meas(psi));
  const cal = $derived.by(() => {
    if (pts.length < 8) return null;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const rx = (Math.max(...xs) - Math.min(...xs)) / 2, ry = (Math.max(...ys) - Math.min(...ys)) / 2;
    const r = (rx + ry) / 2;
    return { f: ([x, y]: [number, number]): [number, number] => [((x - cx) * r) / rx, ((y - cy) * r) / ry], cx, cy, rx, ry };
  });
  // calibration is stale once the disturbance changes
  $effect(() => {
    void ox; void oy; void sx;
    pts = [];
    calibrated = false;
  });
  const shown = $derived(calibrated && cal ? cal.f(cur) : cur);
  const hRaw = $derived(heading(cur[0], cur[1]));
  const hCal = $derived(cal ? heading(...cal.f(cur)) : NaN);

  let timer = 0;
  function rotate() {
    clearInterval(timer);
    pts = [];
    calibrated = false;
    let k = 0;
    timer = window.setInterval(() => {
      pts = [...pts, meas(k * 7.5, k)];
      psi = (k * 7.5) % 360;
      if (++k >= 48) clearInterval(timer);
    }, 40);
  }
  onDestroy(() => clearInterval(timer));

  const hs = Array.from({ length: 361 }, (_, i) => i);
  const wrap = (d: number) => ((d + 540) % 360) - 180;
  const errRaw = $derived(hs.map((h) => wrap(heading(...meas(h, -1)) - h)));
  const errCal = $derived(cal ? hs.map((h) => wrap(heading(...cal.f(meas(h, -1))) - h)) : []);
  const S = 1.2; // px per µT
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>True heading <b>{psi.toFixed(0)}°</b></span><input type="range" min="0" max="359" step="1" bind:value={psi} /></label>
    <label class="control"><span>Hard-iron offset x <b>{ox} µT</b></span><input type="range" min="-30" max="30" step="1" bind:value={ox} /></label>
    <label class="control"><span>Hard-iron offset y <b>{oy} µT</b></span><input type="range" min="-30" max="30" step="1" bind:value={oy} /></label>
    <label class="control"><span>Soft-iron scale x <b>{sx.toFixed(2)}</b></span><input type="range" min="0.6" max="1.5" step="0.01" bind:value={sx} /></label>
  </div>
  <div class="controls" style="margin-top: 0.5rem">
    <button onclick={rotate}>Rotate the sensor through a full turn</button>
    <button class="primary" disabled={!cal} aria-pressed={calibrated} onclick={() => (calibrated = !calibrated)}>{calibrated ? 'Show raw readings' : 'Apply calibration'}</button>
  </div>
  <div class="layout">
    <svg viewBox="-75 -75 150 150" class="plane" role="img" aria-label="Magnetometer readings in the x–y plane">
      <line x1="-72" x2="72" y1="0" y2="0" class="ax" /><line y1="-72" y2="72" x1="0" x2="0" class="ax" />
      <circle r={H * S} class="ideal" />
      {#each pts as p}
        {@const q = calibrated && cal ? cal.f(p) : p}
        <circle cx={q[0] * S} cy={q[1] * S} r="1.6" class="pt" />
      {/each}
      <line x1="0" y1="0" x2={shown[0] * S} y2={shown[1] * S} class="vec" />
      <circle cx={shown[0] * S} cy={shown[1] * S} r="3.5" class="cur" />
      <text x="70" y="-3" text-anchor="end" class="al">Bx</text>
      <text x="3" y="72" class="al">By</text>
    </svg>
    <div class="right">
      <div class="stats">
        <div class="stat"><span class="value num">{hRaw.toFixed(0)}°</span><span class="label">heading from raw readings</span></div>
        <div class="stat"><span class="value num">{Number.isNaN(hCal) ? '–' : hCal.toFixed(0) + '°'}</span><span class="label">after calibration</span></div>
        <div class="stat"><span class="value num">{psi.toFixed(0)}°</span><span class="label">true heading</span></div>
      </div>
      <LineChart
        series={[
          { x: hs, y: errRaw, color: 'var(--cls-2)', width: 1.8, label: 'raw' },
          ...(cal ? [{ x: hs, y: errCal, color: 'var(--accent)', width: 1.8, label: 'calibrated' }] : []),
        ]}
        xDomain={[0, 360]}
        yDomain={[-90, 90]}
        height={app.mode === 'lecture' ? 220 : 200}
        xLabel="true heading (°)"
        yLabel="heading error (°)"
        legend
        markers={[{ x: psi, color: 'var(--text-muted)', dash: true }]}
        ariaLabel="Heading error"
      />
    </div>
  </div>
  <p class="small muted">Dashed circle: what an undisturbed sensor would trace ({H} µT horizontal field). Dots: readings collected during the turn.</p>
</div>

<style>
  .layout { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 1rem; align-items: center; margin-top: 0.6rem; }
  .plane { width: 230px; }
  .ax { stroke: var(--grid); }
  .ideal { fill: none; stroke: var(--text-muted); stroke-dasharray: 3 3; }
  .pt { fill: var(--cls-2); }
  .vec { stroke: var(--accent); stroke-width: 1.5; }
  .cur { fill: var(--accent); }
  .al { font-size: 8px; fill: var(--text-muted); }
  .stats { display: flex; flex-wrap: wrap; gap: 0.5rem 1.6rem; margin-bottom: 0.4rem; }
  @media (max-width: 640px) { .layout { grid-template-columns: minmax(0, 1fr); } .plane { margin: 0 auto; display: block; } }
</style>
