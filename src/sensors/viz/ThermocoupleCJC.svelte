<script lang="ts">
  // A type K thermocouple: the voltmeter sees E(T_hot) − E(T_ref), where the reference junction is wherever the
  // thermocouple wires meet the copper of the instrument. Cold-junction compensation adds E(T_ref) back.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { typeK, typeKInverse } from '../lib/physics';
  import { app } from '../../lib/state.svelte';

  let Th = $state(300);
  let Tr = $state(25);
  let cjc = $state(true);
  const V = $derived(typeK(Th) - typeK(Tr));
  const reading = $derived(cjc ? typeKInverse(V + typeK(Tr)) : typeKInverse(V));
  const linear = $derived((V * 1000) / 41 + (cjc ? Tr : 0)); // a constant 41 µV/°C instead of the NIST curve
  const Ts = Array.from({ length: 300 }, (_, i) => -200 + (i / 299) * 1500);
  const E = Ts.map(typeK);
  const seebeck = Ts.map((T) => (typeK(T + 0.5) - typeK(T - 0.5)) * 1000);
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Measuring junction <b>{Th} °C</b></span><input type="range" min="-150" max="1250" step="5" bind:value={Th} /></label>
    <label class="control"><span>Reference junction (terminals) <b>{Tr} °C</b></span><input type="range" min="0" max="50" step="1" bind:value={Tr} /></label>
    <label class="check"><input type="checkbox" bind:checked={cjc} /> cold-junction compensation</label>
  </div>
  <div class="layout">
    <svg viewBox="0 0 330 150" class="rig" role="img" aria-label="Thermocouple circuit">
      <path d="M40,75 C80,40 140,40 200,50" class="w chromel" />
      <path d="M40,75 C80,110 140,110 200,100" class="w alumel" />
      <circle cx="40" cy="75" r="6" class="junction" />
      <text x="40" y="100" text-anchor="middle" class="lbl">{Th} °C</text>
      <rect x="196" y="36" width="34" height="78" rx="4" class="block" />
      <text x="213" y="128" text-anchor="middle" class="lbl">{Tr} °C</text>
      <path d="M230,50 H270 V60" class="w cu" />
      <path d="M230,100 H270 V90" class="w cu" />
      <circle cx="270" cy="75" r="18" class="meter" />
      <text x="270" y="79" text-anchor="middle" class="ml">V</text>
      <text x="120" y="36" text-anchor="middle" class="lbl chromel-t">chromel (+)</text>
      <text x="120" y="122" text-anchor="middle" class="lbl alumel-t">alumel (−)</text>
      <text x="213" y="26" text-anchor="middle" class="lbl">terminal block</text>
      <text x="250" y="128" text-anchor="middle" class="lbl">copper leads</text>
    </svg>
    <div class="read">
      <div class="stat"><span class="value num">{V.toFixed(3)} mV</span><span class="label">voltage at the meter, E(T_hot) − E(T_ref)</span></div>
      <div class="stat"><span class="value num" class:bad={Math.abs(reading - Th) > 1}>{reading.toFixed(1)} °C</span><span class="label">reading {cjc ? 'with' : 'without'} cold-junction compensation</span></div>
      <div class="stat"><span class="value num">{linear.toFixed(1)} °C</span><span class="label">with a constant 41 µV/°C instead of the NIST table</span></div>
    </div>
  </div>
  <div class="grid-2">
    <LineChart
      series={[{ x: Ts, y: E, color: 'var(--accent)', width: 2 }]}
      xDomain={[-200, 1300]}
      yDomain={[-8, 55]}
      height={app.mode === 'lecture' ? 210 : 180}
      xLabel="temperature (°C), reference at 0 °C"
      yLabel="EMF (mV)"
      markers={[{ x: Th, color: 'var(--cls-2)', dash: true }]}
      ariaLabel="Type K EMF"
    />
    <LineChart
      series={[{ x: Ts, y: seebeck, color: 'var(--cls-2)', width: 2 }]}
      xDomain={[-200, 1300]}
      yDomain={[0, 50]}
      height={app.mode === 'lecture' ? 210 : 180}
      xLabel="temperature (°C)"
      yLabel="sensitivity (µV/°C)"
      markers={[{ x: Th, color: 'var(--text-muted)', dash: true }]}
      ariaLabel="Type K Seebeck coefficient"
    />
  </div>
</div>

<style>
  .layout { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 1rem; align-items: center; margin: 0.5rem 0; }
  .rig { width: 100%; max-width: 440px; }
  .w { fill: none; stroke-width: 3; }
  .chromel { stroke: #d4a017; }
  .alumel { stroke: var(--critical); }
  .cu { stroke: #b87333; }
  .chromel-t { fill: #b8860b; }
  .alumel-t { fill: var(--critical); }
  .junction { fill: var(--cls-2); }
  .block { fill: var(--surface-3); stroke: var(--text-muted); }
  .meter { fill: var(--surface-1); stroke: var(--text-primary); stroke-width: 1.5; }
  .ml { font-weight: 700; font-size: 13px; fill: var(--text-primary); }
  .lbl { font-size: 10px; fill: var(--text-secondary); }
  .read { display: grid; gap: 0.6rem; }
  .bad { color: var(--critical); }
  .check { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--text-secondary); }
  @media (max-width: 640px) { .layout { grid-template-columns: minmax(0, 1fr); } }
</style>
