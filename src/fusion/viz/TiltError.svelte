<script lang="ts">
  // An accelerometer cannot tell gravity from acceleration: accelerating sideways tips the apparent "down".
  import { G, tiltErrorFromAccel } from '../lib/fusion';
  let a = $state(2); // m/s², horizontal acceleration
  const err = $derived(tiltErrorFromAccel(a));
  const S = 9; // px per m/s²
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Horizontal acceleration <b>{a.toFixed(1)} m/s²</b> ({(a / G).toFixed(2)} g)</span><input type="range" min="0" max="8" step="0.1" bind:value={a} /></label>
  </div>
  <div class="layout">
    <svg viewBox="-60 -110 200 140" class="rig" role="img" aria-label="Measured acceleration vector">
      <rect x="-14" y="-24" width="28" height="48" rx="5" class="phone" />
      <line x1="0" y1="0" x2="0" y2={-G * S} class="vec g" marker-end="url(#ta1)" />
      <line x1="0" y1={-G * S} x2={a * S} y2={-G * S} class="vec a" marker-end="url(#ta2)" />
      <line x1="0" y1="0" x2={a * S} y2={-G * S} class="vec m" marker-end="url(#ta3)" />
      <text x="-56" y={-G * S / 2} class="lbl g">gravity reaction</text>
      <text x={a * S / 2} y={-G * S - 6} text-anchor="middle" class="lbl a">acceleration</text>
      <text x={a * S + 4} y={-G * S / 2} class="lbl m">measured</text>
      <defs>
        <marker id="ta1" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--text-muted)" /></marker>
        <marker id="ta2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--cls-2)" /></marker>
        <marker id="ta3" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" /></marker>
      </defs>
    </svg>
    <div class="read">
      <div class="stat"><span class="value num">{err.toFixed(1)}°</span><span class="label">apparent tilt of a phone that is actually level, atan(a/g)</span></div>
      <p class="small secondary">
        A car accelerating from 0 to 100 km/h in 10 s (2.8 m/s²) makes a level accelerometer read a tilt of about 16°. Vibration does the same,
        rapidly and in both directions, which shows up as noise on the tilt.
      </p>
    </div>
  </div>
</div>

<style>
  .layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 1rem; align-items: center; margin-top: 0.5rem; }
  .rig { width: 220px; }
  .phone { fill: var(--surface-3); stroke: var(--text-muted); }
  .vec { stroke-width: 2.5; }
  .vec.g { stroke: var(--text-muted); }
  .vec.a { stroke: var(--cls-2); }
  .vec.m { stroke: var(--accent); }
  .lbl { font-size: 9px; }
  .lbl.g { fill: var(--text-muted); }
  .lbl.a { fill: var(--cls-2); }
  .lbl.m { fill: var(--accent); }
  .read { display: grid; gap: 0.5rem; }
  @media (max-width: 640px) { .layout { grid-template-columns: minmax(0, 1fr); } .rig { margin: 0 auto; display: block; } }
</style>
