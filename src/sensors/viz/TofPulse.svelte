<script lang="ts">
  // Time of flight: pulsed (measure the delay of the echo) and phase-shift (measure the phase of a modulated beam,
  // which wraps every c/2f of distance).
  import LineChart from '../../lib/charts/LineChart.svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import { gaussian } from '../../lib/dsp/signals';
  import { C_LIGHT, tofAmbiguity, tofPhaseReading, tofTime } from '../lib/physics';
  import { app } from '../../lib/state.svelte';

  let mode = $state<'pulse' | 'phase'>('pulse');
  let d = $state(3); // m
  let res = $state(100); // timing resolution, ps
  let fmod = $state(20); // MHz

  // pulsed: time axis in ns
  const tn = Array.from({ length: 1600 }, (_, i) => i * 0.05);
  const noise = gaussian(tn.length, 0.02, 4);
  const delay = $derived(tofTime(d) * 1e9);
  const pulse = (t: number, t0: number) => Math.exp(-(((t - t0) / 1.2) ** 2));
  const tx = tn.map((t) => pulse(t, 5));
  const rx = $derived(tn.map((t, i) => Math.min(1, 1.5 / Math.max(d, 1) ** 2) * pulse(t, 5 + delay) + noise[i]));

  // phase shift: two modulation periods
  const amb = $derived(tofAmbiguity(fmod * 1e6));
  const phase = $derived(((4 * Math.PI * fmod * 1e6 * d) / C_LIGHT) % (2 * Math.PI));
  const tp = Array.from({ length: 600 }, (_, i) => i / 299); // periods
  const em = tp.map((p) => Math.sin(2 * Math.PI * p));
  const re = $derived(tp.map((p) => 0.6 * Math.sin(2 * Math.PI * p - phase)));
  const ds = Array.from({ length: 801 }, (_, i) => (i / 800) * 40);
  const reading = $derived(ds.map((x) => tofPhaseReading(x, fmod * 1e6)));
</script>

<div class="card">
  <div class="controls">
    <Seg options={[{ value: 'pulse' as const, label: 'Pulsed' }, { value: 'phase' as const, label: 'Phase shift' }]} bind:value={mode} label="Method" />
    {#if mode === 'pulse'}
      <label class="control"><span>Distance <b>{d.toFixed(2)} m</b></span><input type="range" min="0.2" max="10" step="0.01" bind:value={d} /></label>
      <label class="control"><span>Timing resolution <b>{res} ps</b></span><input type="range" min="10" max="1000" step="10" bind:value={res} /></label>
    {:else}
      <label class="control"><span>Distance <b>{d.toFixed(2)} m</b></span><input type="range" min="0.2" max="40" step="0.05" bind:value={d} /></label>
      <label class="control"><span>Modulation frequency <b>{fmod} MHz</b></span><input type="range" min="2" max="100" step="1" bind:value={fmod} /></label>
    {/if}
  </div>
  {#if mode === 'pulse'}
    <LineChart
      series={[
        { x: tn, y: tx, color: 'var(--text-muted)', width: 1.5, label: 'emitted pulse' },
        { x: tn, y: rx, color: 'var(--accent)', width: 1.5, label: 'echo at the detector' },
      ]}
      xDomain={[0, 80]}
      yDomain={[-0.2, 1.1]}
      height={app.mode === 'lecture' ? 230 : 190}
      xLabel="time (ns)"
      yLabel="light intensity"
      legend
      markers={[{ x: 5 + delay, label: `Δt = ${delay.toFixed(2)} ns`, color: 'var(--cls-2)', dash: true }]}
      ariaLabel="Emitted and returned pulse"
    />
    <p class="small secondary">
      Round trip <b class="num">Δt = 2d/c = {delay.toFixed(3)} ns</b>. With {res} ps timing resolution, the distance resolution is
      c·δt/2 = <b class="num">{((C_LIGHT * res * 1e-12) / 2 * 100).toFixed(1)} cm</b>. The echo also weakens with distance, roughly as 1/d²
      for a small target, which limits the range.
    </p>
  {:else}
    <div class="grid-2">
      <LineChart
        series={[
          { x: tp, y: em, color: 'var(--text-muted)', width: 1.5, label: 'emitted modulation' },
          { x: tp, y: re, color: 'var(--accent)', width: 1.8, label: 'received' },
        ]}
        xDomain={[0, 2]}
        yDomain={[-1.2, 1.4]}
        height={app.mode === 'lecture' ? 220 : 180}
        xLabel="time (modulation periods)"
        yLabel="intensity"
        legend
        ariaLabel="Emitted and received modulation"
      />
      <LineChart
        series={[
          { x: ds, y: ds, color: 'var(--text-muted)', width: 1, dash: [4, 3], label: 'true' },
          { x: ds, y: reading, color: 'var(--accent)', width: 1.8, label: 'reported' },
        ]}
        xDomain={[0, 40]}
        yDomain={[0, 40]}
        height={app.mode === 'lecture' ? 220 : 180}
        xLabel="true distance (m)"
        yLabel="reported distance (m)"
        legend
        markers={[{ x: d, color: 'var(--cls-2)', dash: true }]}
        ariaLabel="Reported vs true distance"
      />
    </div>
    <p class="small secondary">
      Phase shift <b class="num">{((phase * 180) / Math.PI).toFixed(0)}°</b> → reported distance <b class="num">{tofPhaseReading(d, fmod * 1e6).toFixed(2)} m</b>.
      The phase repeats every <b class="num">c/2f = {amb.toFixed(2)} m</b>, so anything farther looks closer. A higher modulation frequency
      resolves smaller distances but shortens this unambiguous range; sensors combine two frequencies to get both.
    </p>
  {/if}
</div>
