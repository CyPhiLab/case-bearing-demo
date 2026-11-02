<script lang="ts">
  // Quarter, half and full Wheatstone bridges: output, temperature compensation, axial rejection, and what the
  // amplifier and converter need to resolve the result.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import { bridgeArms, bridgeOutput, type BridgeKind } from '../lib/physics';
  import { app } from '../../lib/state.svelte';

  const GF = 2.0, Vex = 5, APP = 10e-6;
  const KIND: Record<BridgeKind, { label: string; k: number; roles: [string, string, string, string] }> = {
    quarter: { label: 'Quarter', k: 1, roles: ['T', 'R', 'R', 'R'] },
    dummy: { label: 'Quarter + dummy', k: 1, roles: ['T', 'D', 'R', 'R'] },
    half: { label: 'Half', k: 2, roles: ['T', 'B', 'R', 'R'] },
    full: { label: 'Full', k: 4, roles: ['T', 'B', 'T', 'B'] },
  };
  const ROLE: Record<string, string> = { T: 'gauge on top surface', B: 'gauge on bottom surface', D: 'unstrained dummy gauge', R: 'fixed resistor' };
  let kind = $state<BridgeKind>('quarter');
  let bend = $state(500); // µε
  let axial = $state(0); // µε
  let dT = $state(20); // °C
  let poorBond = $state(false);
  let gain = $state(100);
  let bits = $state(16);

  const load = $derived({ bend: bend * 1e-6, axial: axial * 1e-6, dT, GF, apparent: APP });
  const ratio = $derived(bridgeOutput(kind, load));
  const k = $derived(KIND[kind].k);
  const indicated = (r: number, kk: number) => ((4 * r) / (GF * kk)) * 1e6; // µε, using the small-strain bridge factor
  const fromT = $derived(indicated(bridgeOutput(kind, { ...load, bend: 0, axial: 0 }), k));
  const fromAx = $derived(indicated(bridgeOutput(kind, { ...load, bend: 0, dT: 0 }), k));
  const arms = $derived(bridgeArms(kind, load));

  // a day in the lab: the load is constant, the temperature rises by ΔT in the afternoon and falls again
  const hours = Array.from({ length: 241 }, (_, i) => i / 10);
  const day = (kk: BridgeKind) =>
    hours.map((t) => {
      const T = (dT * (1 - Math.cos((2 * Math.PI * t) / 24))) / 2;
      const transfer = poorBond ? 0.85 * (1 - 0.08 * (1 - Math.exp(-t / 5))) : 1;
      const l = { bend: bend * 1e-6 * transfer, axial: axial * 1e-6 * transfer, dT: T, GF, apparent: APP };
      return indicated(bridgeOutput(kk, l), KIND[kk].k);
    });
  const COLORS: Record<BridgeKind, string> = { quarter: 'var(--cls-2)', dummy: 'var(--cls-3)', half: 'var(--focus)', full: 'var(--accent)' };
  const series = $derived(
    (Object.keys(KIND) as BridgeKind[]).map((kk) => ({ x: hours, y: day(kk), color: COLORS[kk], width: kk === kind ? 3 : 1.2, label: KIND[kk].label })),
  );

  const lsbUe = $derived(((10 / 2 ** bits / gain / Vex) * 4) / (GF * k) * 1e6);
  // bridge drawing: arm i goes between these nodes (top +V, bottom 0, left A, right B)
  const N = { top: [120, 20], bot: [120, 180], A: [40, 100], B: [200, 100] };
  const ARM: [number[], number[]][] = [
    [N.A, N.bot],
    [N.top, N.A],
    [N.top, N.B],
    [N.B, N.bot],
  ];
</script>

