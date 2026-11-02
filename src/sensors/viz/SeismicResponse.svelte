<script lang="ts">
  // Base-excited mass–spring–damper: the same instrument is an accelerometer below its natural frequency and a
  // displacement sensor (seismometer) far above it.
  import { onDestroy, onMount } from 'svelte';
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { seismic } from '../lib/physics';
  import { app } from '../../lib/state.svelte';

  let zeta = $state(0.7);
  let logr = $state(Math.log10(0.3));
  const r = $derived(10 ** logr);
  const rs = Array.from({ length: 300 }, (_, i) => 10 ** (-1.3 + (i / 299) * 2.6));
  const acc = $derived(rs.map((x) => seismic(x, zeta).accel));
  const dsp = $derived(rs.map((x) => seismic(x, zeta).disp));
  const here = $derived(seismic(r, zeta));

  // animation at a fixed visual rate; amplitudes and phase come from the model
  let ph = $state(0);
  let raf = 0;
  onMount(() => {
    let last = performance.now();
    const tick = (now: number) => {
      ph += ((now - last) / 1000) * 2 * Math.PI * 0.6;
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
  onDestroy(() => cancelAnimationFrame(raf));
  const Y = 14; // base displacement amplitude, px
  const base = $derived(Y * Math.sin(ph));
  // relative displacement z = x − y lags; its amplitude relative to Y is the displacement ratio
  const rel = $derived(Math.min(30, Y * here.disp) * Math.sin(ph - here.phase));
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Frequency ratio f/fₙ <b>{r.toFixed(2)}</b></span><input type="range" min="-1.3" max="1.3" step="0.01" bind:value={logr} /></label>
    <label class="control"><span>Damping ratio ζ <b>{zeta.toFixed(2)}</b></span><input type="range" min="0.02" max="1" step="0.01" bind:value={zeta} /></label>
  </div>
  <div class="layout">
    <svg viewBox="0 0 150 230" class="rig" role="img" aria-label="Seismic instrument on a vibrating base">
      <g transform="translate(0 {base})">
        <rect x="20" y="20" width="110" height="170" rx="6" class="case" />
        <rect x="20" y="190" width="110" height="10" class="basebar" />
        {#each { length: 9 } as _, i}<line x1="40" x2="52" y1={30 + i * 15} y2={30 + i * 15} class="tick" />{/each}
        <line x1="36" x2="56" y1="90" y2="90" class="tick0" />
        <path d={`M75,190 ${Array.from({ length: 10 }, (_, i) => `L${i % 2 ? 62 : 88},${190 - ((190 - (118 + rel)) * (i + 0.5)) / 10}`).join(' ')} L75,${118 + rel}`} class="spring" />
        <rect x="104" y={120 + rel} width="10" height={190 - 120 - rel} class="damper" />
        <rect x="55" y={78 + rel} width="60" height="40" rx="4" class="mass" />
        <line x1="52" x2="62" y1={98 + rel} y2={98 + rel} class="pointer" />
        <text x="85" y={102 + rel} text-anchor="middle" class="ml">m</text>
      </g>
      <text x="75" y="226" text-anchor="middle" class="lbl">base moves ↕</text>
    </svg>
    <div class="right">
      <LineChart
        series={[
          { x: rs, y: acc, color: 'var(--accent)', width: 2.2, label: 'relative motion × ωₙ² / base acceleration' },
          { x: rs, y: dsp, color: 'var(--cls-2)', width: 2.2, label: 'relative motion / base displacement' },
        ]}
        logX
        logY
        xDomain={[0.05, 20]}
        yDomain={[0.01, 30]}
        height={app.mode === 'lecture' ? 260 : 220}
        xLabel="frequency ratio f/fₙ"
        yLabel="amplitude ratio"
        legend
        bands={[
          { x0: 0.05, x1: 0.3, fill: 'color-mix(in srgb, var(--accent) 10%, transparent)' },
          { x0: 3, x1: 20, fill: 'color-mix(in srgb, var(--cls-2) 10%, transparent)' },
        ]}
        markers={[{ x: r, color: 'var(--text-primary)', dash: true }]}
        ariaLabel="Seismic instrument frequency response"
      />
      <p class="small secondary">
        Shaded: the accelerometer region (left) and the seismometer region (right). At f/fₙ = {r.toFixed(2)}: an accelerometer reading would be off by <b class="num">{((here.accel - 1) * 100).toFixed(1)} %</b> with a phase lag
        of <b class="num">{((here.phase * 180) / Math.PI).toFixed(0)}°</b>.
      </p>
    </div>
  </div>
</div>

<style>
  .layout { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 1rem; align-items: start; margin-top: 0.5rem; }
  .rig { width: 150px; overflow: visible; }
  .case { fill: none; stroke: var(--text-muted); stroke-width: 2; }
  .basebar { fill: var(--axis); }
  .tick { stroke: var(--text-muted); }
  .tick0 { stroke: var(--text-primary); stroke-width: 1.5; }
  .spring { fill: none; stroke: var(--text-secondary); stroke-width: 2; stroke-linejoin: round; }
  .damper { fill: var(--surface-3); stroke: var(--text-muted); }
  .mass { fill: var(--accent); }
  .ml { fill: #fff; font-weight: 700; font-size: 14px; }
  .pointer { stroke: var(--cls-2); stroke-width: 3; }
  .lbl { font-size: 11px; fill: var(--text-muted); }
  @media (max-width: 640px) { .layout { grid-template-columns: minmax(0, 1fr); } .rig { margin: 0 auto; display: block; } }
</style>
