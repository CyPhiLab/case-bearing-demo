<script lang="ts">
  // First-order response of a thermocouple bead: τ = ρ c d / (6 h). Step input (plunge into hot water) and a
  // sinusoidally varying temperature.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import { beadTau } from '../lib/physics';
  import { app } from '../../lib/state.svelte';

  const MED = {
    still: { h: 10, label: 'Still air' },
    moving: { h: 100, label: 'Moving air' },
    water: { h: 3000, label: 'Stirred water' },
  } as const;
  let med = $state<keyof typeof MED>('water');
  let d = $state(1); // mm
  let mode = $state<'step' | 'sine'>('step');
  let logf = $state(0); // log10 Hz
  const tau = $derived(beadTau(d / 1000, MED[med].h));
  const ts = Array.from({ length: 500 }, (_, i) => 10 ** (-3 + (i / 499) * 6));
  const step = $derived(ts.map((t) => 20 + 80 * (1 - Math.exp(-t / tau))));
  const f = $derived(10 ** logf);
  const ratio = $derived(1 / Math.hypot(1, 2 * Math.PI * f * tau));
  const lag = $derived(Math.atan(2 * Math.PI * f * tau));
  const tp = Array.from({ length: 600 }, (_, i) => (i / 599) * 3);
  const input = tp.map((p) => 60 + 20 * Math.sin(2 * Math.PI * p));
  const output = $derived(tp.map((p) => 60 + 20 * ratio * Math.sin(2 * Math.PI * p - lag)));
  const fmtT = (s: number) => (s < 1 ? `${(s * 1000).toFixed(0)} ms` : `${s.toFixed(s < 10 ? 2 : 0)} s`);
</script>

<div class="card">
  <div class="controls">
    <Seg options={Object.entries(MED).map(([value, m]) => ({ value: value as keyof typeof MED, label: m.label }))} bind:value={med} label="Medium" />
    <label class="control"><span>Bead diameter <b>{d.toFixed(2)} mm</b></span><input type="range" min="0.05" max="3" step="0.05" bind:value={d} /></label>
    <Seg options={[{ value: 'step' as const, label: 'Step (plunge)' }, { value: 'sine' as const, label: 'Fluctuating' }]} bind:value={mode} label="Input" />
    {#if mode === 'sine'}
      <label class="control"><span>Fluctuation frequency <b>{f < 1 ? f.toFixed(3) : f.toFixed(1)} Hz</b></span><input type="range" min="-3" max="1" step="0.01" bind:value={logf} /></label>
    {/if}
  </div>
  {#if mode === 'step'}
    <LineChart
      series={[
        { x: ts, y: ts.map(() => 100), color: 'var(--text-muted)', width: 1.2, dash: [4, 3], label: 'water temperature' },
        { x: ts, y: step, color: 'var(--accent)', width: 2.2, label: 'thermocouple reading' },
      ]}
      logX
      xDomain={[1e-3, 1e3]}
      yDomain={[10, 110]}
      height={app.mode === 'lecture' ? 240 : 200}
      xLabel="time after plunging (s, log scale)"
      yLabel="temperature (°C)"
      legend
      markers={[{ x: tau, label: `τ = ${fmtT(tau)}`, color: 'var(--cls-2)', dash: true }]}
      ariaLabel="Step response"
    />
    <p class="small secondary">
      Time constant <b class="num">τ = ρcd/6h = {fmtT(tau)}</b>. After one τ the reading has covered 63 % of the step, after 5τ more than 99 %.
      A ten times smaller bead responds ten times faster; the same bead responds about 300 times faster in stirred water than in still air.
    </p>
  {:else}
    <LineChart
      series={[
        { x: tp, y: input, color: 'var(--text-muted)', width: 1.4, dash: [4, 3], label: 'actual temperature' },
        { x: tp, y: output, color: 'var(--accent)', width: 2.2, label: 'thermocouple reading' },
      ]}
      xDomain={[0, 3]}
      yDomain={[30, 90]}
      height={app.mode === 'lecture' ? 240 : 200}
      xLabel="time (periods of the fluctuation)"
      yLabel="temperature (°C)"
      legend
      ariaLabel="Response to a fluctuating temperature"
    />
    <p class="small secondary">
      Amplitude ratio <b class="num">1/√(1 + (ωτ)²) = {ratio.toFixed(3)}</b>, phase lag <b class="num">{((lag * 180) / Math.PI).toFixed(0)}°</b>
      (time lag {fmtT(lag / (2 * Math.PI * f))}). Fluctuations much faster than 1/(2πτ) = {(1 / (2 * Math.PI * tau)).toFixed(3)} Hz are strongly attenuated.
    </p>
  {/if}
</div>
