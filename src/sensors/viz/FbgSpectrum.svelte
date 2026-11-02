<script lang="ts">
  // Several Bragg gratings written into one fiber, each at its own wavelength. Three are bonded along a loaded
  // cantilever; the fourth is loose and senses temperature only, so it can be used to compensate the others.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { braggShift, gratingReflect } from '../lib/physics';
  import { app } from '../../lib/state.svelte';

  const G = [
    { l0: 1530e-9, u: 0.1, label: 'FBG 1 (near the clamp)' },
    { l0: 1540e-9, u: 0.45, label: 'FBG 2 (middle)' },
    { l0: 1550e-9, u: 0.8, label: 'FBG 3 (near the tip)' },
    { l0: 1560e-9, u: null, label: 'FBG 4 (loose, temperature reference)' },
  ];
  let eps0 = $state(800); // strain at the clamp, µε
  let dT = $state(0);
  let comp = $state(true);
  const strain = (u: number | null) => (u === null ? 0 : eps0 * 1e-6 * (1 - u));
  const lams = Array.from({ length: 2400 }, (_, i) => 1525e-9 + (i / 2399) * 42e-9);
  const centers = $derived(G.map((g) => g.l0 + braggShift(g.l0, strain(g.u), dT)));
  const spec = $derived(lams.map((l) => centers.reduce((s, c) => s + gratingReflect(l, c, 0.35e-9), 0)));
  const k = (l0: number) => braggShift(l0, 1e-6, 0); // shift per µε
  const rows = $derived(
    G.map((g, i) => {
      const shift = centers[i] - g.l0;
      const ref = (centers[3] - G[3].l0) * (g.l0 / G[3].l0);
      const naive = shift / k(g.l0);
      const fixed = (shift - ref) / k(g.l0);
      return { ...g, shift, naive, fixed, truth: strain(g.u) * 1e6 };
    }),
  );
  const nm = (v: number) => v * 1e9;
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Strain at the clamp <b>{eps0} µε</b></span><input type="range" min="-1000" max="1000" step="10" bind:value={eps0} /></label>
    <label class="control"><span>Temperature change <b>{dT} °C</b></span><input type="range" min="-30" max="60" step="1" bind:value={dT} /></label>
    <label class="check"><input type="checkbox" bind:checked={comp} /> compensate with FBG 4</label>
  </div>
  <svg viewBox="0 0 440 70" class="rig" role="img" aria-label="Fiber with four gratings on a cantilever">
    <rect x="10" y="22" width="16" height="40" class="wall" />
    <rect x="26" y="36" width="300" height="8" class="beam" />
    <path d="M26,34 H340 C360,34 370,20 390,20 H435" class="fiber" />
    {#each G as g, i}
      {@const x = g.u === null ? 400 : 26 + g.u * 300}
      {@const y = g.u === null ? 20 : 34}
      <g transform="translate({x} {y})">
        {#each { length: 7 } as _, j}<line x1={-9 + j * 3} x2={-9 + j * 3} y1="-3" y2="3" class="grating c{i}" />{/each}
      </g>
      <text x={x} y={g.u === null ? 12 : 58} text-anchor="middle" class="lbl">{i + 1}</text>
    {/each}
  </svg>
  <LineChart
    series={[{ x: lams.map(nm), y: spec, color: 'var(--accent)', width: 1.6, fill: true }]}
    xDomain={[1525, 1567]}
    yDomain={[0, 1]}
    height={app.mode === 'lecture' ? 220 : 190}
    xLabel="wavelength (nm)"
    yLabel="reflected fraction"
    markers={G.map((g) => ({ x: nm(g.l0), color: 'var(--text-muted)', dash: true }))}
    ariaLabel="Reflected spectrum"
  />
  <table class="small num">
    <thead><tr><th>Grating</th><th>shift</th><th>strain from the shift</th><th>true strain</th></tr></thead>
    <tbody>
      {#each rows as r}
        <tr>
          <td>{r.label}</td>
          <td>{(r.shift * 1e12).toFixed(0)} pm</td>
          <td>{r.u === null ? '–' : `${(comp ? r.fixed : r.naive).toFixed(0)} µε`}</td>
          <td>{r.u === null ? '–' : `${r.truth.toFixed(0)} µε`}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .rig { width: 100%; max-height: 90px; }
  .wall { fill: var(--axis); }
  .beam { fill: var(--surface-3); stroke: var(--text-muted); }
  .fiber { fill: none; stroke: var(--cls-2); stroke-width: 1.5; }
  .grating { stroke-width: 1.5; stroke: var(--text-primary); }
  .lbl { font-size: 10px; fill: var(--text-secondary); }
  .check { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--text-secondary); }
  table { border-collapse: collapse; margin-top: 0.6rem; }
  th, td { padding: 0.15rem 1rem 0.15rem 0; text-align: left; }
  th { font-weight: 600; color: var(--text-secondary); }
</style>
