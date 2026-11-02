<script lang="ts">
  // Hall-effect speed and position sensing: a magnet behind a Hall sensor faces a steel toothed wheel. Each tooth
  // concentrates the field, so the output switches once per tooth. A missing-tooth gap marks a reference angle.
  import { onDestroy, onMount } from 'svelte';
  import LineChart from '../../lib/charts/LineChart.svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import { app } from '../../lib/state.svelte';

  const WHEELS = {
    abs: { teeth: 16, missing: 0, label: '16 teeth (wheel speed)' },
    crank: { teeth: 36, missing: 1, label: '36 − 1 (crankshaft)' },
  } as const;
  let wheel = $state<keyof typeof WHEELS>('crank');
  let rpm = $state(600);
  const W = $derived(WHEELS[wheel]);
  const fs = 50_000, T = 0.12;
  const n = fs * T;
  // field at the sensor vs angle: high under a tooth, low in a gap or at the missing tooth
  const field = (theta: number) => {
    const pitch = (2 * Math.PI) / W.teeth;
    const k = Math.floor((((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / pitch);
    if (k >= W.teeth - W.missing) return 0.1;
    const u = ((theta / pitch) % 1 + 1) % 1;
    return 0.1 + 0.9 * Math.max(0, Math.sin(Math.PI * Math.min(1, u * 2))) ** 0.6;
  };
  const sig = $derived.by(() => {
    const w = (rpm / 60) * 2 * Math.PI;
    const b = new Float64Array(n);
    const d = new Float64Array(n);
    let state = 0;
    for (let i = 0; i < n; i++) {
      b[i] = field(w * (i / fs) + 0.3);
      // Schmitt trigger with hysteresis
      if (state === 0 && b[i] > 0.6) state = 1;
      else if (state === 1 && b[i] < 0.4) state = 0;
      d[i] = state ? 1.3 : 0;
    }
    return { b, d };
  });
  const fPulse = $derived((W.teeth * rpm) / 60);
  const revMarks = $derived.by(() => {
    const out = [];
    const trev = 60 / rpm;
    // the gap passes the sensor once per revolution
    const t0 = ((2 * Math.PI * (W.teeth - W.missing)) / W.teeth - 0.3) / ((rpm / 60) * 2 * Math.PI);
    for (let t = t0; t < T && W.missing; t += trev) if (t > 0) out.push({ x: t * 1000, label: 'gap', color: 'var(--cls-2)', dash: true });
    return out;
  });
  const speed = $derived((rpm / 60) * 2 * Math.PI * 0.3 * 3.6);

  let ang = $state(0);
  let raf = 0;
  onMount(() => {
    let last = performance.now();
    const tick = (now: number) => {
      ang = (ang + ((now - last) / 1000) * rpm * 0.03) % 360;
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
  onDestroy(() => cancelAnimationFrame(raf));
  const teethPath = $derived.by(() => {
    const parts: string[] = [];
    for (let k = 0; k < W.teeth - W.missing; k++) {
      const a0 = (k / W.teeth) * 2 * Math.PI, a1 = ((k + 0.5) / W.teeth) * 2 * Math.PI;
      const p = (a: number, r: number) => `${(r * Math.sin(a)).toFixed(2)},${(-r * Math.cos(a)).toFixed(2)}`;
      parts.push(`M${p(a0, 60)} L${p(a0, 74)} L${p(a1, 74)} L${p(a1, 60)} Z`);
    }
    return parts.join(' ');
  });
</script>

<div class="card">
  <div class="controls">
    <Seg options={Object.entries(WHEELS).map(([value, w]) => ({ value: value as keyof typeof WHEELS, label: w.label }))} bind:value={wheel} label="Wheel" />
    <label class="control"><span>Speed <b>{rpm} rpm</b></span><input type="range" min="60" max="1500" step="10" bind:value={rpm} /></label>
  </div>
  <div class="layout">
    <svg viewBox="-90 -112 180 200" class="rig" role="img" aria-label="Toothed wheel and Hall sensor">
      <rect x="-12" y="-110" width="24" height="26" rx="3" class="sensor" />
      <text x="0" y="-93" text-anchor="middle" class="sl">Hall</text>
      <g transform="rotate({-ang})">
        <circle r="60" class="disc" />
        <path d={teethPath} class="teeth" />
        <circle r="8" class="hub" />
      </g>
    </svg>
    <div class="right">
      <LineChart
        series={[
          { y: sig.b, dx: 1000 / fs, color: 'var(--text-muted)', width: 1, label: 'field at sensor' },
          { y: sig.d, dx: 1000 / fs, color: 'var(--accent)', width: 1.6, label: 'switched output' },
        ]}
        xDomain={[0, T * 1000]}
        yDomain={[-0.1, 1.5]}
        height={app.mode === 'lecture' ? 220 : 180}
        xLabel="time (ms)"
        yLabel="output"
        legend
        markers={revMarks}
        ariaLabel="Hall sensor output"
      />
      <p class="small secondary">
        Pulse frequency <b class="num">{fPulse.toFixed(0)} Hz</b> = teeth × rpm / 60. The controller measures the time between pulses and turns
        it back into speed: on a 0.3 m wheel, {rpm} rpm is <b class="num">{speed.toFixed(0)} km/h</b>.
        {#if W.missing}The longer gap marks one fixed angle per revolution, which the engine controller uses to time the spark.{/if}
      </p>
    </div>
  </div>
</div>

<style>
  .layout { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 1rem; align-items: center; margin-top: 0.5rem; }
  .rig { width: 180px; }
  .sensor { fill: var(--cls-2); }
  .sl { font-size: 9px; fill: #fff; font-weight: 700; }
  .disc { fill: var(--surface-3); stroke: var(--text-muted); }
  .teeth { fill: var(--text-muted); }
  .hub { fill: var(--surface-1); stroke: var(--text-muted); }
  @media (max-width: 640px) { .layout { grid-template-columns: minmax(0, 1fr); } .rig { margin: 0 auto; display: block; } }
</style>
