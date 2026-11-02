<script lang="ts">
  // Stretchable sensors: a conductive elastomer (resistive, R ≈ R₀λ²) and an elastomer capacitor (C ≈ C₀λ). The
  // rubbery material relaxes slowly, so loading and unloading follow different curves (hysteresis), and
  // resistive composites drift with repeated cycles.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import { app } from '../../lib/state.svelte';

  let kind = $state<'res' | 'cap'>('res');
  let lmax = $state(1.6);
  let tauV = $state(0.1); // s, viscoelastic lag
  let drift = $state(0.06); // fractional baseline change over the test
  const T = 6, n = 1200, dt = T / n, P = 2;
  const t = Array.from({ length: n }, (_, i) => i * dt);
  const lam = $derived(t.map((s) => 1 + (lmax - 1) * (1 - Math.abs(((s / P) % 1) * 2 - 1))));
  const out = $derived.by(() => {
    const tau = kind === 'cap' ? tauV / 4 : tauV;
    let le = 1;
    return lam.map((l, i) => {
      le += (dt / Math.max(tau, 1e-6)) * (l - le) * (tau > 0 ? 1 : 0);
      if (tau === 0) le = l;
      const base = kind === 'res' ? 1 + drift * (t[i] / T) : 1;
      return kind === 'res' ? base * le * le : le;
    });
  });
  const ideal = $derived(lam.map((l) => (kind === 'res' ? l * l : l)));
  // hysteresis: largest gap between loading and unloading at the same stretch, in the first cycle
  const hyst = $derived.by(() => {
    const up: number[] = [], dn: number[] = [];
    const half = n / (T / P) / 2;
    for (let i = 0; i < half; i++) up.push(out[i]);
    for (let i = half; i < 2 * half; i++) dn.push(out[i]);
    let worst = 0;
    for (let i = 0; i < up.length; i++) worst = Math.max(worst, Math.abs(dn[up.length - 1 - i] - up[i]));
    const span = Math.max(...ideal) - 1;
    return (worst / span) * 100;
  });
</script>

<div class="card">
  <div class="controls">
    <Seg options={[{ value: 'res' as const, label: 'Resistive' }, { value: 'cap' as const, label: 'Capacitive' }]} bind:value={kind} label="Sensor type" />
    <label class="control"><span>Maximum stretch λ <b>{lmax.toFixed(2)}</b></span><input type="range" min="1.1" max="2" step="0.01" bind:value={lmax} /></label>
    <label class="control"><span>Material relaxation time <b>{tauV.toFixed(2)} s</b></span><input type="range" min="0" max="0.5" step="0.01" bind:value={tauV} /></label>
    {#if kind === 'res'}<label class="control"><span>Drift over 3 cycles <b>{(drift * 100).toFixed(0)} %</b></span><input type="range" min="0" max="0.2" step="0.01" bind:value={drift} /></label>{/if}
  </div>
  <svg viewBox="0 0 440 70" class="strip" role="img" aria-label="Stretchable sensor strip">
    <rect x="20" y="22" width={(400 / 2) * lmax} height={26 / Math.sqrt(lmax)} rx="6" class="rubber" transform="translate(0 {13 - 13 / Math.sqrt(lmax)})" />
    {#if kind === 'res'}
      <path d="M30,35 h{(400 / 2) * lmax - 20}" class="trace" />
    {:else}
      <rect x="30" y={28 + 7 - 7 / Math.sqrt(lmax)} width={(400 / 2) * lmax - 20} height="3" class="elec" />
      <rect x="30" y={39 - 7 + 7 / Math.sqrt(lmax)} width={(400 / 2) * lmax - 20} height="3" class="elec" />
    {/if}
    <text x="20" y="66" class="lbl">stretched to λ = {lmax.toFixed(2)}: longer, narrower and thinner (the volume of the rubber stays the same)</text>
  </svg>
  <div class="grid-2">
    <LineChart
      series={[
        { x: lam, y: ideal, color: 'var(--text-muted)', width: 1.2, dash: [4, 3], label: kind === 'res' ? 'R₀λ²' : 'C₀λ' },
        { x: lam, y: out, color: 'var(--cls-2)', width: 1.8, label: 'measured, 3 cycles' },
      ]}
      xDomain={[1, 2]}
      yDomain={kind === 'res' ? [0.8, 5] : [0.8, 2.2]}
      height={app.mode === 'lecture' ? 230 : 200}
      xLabel="stretch λ"
      yLabel={kind === 'res' ? 'R / R₀' : 'C / C₀'}
      legend
      ariaLabel="Sensor output vs stretch"
    />
    <LineChart
      series={[
        { x: t, y: ideal, color: 'var(--text-muted)', width: 1.2, dash: [4, 3], label: 'without relaxation' },
        { x: t, y: out, color: 'var(--cls-2)', width: 1.8, label: 'measured' },
      ]}
      xDomain={[0, T]}
      yDomain={kind === 'res' ? [0.8, 5] : [0.8, 2.2]}
      height={app.mode === 'lecture' ? 230 : 200}
      xLabel="time (s)"
      yLabel={kind === 'res' ? 'R / R₀' : 'C / C₀'}
      legend
      ariaLabel="Sensor output vs time"
    />
  </div>
  <p class="small secondary">
    Hysteresis in the first cycle: <b class="num">{hyst.toFixed(1)} %</b> of full scale. Capacitive soft sensors usually show less hysteresis
    and drift than resistive composites, at the cost of a smaller signal and more complex electronics.
  </p>
</div>

<style>
  .strip { width: 100%; max-height: 90px; }
  .rubber { fill: color-mix(in srgb, var(--cls-3) 30%, var(--surface-2)); stroke: var(--cls-3); }
  .trace { stroke: var(--text-primary); stroke-width: 2.5; stroke-dasharray: 5 2; }
  .elec { fill: var(--text-secondary); }
  .lbl { font-size: 11px; fill: var(--text-muted); }
</style>
