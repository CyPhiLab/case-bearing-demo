<script lang="ts">
  // Pitot-static tube with a water manometer: the stagnation pressure at the nose exceeds the static pressure on
  // the side by the dynamic pressure ½ρv². The density depends on altitude.
  import { onDestroy, onMount } from 'svelte';
  import { atmosphere, pitotVelocity } from '../lib/physics';

  let v = $state(30); // m/s, true airspeed
  let alt = $state(0); // m
  const atm = $derived(atmosphere(alt));
  const dp = $derived(0.5 * atm.rho * v * v);
  const hmm = $derived((dp / (998 * 9.81)) * 1000);
  const ias = $derived(pitotVelocity(dp, 1.225)); // what an instrument calibrated for sea level shows

  let ph = $state(0);
  let raf = 0;
  onMount(() => {
    let last = performance.now();
    const tick = (now: number) => {
      ph = (ph + ((now - last) / 1000) * v * 2) % 40;
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
  onDestroy(() => cancelAnimationFrame(raf));
  const half = $derived(Math.min(34, hmm * 0.15)); // drawn half-difference of the columns, px
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Air speed <b>{v} m/s</b> ({(v * 3.6).toFixed(0)} km/h)</span><input type="range" min="0" max="60" step="1" bind:value={v} /></label>
    <label class="control"><span>Altitude <b>{alt} m</b></span><input type="range" min="0" max="5000" step="100" bind:value={alt} /></label>
  </div>
  <div class="layout">
    <svg viewBox="0 0 360 262" class="rig" role="img" aria-label="Pitot-static tube connected to a U-tube manometer">
      {#each [30, 55, 80] as y}
        {#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as i}
          <line x1={((i * 40 + ph * 2) % 400) - 40} x2={((i * 40 + ph * 2) % 400) - 22} y1={y} y2={y} class="flow" />
        {/each}
      {/each}
      <!-- probe: nose faces the flow (coming from the left) -->
      <path d="M60,55 h150 v6 h-150 z" class="probe" />
      <circle cx="60" cy="58" r="3" class="hole tot" />
      <circle cx="120" cy="55" r="2.2" class="hole stat" />
      <circle cx="120" cy="61" r="2.2" class="hole stat" />
      <path d="M210,58 H280 V150" class="tube tot" />
      <path d="M170,61 V130 H200 V150" class="tube stat" />
      <!-- U-tube manometer: total pressure on the right leg pushes its column down -->
      <path d="M200,150 V214 a40,40 0 0 0 80,0 V150" class="u" />
      <path d="M200,{188 - half} V214 a40,40 0 0 0 80,0 V{188 + half}" class="water" />
      <line x1="286" x2="300" y1={188 + half} y2={188 + half} class="dim" />
      <line x1="204" x2="300" y1={188 - half} y2={188 - half} class="dim" />
      <line x1="295" x2="295" y1={188 - half} y2={188 + half} class="dim" />
      <text x="304" y="192" class="lbl">h = {hmm.toFixed(0)} mm</text>
      <text x="14" y="200" class="lbl tot">total (stagnation) pressure</text>
      <text x="14" y="216" class="lbl stat">static pressure</text>
      <text x="8" y="20" class="lbl">air →</text>
    </svg>
    <div class="read">
      <div class="stat"><span class="value num">{dp.toFixed(0)} Pa</span><span class="label">Δp = ½ρv² (ρ = {atm.rho.toFixed(3)} kg/m³)</span></div>
      <div class="stat"><span class="value num">{hmm.toFixed(1)} mm</span><span class="label">water column h = Δp/(ρ_w g)</span></div>
      <div class="stat"><span class="value num">{ias.toFixed(1)} m/s</span><span class="label">reading of a gauge calibrated for sea-level air (indicated airspeed)</span></div>
    </div>
  </div>
</div>

<style>
  .layout { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 1rem; align-items: center; margin-top: 0.5rem; }
  .rig { width: 100%; max-width: 460px; }
  .flow { stroke: var(--accent); stroke-width: 1.5; opacity: 0.45; }
  .probe { fill: var(--text-muted); }
  .hole.tot { fill: var(--cls-2); }
  .hole.stat { fill: var(--cls-3); }
  .tube { fill: none; stroke-width: 2.5; }
  .tube.tot { stroke: var(--cls-2); }
  .tube.stat { stroke: var(--cls-3); }
  .u { fill: none; stroke: var(--text-muted); stroke-width: 1.5; }
  .water { fill: none; stroke: var(--accent); stroke-width: 7; opacity: 0.6; }
  .dim { stroke: var(--text-primary); stroke-dasharray: 2 2; }
  .lbl { font-size: 11px; fill: var(--text-secondary); }
  .lbl.tot { fill: var(--cls-2); }
  .lbl.stat { fill: var(--cls-3); }
  .read { display: grid; gap: 0.6rem; }
  @media (max-width: 640px) { .layout { grid-template-columns: minmax(0, 1fr); } }
</style>
