<script lang="ts">
  // MEMS capacitive accelerometer: the proof mass carries fingers that sit between fixed fingers. Acceleration
  // moves the mass, one gap closes and the other opens, and the difference in capacitance is the output.
  const d = 2e-6; // nominal gap, m
  const fn = 5000; // natural frequency, Hz
  const C0 = 100e-15; // each side at rest, F
  let a = $state(1); // g
  const x = $derived((-a * 9.81) / (2 * Math.PI * fn) ** 2); // mass lags the frame: moves opposite to the acceleration
  const C1 = $derived((C0 * d) / (d - x));
  const C2 = $derived((C0 * d) / (d + x));
  const out = $derived((C1 - C2) / (C1 + C2)); // = x/d
  const draw = $derived((-a / 2) * 7); // drawn shift, px (exaggerated)
  const FINGERS = [0, 1, 2, 3, 4, 5];
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Acceleration (along the sense axis) <b>{a.toFixed(2)} g</b></span><input type="range" min="-2" max="2" step="0.05" bind:value={a} /></label>
  </div>
  <div class="layout">
    <svg viewBox="0 0 320 150" class="comb" role="img" aria-label="MEMS comb accelerometer">
      <rect x="10" y="10" width="300" height="14" class="anchor" />
      {#each FINGERS as i}
        {@const cx = 45 + i * 46}
        <rect x={cx - 13} y="24" width="5" height="62" class="fixed f1" />
        <rect x={cx + 8} y="24" width="5" height="62" class="fixed f2" />
        <rect x={cx - 2.5 + draw} y="58" width="5" height="62" class="moving" />
      {/each}
      <rect x={30 + draw} y="116" width="260" height="22" rx="3" class="mass" />
      <text x={160 + draw} y="131" text-anchor="middle" class="ml">proof mass</text>
      <path d="M10,127 h8 l3,-6 l6,12 l6,-12 l3,6 h{3 + draw}" class="spring" />
      <path d="M310,127 h-8 l-3,-6 l-6,12 l-6,-12 l-3,6 h{-3 + draw}" class="spring" />
      <text x="20" y="44" class="lbl c1">C₁</text>
      <text x="290" y="44" class="lbl c2">C₂</text>
    </svg>
    <div class="read">
      <div class="stat"><span class="value num">{(x * 1e9).toFixed(1)} nm</span><span class="label">proof-mass displacement (gap {d * 1e6} µm, fₙ = {fn / 1000} kHz)</span></div>
      <div class="stat"><span class="value num">{((C1 - C2) * 1e15).toFixed(3)} fF</span><span class="label">C₁ − C₂ (each side {C0 * 1e15} fF at rest)</span></div>
      <div class="stat"><span class="value num">{(out * 100).toFixed(3)} %</span><span class="label">(C₁ − C₂)/(C₁ + C₂) = x/d, linear in acceleration</span></div>
    </div>
  </div>
  <p class="small muted">Displacement in the drawing is exaggerated about a million times.</p>
</div>

<style>
  .layout { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 1rem; align-items: center; margin-top: 0.5rem; }
  .comb { width: 100%; max-width: 420px; }
  .anchor { fill: var(--axis); }
  .fixed.f1 { fill: var(--cls-2); }
  .fixed.f2 { fill: var(--cls-3); }
  .moving { fill: var(--accent); }
  .mass { fill: var(--accent); }
  .ml { fill: #fff; font-size: 11px; font-weight: 600; }
  .spring { fill: none; stroke: var(--text-secondary); stroke-width: 1.5; }
  .lbl { font-size: 12px; font-weight: 700; }
  .c1 { fill: var(--cls-2); }
  .c2 { fill: var(--cls-3); }
  .read { display: grid; gap: 0.6rem; }
  @media (max-width: 640px) { .layout { grid-template-columns: minmax(0, 1fr); } }
</style>
