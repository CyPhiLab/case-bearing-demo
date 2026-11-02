<script lang="ts">
  // A cantilever with a foil gauge on the top surface and one underneath: ε = 6F(L − x)/(E b h²), ΔR/R = GF·ε.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import { MATERIALS, type Material } from '../../lib/beam';
  import { cantileverStrain } from '../lib/physics';
  import { app } from '../../lib/state.svelte';

  const L = 0.3, b = 0.025, h = 0.003, GF = 2.0, R0 = 350;
  let mat = $state<Material>('steel');
  let F = $state(20); // N
  let xg = $state(0.2); // gauge position, x/L
  const E = $derived(MATERIALS[mat].E);
  const eps = $derived(cantileverStrain(F, L, xg * L, E, b, h));
  const dR = $derived(R0 * GF * eps);
  const xs = Array.from({ length: 101 }, (_, i) => i / 100);
  const profile = $derived(xs.map((u) => cantileverStrain(F, L, u * L, E, b, h) * 1e6));

  // exaggerated deflection for the drawing: w(x) = F x²(3L − x)/(6EI)
  const I = (b * h ** 3) / 12;
  const wTipMax = (30 * L ** 3) / (3 * 69e9 * I);
  const X0 = 40, X1 = 400, Y0 = 60;
  const defl = (u: number) => (F * (u * L) ** 2 * (3 * L - u * L)) / (6 * E * I) / wTipMax * 50;
  const beamTop = $derived(xs.map((u) => `${X0 + u * (X1 - X0)},${Y0 + defl(u)}`).join(' '));
  const beamBot = $derived(xs.slice().reverse().map((u) => `${X0 + u * (X1 - X0)},${Y0 + 12 + defl(u)}`).join(' '));
  const gx = $derived(X0 + xg * (X1 - X0));
  const gy = $derived(Y0 + defl(xg));
  const stretch = $derived(1 + eps * 60); // drawn grid stretch, exaggerated
</script>

<div class="card">
  <div class="controls">
    <Seg options={Object.entries(MATERIALS).map(([value, m]) => ({ value: value as Material, label: m.label }))} bind:value={mat} label="Beam material" />
    <label class="control"><span>Tip load F <b>{F.toFixed(0)} N</b></span><input type="range" min="0" max="30" step="1" bind:value={F} /></label>
    <label class="control"><span>Gauge position x/L <b>{xg.toFixed(2)}</b></span><input type="range" min="0.05" max="0.9" step="0.01" bind:value={xg} /></label>
  </div>
  <svg viewBox="0 0 440 140" class="rig" role="img" aria-label="Cantilever with strain gauges">
    <rect x="20" y="30" width="20" height="80" class="wall" />
    <polygon points="{beamTop} {beamBot}" class="beam" />
    <g transform="translate({gx} {gy - 3}) scale({stretch} 1)">
      <rect x="-14" y="-4" width="28" height="5" class="gauge" />
      <path d="M-11,-3 V0 M-7,-3 V0 M-3,-3 V0 M1,-3 V0 M5,-3 V0 M9,-3 V0" class="grid" />
    </g>
    <g transform="translate({gx} {gy + 15}) scale({2 - stretch} 1)">
      <rect x="-14" y="0" width="28" height="5" class="gauge bot" />
    </g>
    <line x1={X1} x2={X1} y1={Y0 + defl(1) - 30} y2={Y0 + defl(1) - 4} class="arrow" marker-end="url(#ah)" />
    <text x={X1 + 6} y={Y0 + defl(1) - 22} class="lbl">F</text>
    <text x={gx} y={gy - 12} text-anchor="middle" class="lbl">top gauge: +{(eps * 1e6).toFixed(0)} µε</text>
    <text x={gx} y={gy + 34} text-anchor="middle" class="lbl muted">bottom gauge: −{(eps * 1e6).toFixed(0)} µε</text>
    <defs><marker id="ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="ahead" /></marker></defs>
  </svg>
  <div class="grid-2">
    <LineChart
      series={[{ x: xs, y: profile, color: 'var(--accent)', width: 2, fill: true }]}
      xDomain={[0, 1]}
      yDomain={[0, 3200]}
      height={app.mode === 'lecture' ? 200 : 170}
      xLabel="position along the beam x/L"
      yLabel="surface strain (µε)"
      markers={[{ x: xg, label: 'gauge', color: 'var(--cls-2)' }]}
      ariaLabel="Strain along the beam"
    />
    <div class="stats">
      <div class="stat"><span class="value num">{(eps * 1e6).toFixed(0)} µε</span><span class="label">strain at the gauge ({(eps * 100).toFixed(3)} % stretch)</span></div>
      <div class="stat"><span class="value num">{dR.toFixed(3)} Ω</span><span class="label">change in a {R0} Ω gauge (GF = {GF})</span></div>
      <div class="stat"><span class="value num">{((dR / R0) * 100).toFixed(4)} %</span><span class="label">fractional change ΔR/R</span></div>
    </div>
  </div>
</div>

<style>
  .rig { width: 100%; max-height: 200px; margin: 0.4rem 0; }
  .wall { fill: var(--axis); }
  .beam { fill: var(--surface-3); stroke: var(--text-muted); stroke-width: 1; }
  .gauge { fill: var(--cls-2); opacity: 0.9; }
  .gauge.bot { fill: var(--accent); }
  .grid { stroke: #fff; stroke-width: 0.8; }
  .arrow { stroke: var(--text-primary); stroke-width: 2; }
  .ahead { fill: var(--text-primary); }
  .lbl { font-size: 11px; fill: var(--text-secondary); }
  .stats { display: grid; gap: 0.8rem; align-content: center; }
</style>
