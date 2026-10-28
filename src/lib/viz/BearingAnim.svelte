<script lang="ts" module>
  export type DefectSite = 'none' | 'outer' | 'inner' | 'ball';
</script>

<script lang="ts">
  // Kinematic animation of a 6205 bearing with a seeded defect, plus the vibration it would produce.
  import { onMount, untrack } from 'svelte';
  import { BEARING, faultFrequencies, type BearingGeometry } from '../bearing';
  import { app } from '../state.svelte';

  interface Props {
    rpm: number;
    defect: DefectSite;
    slowmo: number; // animation runs 1/slowmo of real time
    playing: boolean;
    geometry?: BearingGeometry;
  }
  let { rpm, defect, slowmo, playing, geometry = BEARING }: Props = $props();

  // geometry scaled so the outer diameter is 200 SVG units
  const S = $derived(100 / (geometry.outerDiameter / 2));
  const rPitch = $derived((geometry.pitchDiameter / 2) * S);
  const rBall = $derived((geometry.ballDiameter / 2) * S);
  const rOuterRace = $derived(rPitch + rBall);
  const rInnerRace = $derived(rPitch - rBall);
  const rBore = $derived((geometry.innerDiameter / 2) * S);
  const N = $derived(geometry.balls);
  const LOAD = Math.PI / 2; // load zone at 6 o'clock (SVG y points down)

  const ff = $derived(faultFrequencies(rpm, geometry));
  let t = $state(0); // simulated (real-world) seconds
  let flash = $state(0); // 1 right after an impact, decays
  let canvas: HTMLCanvasElement;
  let traceW = $state(600);
  const WINDOW = 0.12; // seconds of signal shown
  const impacts: { t: number; a: number }[] = [];

  const shaftAngle = $derived(2 * Math.PI * ff.shaft * t);
  const cageAngle = $derived(2 * Math.PI * ff.ftf * t);
  const spinAngle = $derived(2 * Math.PI * ff.bsf * t);

  /** Impact "phase": each time it crosses an integer, the defect is struck. */
  function phase(site: DefectSite, time: number): number {
    if (site === 'outer') return ff.bpfo * time - (N * LOAD) / (2 * Math.PI);
    if (site === 'inner') return ff.bpfi * time + (N * LOAD) / (2 * Math.PI);
    if (site === 'ball') return 2 * ff.bsf * time;
    return 0;
  }

  /** Impacts are strongest in the load zone. */
  function amplitude(site: DefectSite, time: number): number {
    const zone = (ang: number) => 0.18 + 0.82 * Math.max(0, Math.cos(ang - LOAD)) ** 1.5;
    if (site === 'outer') return 1;
    if (site === 'inner') return zone(2 * Math.PI * ff.shaft * time + LOAD);
    if (site === 'ball') return 0.7 * zone(2 * Math.PI * ff.ftf * time);
    return 0;
  }

  function advance(dt: number, from = t) {
    const t0 = from;
    const t1 = t + dt;
    if (defect !== 'none') {
      const p0 = Math.floor(phase(defect, t0));
      const p1 = Math.floor(phase(defect, t1));
      const rate = phase(defect, 1) - phase(defect, 0);
      for (let k = p0 + 1; k <= p1; k++) {
        const tk = (k - phase(defect, 0)) / rate;
        impacts.push({ t: tk, a: amplitude(defect, tk) });
        flash = 1;
      }
    }
    while (impacts.length && impacts[0].t < t1 - WINDOW - 0.01) impacts.shift();
    t = t1;
    flash *= 0.9;
  }

  // deterministic pseudo-noise so the trace doesn't shimmer between frames
  const noise = (k: number) => {
    const s = Math.sin(k * 12.9898) * 43758.5453;
    return (s - Math.floor(s) - 0.5) * 2;
  };

  function drawTrace() {
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const H = 120;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = traceW * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, traceW, H);
    const css = getComputedStyle(canvas);
    const ink = css.getPropertyValue('--text-secondary').trim();
    const grid = css.getPropertyValue('--grid').trim();
    const accent = css.getPropertyValue('--cls-2').trim();
    ctx.strokeStyle = grid;
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(traceW, H / 2);
    ctx.stroke();

    const fs = 24000;
    const n = Math.round(WINDOW * fs);
    const tStart = t - WINDOW;
    const fres = 3100;
    const tau = 0.0011;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const ts = tStart + i / fs;
      let v = 0.06 * noise(Math.round(ts * fs)) + 0.05 * Math.sin(2 * Math.PI * ff.shaft * ts);
      for (const imp of impacts) {
        const dt = ts - imp.t;
        if (dt >= 0 && dt < 8 * tau) v += imp.a * Math.exp(-dt / tau) * Math.sin(2 * Math.PI * fres * dt);
      }
      const px = (i / n) * traceW;
      const py = H / 2 - v * (H / 2.4);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // bracket the spacing between the two most recent impacts
    const vis = impacts.filter((m) => m.t > tStart);
    if (vis.length >= 2) {
      const a = vis[vis.length - 2].t, b = vis[vis.length - 1].t;
      const xa = ((a - tStart) / WINDOW) * traceW, xb = ((b - tStart) / WINDOW) * traceW;
      ctx.strokeStyle = accent;
      ctx.fillStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xa, 10); ctx.lineTo(xa, 4); ctx.lineTo(xb, 4); ctx.lineTo(xb, 10);
      ctx.stroke();
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = xb > traceW - 60 ? 'right' : 'left';
      ctx.fillText(`Δt = ${((b - a) * 1000).toFixed(1)} ms`, xb > traceW - 60 ? xa - 4 : xb + 4, 14);
    }
  }

  onMount(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (playing && !reduce) advance(dt / slowmo);
      else if (playing && reduce) advance(0); // static frame
      drawTrace();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  $effect(() => {
    // refill the visible trace whenever the defect or speed changes, so it never starts blank
    void defect;
    void rpm;
    void geometry;
    untrack(() => {
      impacts.length = 0;
      const now = Math.max(t, WINDOW + 0.01);
      t = now - WINDOW - 0.01;
      advance(WINDOW + 0.01);
    });
  });
  $effect(() => {
    void app.paletteTick;
    drawTrace();
  });

  const pt = (r: number, a: number) => [r * Math.cos(a), r * Math.sin(a)] as const;
  const innerDefectAngle = $derived(shaftAngle + LOAD);
</script>

<div class="anim">
  <svg viewBox="-112 -112 224 224" class="bearing" role="img" aria-label="Animated cross-section of a ball bearing, {defect === 'none' ? 'healthy' : `with a defect on the ${defect === 'ball' ? 'ball' : defect + ' race'}`}">
    <!-- load zone -->
    <path d="M {pt(104, LOAD - 0.9).join(' ')} A 104 104 0 0 1 {pt(104, LOAD + 0.9).join(' ')}" class="zone" />
    <text x="0" y="111" class="zone-label" text-anchor="middle">load zone</text>
    <!-- outer ring (stationary, pressed into the housing) -->
    <circle r={(rOuterRace + 100) / 2} class="ring outer" stroke-width={100 - rOuterRace} />
    <!-- inner ring rotates with the shaft -->
    <g transform="rotate({(shaftAngle * 180) / Math.PI})">
      <circle r={(rBore + rInnerRace) / 2} class="ring inner" stroke-width={rInnerRace - rBore} />
      <circle r={rBore} class="shaft" />
      <line x1={-rBore * 0.7} x2={rBore * 0.7} y1="0" y2="0" class="keyway" />
      <line y1={-rBore * 0.7} y2={rBore * 0.7} x1="0" x2="0" class="keyway" />
    </g>
    <!-- cage + balls -->
    <circle r={rPitch} class="cage" />
    {#each { length: N } as _, i}
      {@const a = cageAngle + (2 * Math.PI * i) / N}
      {@const [cx, cy] = pt(rPitch, a)}
      <g transform="translate({cx},{cy})">
        <circle r={rBall - 0.6} class="ball" />
        {#if defect === 'ball' && i === 0}
          {@const da = a - spinAngle}
          <circle cx={Math.cos(da) * (rBall - 3)} cy={Math.sin(da) * (rBall - 3)} r="3" class="defect" />
        {:else}
          <circle cx={Math.cos(a - spinAngle) * (rBall - 4)} cy={Math.sin(a - spinAngle) * (rBall - 4)} r="1.6" class="spin" />
        {/if}
      </g>
    {/each}
    {#if defect === 'outer'}
      {@const [x, y] = pt(rOuterRace + 1.5, LOAD)}
      <circle cx={x} cy={y} r={3.5 + 3 * flash} class="defect" />
    {:else if defect === 'inner'}
      {@const [x, y] = pt(rInnerRace - 1.5, innerDefectAngle)}
      <circle cx={x} cy={y} r={3.5 + 3 * flash} class="defect" />
    {/if}
    {#if flash > 0.2}
      <circle r="106" class="pulse" style:opacity={flash * 0.6} />
    {/if}
  </svg>
  <div class="trace" bind:clientWidth={traceW}>
    <div class="trace-title">
      <span>Simulated accelerometer signal</span>
      <span class="muted">last {WINDOW * 1000} ms · {defect === 'none' ? 'healthy: broadband noise only' : 'each strike excites a resonance near 3 kHz'}</span>
    </div>
    <canvas bind:this={canvas} style:width="{traceW}px" style:height="120px" aria-hidden="true"></canvas>
  </div>
</div>

<style>
  .anim > * { min-width: 0; }
  .anim {
    display: grid;
    grid-template-columns: minmax(200px, 340px) 1fr;
    gap: 1.25rem;
    align-items: center;
  }
  .bearing { width: 100%; max-width: 340px; overflow: visible; }
  .ring { fill: none; stroke: var(--axis); }
  .ring.inner { stroke: var(--split-val); }
  .shaft { fill: var(--surface-3); }
  .keyway { stroke: var(--text-muted); stroke-width: 2; }
  .cage { fill: none; stroke: var(--text-muted); stroke-width: 1; stroke-dasharray: 3 3; }
  .ball { fill: var(--surface-1); stroke: var(--text-secondary); stroke-width: 1.2; }
  .spin { fill: var(--text-muted); }
  .defect { fill: var(--cls-2); stroke: var(--surface-1); stroke-width: 1; }
  .zone { fill: none; stroke: var(--cls-2); stroke-width: 3; opacity: 0.35; stroke-linecap: round; }
  .zone-label { fill: var(--text-muted); font-size: 7px; }
  .pulse { fill: none; stroke: var(--cls-2); stroke-width: 2; }
  .trace { min-width: 0; }
  .trace-title { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.3rem; }
  .trace-title .muted { font-weight: 400; }
  canvas { display: block; background: var(--surface-2); border-radius: 8px; }
  @media (max-width: 700px) {
    .anim { grid-template-columns: 1fr; justify-items: center; }
    .trace { width: 100%; }
  }
</style>
