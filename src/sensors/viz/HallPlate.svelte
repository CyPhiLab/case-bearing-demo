<script lang="ts">
  // The Hall effect: carriers moving through a plate in a magnetic field are pushed to one edge until the
  // resulting transverse field balances the magnetic force. The voltage across the plate is V_H = IB/(nqt).
  import { onDestroy, onMount } from 'svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import { hallVoltage } from '../lib/physics';

  const MAT = {
    copper: { n: 8.5e28, label: 'Copper' },
    silicon: { n: 1e21, label: 'Doped silicon' },
  } as const;
  let mat = $state<keyof typeof MAT>('silicon');
  let I = $state(1); // mA
  let B = $state(0.1); // T
  let t = $state(10); // µm
  const VH = $derived(hallVoltage(I / 1000, B, MAT[mat].n, t * 1e-6));
  const fmt = (v: number) => {
    const a = Math.abs(v);
    if (a >= 1) return `${v.toFixed(2)} V`;
    if (a >= 1e-3) return `${(v * 1e3).toFixed(2)} mV`;
    if (a >= 1e-6) return `${(v * 1e6).toFixed(2)} µV`;
    return `${(v * 1e9).toFixed(2)} nV`;
  };
  // number of edge charges drawn: logarithmic in |V_H| so both materials are visible
  const nq = $derived(Math.max(0, Math.min(9, Math.round(Math.log10(Math.abs(VH) / 1e-10) + 0.5))));

  let ph = $state(0);
  let raf = 0;
  onMount(() => {
    let last = performance.now();
    const tick = (now: number) => {
      ph = (ph + ((now - last) / 1000) * 0.25 * Math.max(0.2, I / 2)) % 1;
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
  onDestroy(() => cancelAnimationFrame(raf));
  const DOTS = Array.from({ length: 24 }, (_, i) => ({ x0: (i * 0.37) % 1, y: 0.15 + ((i * 7) % 12) / 14 }));
  const top = $derived(B >= 0 ? '+' : '−');
  const bot = $derived(B >= 0 ? '−' : '+');
</script>

<div class="card">
  <div class="controls">
    <Seg options={Object.entries(MAT).map(([value, m]) => ({ value: value as keyof typeof MAT, label: m.label }))} bind:value={mat} label="Plate material" />
    <label class="control"><span>Current I <b>{I.toFixed(1)} mA</b></span><input type="range" min="0.1" max="10" step="0.1" bind:value={I} /></label>
    <label class="control"><span>Field B <b>{B.toFixed(3)} T</b></span><input type="range" min="-0.5" max="0.5" step="0.005" bind:value={B} /></label>
    <label class="control"><span>Thickness t <b>{t} µm</b></span><input type="range" min="1" max="100" step="1" bind:value={t} /></label>
  </div>
  <div class="layout">
    <svg viewBox="0 0 340 190" class="rig" role="img" aria-label="Hall plate">
      <rect x="40" y="40" width="260" height="110" class="plate" />
      {#each { length: 6 } as _, i}
        {@const cx = 70 + i * 40}
        <text x={cx} y="98" text-anchor="middle" class="bsym">{B >= 0 ? '⊙' : '⊗'}</text>
      {/each}
      {#each DOTS as d}
        {@const x = 300 - ((d.x0 + ph) % 1) * 260}
        <circle cx={x} cy={40 + d.y * 110} r="3" class="e" />
      {/each}
      {#each { length: nq } as _, i}
        <text x={60 + i * 27} y="36" text-anchor="middle" class="q {top === '+' ? 'pos' : 'neg'}">{top}</text>
        <text x={60 + i * 27} y="166" text-anchor="middle" class="q {bot === '+' ? 'pos' : 'neg'}">{bot}</text>
      {/each}
      <line x1="10" x2="36" y1="95" y2="95" class="wire" marker-end="url(#ha)" />
      <text x="8" y="86" class="lbl">I</text>
      <line x1="304" x2="330" y1="95" y2="95" class="wire" marker-end="url(#ha)" />
      <line x1="170" y1="20" x2="170" y2="6" class="wire" />
      <line x1="170" y1="156" x2="170" y2="184" class="wire" />
      <text x="178" y="14" class="lbl">V_H</text>
      <defs><marker id="ha" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--text-primary)" /></marker></defs>
    </svg>
    <div class="read">
      <div class="stat"><span class="value num">{fmt(VH)}</span><span class="label">Hall voltage</span></div>
      <p class="small secondary">
        Carrier density n = {MAT[mat].n.toExponential(1)} m⁻³. Copper has about 10⁸ times more free electrons than doped silicon, so they drift
        far more slowly for the same current and the Hall voltage is tiny. Practical Hall sensors use thin semiconductor layers.
      </p>
      <p class="small muted">Dots: electrons drifting against the current. {B >= 0 ? '⊙ field out of the page' : '⊗ field into the page'}. Edge charges are drawn on a logarithmic scale.</p>
    </div>
  </div>
</div>

<style>
  .layout { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 1rem; align-items: center; margin-top: 0.5rem; }
  .rig { width: 100%; max-width: 440px; }
  .plate { fill: var(--surface-2); stroke: var(--text-muted); stroke-width: 1.5; }
  .bsym { font-size: 16px; fill: var(--text-muted); }
  .e { fill: var(--accent); }
  .q { font-size: 16px; font-weight: 700; }
  .pos { fill: var(--critical); }
  .neg { fill: var(--accent); }
  .wire { stroke: var(--text-primary); stroke-width: 1.5; }
  .lbl { font-size: 12px; fill: var(--text-primary); font-weight: 600; }
  .read { display: grid; gap: 0.4rem; }
  @media (max-width: 640px) { .layout { grid-template-columns: minmax(0, 1fr); } }
</style>
