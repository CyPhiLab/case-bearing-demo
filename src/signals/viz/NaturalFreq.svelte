<script lang="ts">
  // "See frequency components, e.g. natural frequencies": strike a spring–mass, find f_n in the spectrum.
  import { onDestroy } from 'svelte';
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { dftAmplitude, linspace } from '../../lib/dsp/signals';
  import { app } from '../../lib/state.svelte';

  const fs = 1024;
  const N = 2048;
  const t = linspace(N, 1 / fs);
  const t0 = 0.1;
  let k = $state(4000); // N/m
  let m = $state(0.5); // kg
  let zeta = $state(0.02);
  let second = $state(false);
  const fn = $derived(Math.sqrt(k / m) / (2 * Math.PI));
  const x = $derived(
    t.map((tt) => {
      if (tt < t0) return 0;
      const s = tt - t0;
      const wn = 2 * Math.PI * fn;
      let v = Math.exp(-zeta * wn * s) * Math.sin(wn * Math.sqrt(1 - zeta * zeta) * s);
      if (second) {
        const w2 = 2.76 * wn; // second bending mode of a free–free beam sits at 2.76 f1
        v += 0.5 * Math.exp(-zeta * w2 * s) * Math.sin(w2 * s);
      }
      return v;
    }),
  );
  const spec = $derived(dftAmplitude(x, 1 / fs));
  const peak = $derived.by(() => {
    let best = 1;
    for (let i = 1; i < spec.amp.length; i++) if (spec.amp[i] > spec.amp[best]) best = i;
    return spec.freq[best];
  });

  // play the strike back slowly enough to see the mass move
  let playT = $state<number | null>(null);
  let raf = 0;
  const slow = $derived(Math.max(1, fn / 2));
  function strike() {
    cancelAnimationFrame(raf);
    const start = performance.now();
    const tick = (now: number) => {
      const tt = ((now - start) / 1000) / slow;
      if (tt > N / fs) { playT = null; return; }
      playT = tt;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  onDestroy(() => cancelAnimationFrame(raf));
  const disp = $derived(playT === null ? 0 : x[Math.min(N - 1, Math.floor(playT * fs))]);
  const top = 12;
  const bot = $derived(110 + disp * 40);
</script>

<div class="card">
  <div class="layout">
    <svg viewBox="0 0 120 200" class="rig" aria-label="Spring–mass system">
      <rect x="20" y="4" width="80" height="8" class="wall" />
      {#each { length: 9 } as _, i}<line x1={22 + i * 9} x2={30 + i * 9} y1="4" y2="-4" class="hatch" />{/each}
      <path
        d={'M60,' + top + Array.from({ length: 12 }, (_, i) => ` L${i % 2 ? 44 : 76},${top + ((bot - top) * (i + 0.5)) / 12}`).join('') + ` L60,${bot}`}
        class="spring"
      />
      <rect x="35" y={bot} width="50" height="34" rx="4" class="mass" />
      <text x="60" y={bot + 22} text-anchor="middle" class="mlabel">m</text>
      <text x="86" y="64" class="klabel">k</text>
    </svg>
    <div class="right">
      <div class="controls">
        <label class="control"><span>Stiffness k <b>{k.toFixed(0)} N/m</b></span><input type="range" min="100" max="20000" step="100" bind:value={k} /></label>
        <label class="control"><span>Mass m <b>{m.toFixed(2)} kg</b></span><input type="range" min="0.05" max="2" step="0.05" bind:value={m} /></label>
        <label class="control"><span>Damping ζ <b>{zeta.toFixed(3)}</b></span><input type="range" min="0.002" max="0.2" step="0.002" bind:value={zeta} /></label>
        <label class="check"><input type="checkbox" bind:checked={second} /> add a second mode (a beam, not a point mass)</label>
        <button class="primary" onclick={strike}>🔨 Strike it</button>
      </div>
      <LineChart
        series={[{ y: x, dx: 1 / fs, color: 'var(--accent)', width: 1.2 }]}
        xDomain={[0, Math.min(2, t0 + 12 / fn)]}
        height={app.mode === 'lecture' ? 200 : 160}
        xLabel="t (s)"
        yLabel="x (mm)"
        markers={playT !== null ? [{ x: playT, color: 'var(--cls-2)' }] : []}
        ariaLabel="Free response"
      />
      <LineChart
        series={[{ x: spec.freq, y: spec.amp, color: 'var(--accent)', width: 1.5, fill: true }]}
        xDomain={[0, Math.min(fs / 2, Math.max(60, (second ? 3.4 : 2) * fn))]}
        height={app.mode === 'lecture' ? 200 : 160}
        xLabel="frequency (Hz)"
        yLabel="amplitude"
        markers={[{ x: fn, label: `fₙ = √(k/m)/2π = ${fn.toFixed(1)} Hz`, color: 'var(--cls-2)', dash: true }]}
        ariaLabel="Amplitude spectrum"
      />
      <p class="small secondary">
        Spectrum peak at <b class="num">{peak.toFixed(1)} Hz</b>; theory says <b class="num">{fn.toFixed(1)} Hz</b> (resolution δf = {(fs / N).toFixed(2)} Hz).
        More damping gives a wider peak. Stiffen the spring and the peak moves up; add mass and it moves down. That's how
        impact-hammer tests find a structure's natural frequencies.
      </p>
    </div>
  </div>
</div>

<style>
  .layout { display: grid; grid-template-columns: 120px 1fr; gap: 1rem; align-items: start; }
  .layout > * { min-width: 0; }
  .rig { width: 120px; height: 200px; overflow: visible; }
  .wall { fill: var(--axis); }
  .hatch { stroke: var(--axis); }
  .spring { fill: none; stroke: var(--text-secondary); stroke-width: 2; stroke-linejoin: round; }
  .mass { fill: var(--accent); }
  .mlabel { fill: #fff; font-weight: 700; font-size: 14px; }
  .klabel { fill: var(--text-secondary); font-style: italic; font-size: 13px; }
  .check { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--text-secondary); }
  @media (max-width: 640px) { .layout { grid-template-columns: 1fr; } .rig { height: 140px; margin: 0 auto; display: block; } }
</style>
