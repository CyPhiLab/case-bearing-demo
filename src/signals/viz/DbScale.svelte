<script lang="ts">
  // Decibels: 20 log10 for amplitude ratios, 10 log10 for power ratios.
  let e = $state(1); // log10 of the amplitude ratio
  const r = $derived(10 ** e);
  const fmtR = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toPrecision(2));
  const ROWS = [
    ['×2 amplitude', '+6 dB'], ['×10 amplitude', '+20 dB'], ['×1000 amplitude', '+60 dB'],
    ['×2 power', '+3 dB'], ['½ power (the −3 dB cutoff)', '−3 dB'], ['1/√2 amplitude (same thing)', '−3 dB'],
  ];
</script>

<div class="card cols">
  <div>
    <label class="control"><span>Amplitude ratio A₁/A₂ <b>{fmtR(r)}</b></span><input type="range" min="-3" max="3" step="0.01" bind:value={e} /></label>
    <div class="out">
      <div class="stat"><span class="value num">{(20 * e).toFixed(1)} dB</span><span class="label">20 log₁₀(A₁/A₂), amplitude</span></div>
      <div class="stat"><span class="value num">{fmtR(r * r)}</span><span class="label">power ratio P₁/P₂ = (A₁/A₂)²</span></div>
      <div class="stat"><span class="value num">{(10 * Math.log10(r * r)).toFixed(1)} dB</span><span class="label">10 log₁₀(P₁/P₂): the same dB</span></div>
    </div>
    <div class="bar" aria-hidden="true"><div class="fill" style:width="{((e + 3) / 6) * 100}%"></div></div>
    <div class="ticks small muted"><span>10⁻³ (−60 dB)</span><span>1 (0 dB)</span><span>10³ (+60 dB)</span></div>
  </div>
  <table class="small">
    <tbody>{#each ROWS as [a, b]}<tr><td>{a}</td><td class="num"><b>{b}</b></td></tr>{/each}</tbody>
  </table>
</div>

<style>
  .cols { display: grid; grid-template-columns: 1fr minmax(220px, 300px); gap: 1.2rem; align-items: center; }
  .cols > * { min-width: 0; }
  .out { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; margin: 0.6rem 0; }
  .bar { height: 8px; border-radius: 4px; background: var(--surface-2); overflow: hidden; }
  .fill { height: 100%; background: var(--accent); }
  .ticks { display: flex; justify-content: space-between; margin-top: 0.2rem; }
  table { border-collapse: collapse; width: 100%; }
  td { padding: 0.25rem 0.4rem; border-bottom: 1px solid var(--grid); }
  td.num { text-align: right; }
  @media (max-width: 700px) { .cols { grid-template-columns: 1fr; } .out { grid-template-columns: 1fr 1fr; } }
</style>