<div class="card">
  <div class="controls">
    <Seg options={(Object.keys(KIND) as BridgeKind[]).map((v) => ({ value: v, label: KIND[v].label }))} bind:value={kind} label="Bridge configuration" />
  </div>
  <div class="controls" style="margin-top: 0.5rem">
    <label class="control"><span>Bending strain <b>{bend} µε</b></span><input type="range" min="0" max="1000" step="10" bind:value={bend} /></label>
    <label class="control"><span>Axial strain <b>{axial} µε</b></span><input type="range" min="0" max="500" step="10" bind:value={axial} /></label>
    <label class="control"><span>Temperature change ΔT <b>{dT} °C</b></span><input type="range" min="-20" max="40" step="1" bind:value={dT} /></label>
    <label class="check"><input type="checkbox" bind:checked={poorBond} /> poor adhesion</label>
  </div>
  <div class="layout">
    <svg viewBox="0 0 240 200" class="bridge" role="img" aria-label="Wheatstone bridge, {KIND[kind].label}">
      {#each ARM as [p, q], i}
        {@const role = KIND[kind].roles[i]}
        {@const mx = (p[0] + q[0]) / 2}
        {@const my = (p[1] + q[1]) / 2}
        <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} class="wire" />
        <g transform="translate({mx} {my}) rotate({(Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI})">
          <rect x="-20" y="-8" width="40" height="16" rx="3" class="res {role}" />
          <text y="4" text-anchor="middle" class="rl">{role}</text>
        </g>
        <text x={mx + (mx < 120 ? -34 : 34)} y={my + 4} text-anchor="middle" class="arm">R{i + 1}</text>
      {/each}
      {#each Object.values(N) as [x, y]}<circle cx={x} cy={y} r="3" class="node" />{/each}
      <text x="120" y="12" text-anchor="middle" class="lab">+{Vex} V</text>
      <text x="120" y="196" text-anchor="middle" class="lab">0 V</text>
      <text x="22" y="90" class="lab">A</text>
      <text x="210" y="90" class="lab">B</text>
      <text x="120" y="104" text-anchor="middle" class="lab out">V_out = V_A − V_B</text>
    </svg>
    <div class="read">
      <div class="stat"><span class="value num">{(ratio * Vex * 1000).toFixed(3)} mV</span><span class="label">bridge output ({(ratio * 1000).toFixed(3)} mV/V)</span></div>
      <div class="stat"><span class="value num">{indicated(ratio, k).toFixed(0)} µε</span><span class="label">indicated strain (true bending: {bend} µε)</span></div>
      <ul class="small secondary err">
        <li>from temperature: <b class="num">{fromT.toFixed(0)} µε</b></li>
        <li>from axial strain: <b class="num">{fromAx.toFixed(0)} µε</b></li>
        <li>arms ΔR/R (×10⁻⁶): <span class="num">{arms.map((a) => (a * 1e6).toFixed(0)).join(', ')}</span></li>
      </ul>
      <div class="small legend">
        {#each Object.entries(ROLE) as [r, d]}<span><b class="res-chip {r}">{r}</b> {d}</span>{/each}
      </div>
    </div>
  </div>
  <LineChart
    {series}
    xDomain={[0, 24]}
    yDomain={[-500, 2000]}
    height={app.mode === 'lecture' ? 240 : 200}
    xLabel="time of day (h); temperature peaks at 12 h"
    yLabel="indicated strain (µε)"
    legend
    markers={[{ x: 12, label: `ΔT = ${dT} °C`, color: 'var(--text-muted)', dash: true }]}
    ariaLabel="Indicated strain over a day for each bridge"
  />
  <div class="adc">
    <span class="small"><b>Amplifier and converter.</b> Gain</span>
    <Seg options={[1, 10, 100, 1000].map((v) => ({ value: v, label: `×${v}` }))} bind:value={gain} label="Amplifier gain" />
    <span class="small">ADC (±5 V)</span>
    <Seg options={[12, 16, 24].map((v) => ({ value: v, label: `${v} bit` }))} bind:value={bits} label="ADC bits" />
    <span class="small">one ADC step = <b class="num">{lsbUe < 1 ? lsbUe.toFixed(3) : lsbUe.toFixed(1)} µε</b>
      {#if Math.abs(ratio * Vex * gain) > 5}<span class="warn">: amplifier output exceeds ±5 V</span>{/if}</span>
  </div>
</div>

<style>
  .layout { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 1rem; align-items: center; margin: 0.6rem 0; }
  .bridge { width: 100%; max-width: 240px; }
  .wire { stroke: var(--text-muted); stroke-width: 1.5; }
  .res { fill: var(--surface-1); stroke: var(--text-muted); stroke-width: 1.2; }
  .res.T, .res-chip.T { fill: var(--cls-2); background: var(--cls-2); }
  .res.B, .res-chip.B { fill: var(--accent); background: var(--accent); }
  .res.D, .res-chip.D { fill: var(--cls-3); background: var(--cls-3); }
  .res-chip.R { background: var(--surface-3); color: var(--text-primary) !important; }
  .res-chip { color: #fff; border-radius: 3px; padding: 0 0.35em; font-size: 0.75rem; }
  .rl { font-size: 11px; font-weight: 700; fill: var(--text-primary); }
  .res.T + .rl, .res.B + .rl, .res.D + .rl { fill: #fff; }
  .arm { font-size: 10px; fill: var(--text-muted); }
  .node { fill: var(--text-primary); }
  .lab { font-size: 11px; fill: var(--text-secondary); }
  .out { font-weight: 600; fill: var(--text-primary); }
  .read { display: grid; gap: 0.6rem; }
  .err { margin: 0; padding-left: 1.1rem; }
  .legend { display: flex; flex-wrap: wrap; gap: 0.3rem 0.9rem; color: var(--text-secondary); }
  .check { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--text-secondary); }
  .adc { display: flex; flex-wrap: wrap; gap: 0.4rem 0.7rem; align-items: center; margin-top: 0.8rem; padding-top: 0.7rem; border-top: 1px solid var(--grid); }
  .warn { color: var(--critical); font-weight: 600; }
  @media (max-width: 640px) { .layout { grid-template-columns: minmax(0, 1fr); } .bridge { margin: 0 auto; display: block; } }
</style>
