<script lang="ts">
  // Coriolis vibratory gyroscope (top view): a mass is driven back and forth along x; when the chip rotates at Ω
  // the Coriolis acceleration −2Ω×v pushes it along y. The y motion is proportional to Ω.
  import { onDestroy, onMount } from 'svelte';
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { app } from '../../lib/state.svelte';

  let omega = $state(100); // deg/s
  // real-device numbers for the readout
  const A = 10e-6, fd = 20e3;
  const v = 2 * Math.PI * fd * A;
  const ac = $derived(2 * ((omega * Math.PI) / 180) * v);

  let t = $state(0);
  let raf = 0;
  onMount(() => {
    let last = performance.now();
    const tick = (now: number) => {
      t += (now - last) / 1000;
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
  onDestroy(() => cancelAnimationFrame(raf));
  const wd = 2 * Math.PI * 0.8; // visual drive frequency
  const AX = 45; // drawn drive amplitude
  const K = 0.18; // drawn sense amplitude per deg/s
  const xd = $derived(AX * Math.sin(wd * t));
  const ys = $derived(-K * omega * Math.cos(wd * t)); // in phase with drive velocity
  const frameAngle = $derived(((omega / 300) * 25 * t) % 360); // slowed rotation of the chip

  const tt = Array.from({ length: 400 }, (_, i) => (i / 399) * 3);
  const drive = tt.map((s) => Math.sin(2 * Math.PI * s));
  const sense = $derived(tt.map((s) => (-omega / 300) * Math.cos(2 * Math.PI * s)));
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Rotation rate Ω <b>{omega} °/s</b></span><input type="range" min="-300" max="300" step="5" bind:value={omega} /></label>
  </div>
  <div class="layout">
    <svg viewBox="-110 -110 220 220" class="rig" role="img" aria-label="Vibratory gyroscope, top view">
      <g transform="rotate({frameAngle})">
        <rect x="-95" y="-95" width="190" height="190" rx="8" class="frame" />
        <line x1="-80" x2="80" y1="0" y2="0" class="axis" />
        <line x1="0" x2="0" y1="-80" y2="80" class="axis" />
        <text x="84" y="4" class="al">drive</text>
        <text x="4" y="-84" class="al">sense</text>
        <rect x={xd - 16} y={ys - 16} width="32" height="32" rx="4" class="mass" />
        <line x1={xd} y1={ys} x2={xd + 0.8 * AX * Math.cos(wd * t)} y2={ys} class="vel" marker-end="url(#gh)" />
        {#if omega !== 0}<line x1={xd} y1={ys} x2={xd} y2={ys + (omega > 0 ? -1 : 1) * Math.min(40, Math.abs(omega) / 5) * Math.sign(Math.cos(wd * t))} class="cor" marker-end="url(#gc)" />{/if}
      </g>
      <path d="M-30,-104 A110,110 0 0 1 30,-104" class="rot" marker-end="url(#gr)" />
      <defs>
        <marker id="gh" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--text-primary)" /></marker>
        <marker id="gc" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--cls-2)" /></marker>
        <marker id="gr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--text-muted)" /></marker>
      </defs>
    </svg>
    <div class="right">
      <LineChart
        series={[
          { x: tt, y: drive, color: 'var(--text-muted)', width: 1.5, label: 'drive motion x', dash: [4, 3] },
          { x: tt, y: sense, color: 'var(--cls-2)', width: 2.2, label: 'sense motion y' },
        ]}
        xDomain={[0, 3]}
        yDomain={[-1.2, 1.2]}
        height={app.mode === 'lecture' ? 220 : 180}
        xLabel="drive cycles"
        yLabel="motion (normalized)"
        legend
        ariaLabel="Drive and sense motion"
      />
      <p class="small secondary">
        For a MEMS gyro driven at {fd / 1000} kHz with {A * 1e6} µm amplitude, the mass moves at up to {v.toFixed(2)} m/s. At {omega} °/s the Coriolis
        acceleration is <b class="num">{Math.abs(ac).toFixed(2)} m/s² ({(Math.abs(ac) / 9.81).toFixed(2)} g)</b>. It alternates at the drive
        frequency, so the circuit demodulates the sense signal against the drive to recover Ω and its sign.
      </p>
    </div>
  </div>
  <p class="small muted">Black arrow: velocity of the mass. Orange arrow: Coriolis force. The rotation of the chip is slowed down in the drawing.</p>
</div>

<style>
  .layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 1rem; align-items: center; margin-top: 0.5rem; }
  .rig { width: 220px; overflow: visible; }
  .frame { fill: var(--surface-2); stroke: var(--text-muted); stroke-width: 1.5; }
  .axis { stroke: var(--grid); stroke-dasharray: 3 3; }
  .al { font-size: 10px; fill: var(--text-muted); }
  .mass { fill: var(--accent); }
  .vel { stroke: var(--text-primary); stroke-width: 2; }
  .cor { stroke: var(--cls-2); stroke-width: 3; }
  .rot { fill: none; stroke: var(--text-muted); stroke-width: 1.5; }
  @media (max-width: 640px) { .layout { grid-template-columns: minmax(0, 1fr); } .rig { margin: 0 auto; display: block; } }
</style>
