<script lang="ts">
  // Reading a thermistor with a voltage divider: the fixed resistor sets where the output is most linear, and the
  // supply voltage sets how much the thermistor heats itself.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { thermistorBeta } from '../lib/physics';
  import { app } from '../../lib/state.svelte';

  let logRf = $state(4); // 10 kΩ
  let Vs = $state(3.3);
  const Rf = $derived(10 ** logRf);
  const delta = 1.5e-3; // dissipation constant, W/°C (still air)
  const Ts = Array.from({ length: 201 }, (_, i) => i * 0.25); // 0–50 °C
  const vout = $derived(Ts.map((t) => (Vs * Rf) / (Rf + thermistorBeta(t))));
  // least-squares line over 0–50 °C
  const fit = $derived.by(() => {
    const n = Ts.length;
    const mx = Ts.reduce((a, b) => a + b, 0) / n;
    const my = vout.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0;
    Ts.forEach((t, i) => { sxy += (t - mx) * (vout[i] - my); sxx += (t - mx) ** 2; });
    const m = sxy / sxx;
    return { m, c: my - m * mx };
  });
  const line = $derived(Ts.map((t) => fit.m * t + fit.c));
  const nonlin = $derived(Math.max(...vout.map((v, i) => Math.abs(v - line[i]))) / fit.m);
  const selfHeat = $derived.by(() => {
    const R = thermistorBeta(25);
    const I = Vs / (Rf + R);
    return (I * I * R) / delta;
  });
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Fixed resistor <b>{(Rf / 1000).toFixed(2)} kΩ</b></span><input type="range" min="3" max="5" step="0.01" bind:value={logRf} /></label>
    <label class="control"><span>Supply voltage <b>{Vs.toFixed(1)} V</b></span><input type="range" min="0.5" max="5" step="0.1" bind:value={Vs} /></label>
  </div>
  <div class="layout">
    <svg viewBox="0 0 120 190" class="rig" role="img" aria-label="Voltage divider with a thermistor">
      <text x="60" y="12" text-anchor="middle" class="lbl">+{Vs.toFixed(1)} V</text>
      <line x1="60" y1="16" x2="60" y2="34" class="w" />
      <rect x="48" y="34" width="24" height="44" rx="3" class="ntc" />
      <line x1="44" y1="74" x2="76" y2="38" class="w" />
      <text x="80" y="60" class="lbl">NTC</text>
      <line x1="60" y1="78" x2="60" y2="106" class="w" />
      <circle cx="60" cy="92" r="3" class="node" />
      <line x1="60" y1="92" x2="100" y2="92" class="w" />
      <text x="96" y="86" class="lbl">V_out</text>
      <rect x="48" y="106" width="24" height="44" rx="3" class="rf" />
      <text x="80" y="132" class="lbl">R_f</text>
      <line x1="60" y1="150" x2="60" y2="172" class="w" />
      <text x="60" y="184" text-anchor="middle" class="lbl">0 V</text>
    </svg>
    <div class="right">
      <LineChart
        series={[
          { x: Ts, y: line, color: 'var(--text-muted)', width: 1.2, dash: [4, 3], label: 'straight-line fit' },
          { x: Ts, y: vout, color: 'var(--accent)', width: 2.2, label: 'V_out' },
        ]}
        xDomain={[0, 50]}
        yDomain={[0, 5]}
        height={app.mode === 'lecture' ? 230 : 200}
        xLabel="temperature (°C)"
        yLabel="output (V)"
        legend
        ariaLabel="Divider output vs temperature"
      />
      <div class="stats">
        <div class="stat"><span class="value num">{(fit.m * 1000).toFixed(1)} mV/°C</span><span class="label">average sensitivity</span></div>
        <div class="stat"><span class="value num">±{nonlin.toFixed(1)} °C</span><span class="label">worst deviation from a straight line, 0–50 °C</span></div>
        <div class="stat"><span class="value num" class:bad={selfHeat > 0.1}>{selfHeat.toFixed(2)} °C</span><span class="label">self-heating error at 25 °C (still air, 1.5 mW/°C)</span></div>
      </div>
    </div>
  </div>
</div>

<style>
  .layout { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 1rem; align-items: center; margin-top: 0.5rem; }
  .rig { width: 120px; }
  .w { stroke: var(--text-primary); stroke-width: 1.5; }
  .ntc { fill: var(--cls-2); }
  .rf { fill: var(--surface-3); stroke: var(--text-muted); }
  .node { fill: var(--text-primary); }
  .lbl { font-size: 10px; fill: var(--text-secondary); }
  .stats { display: flex; flex-wrap: wrap; gap: 0.6rem 1.6rem; margin-top: 0.4rem; }
  .bad { color: var(--critical); }
  @media (max-width: 640px) { .layout { grid-template-columns: minmax(0, 1fr); } .rig { margin: 0 auto; display: block; } }
</style>
