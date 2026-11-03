<script lang="ts">
  // Impact test on a cantilever (Euler–Bernoulli): the response is a sum of modes, and each mode is a peak
  // in the spectrum. Where you strike and where you measure set how strongly each mode appears.
  import { onDestroy } from 'svelte';
  import LineChart from '../../lib/charts/LineChart.svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import { dftAmplitude, linspace } from '../../lib/dsp/signals';
  import { app } from '../../lib/state.svelte';

  const BL = [1.8751, 4.6941, 7.8548, 10.9955]; // roots of 1 + cos βL cosh βL = 0
  const MAT = { steel: { E: 200e9, rho: 7850, label: 'Steel' }, aluminum: { E: 69e9, rho: 2700, label: 'Aluminum' } };
  let mat = $state<keyof typeof MAT>('steel');
  let L = $state(0.3); // m
  let h = $state(1); // mm
  let xs = $state(1); // strike position, x/L
  let xm = $state(1); // sensor position, x/L
  const zeta = 0.01;

  const phi = (n: number, u: number) => {
    const b = BL[n], s = (Math.cosh(b) + Math.cos(b)) / (Math.sinh(b) + Math.sin(b));
    return (Math.cosh(b * u) - Math.cos(b * u) - s * (Math.sinh(b * u) - Math.sin(b * u))) / 2;
  };
  const c = $derived(Math.sqrt((MAT[mat].E * (h / 1000) ** 2) / (12 * MAT[mat].rho)));
  const fn = $derived(BL.map((b) => (b * b * c) / (2 * Math.PI * L * L)));

  const fs = 4096;
  const N = 16384;
  const t = linspace(N, 1 / fs);
  const t0 = 0.05;
  // modal participation for an impulse at xs, read by a sensor at xm (unit modal mass)
  const amps = $derived(fn.map((f, n) => (phi(n, xs) * phi(n, xm)) / (2 * Math.PI * f)));
  const y = $derived(
    t.map((tt) => {
      if (tt < t0) return 0;
      const s = tt - t0;
      let v = 0;
      fn.forEach((f, n) => {
        const w = 2 * Math.PI * f;
        v += amps[n] * Math.exp(-zeta * w * s) * Math.sin(w * s);
      });
      return v;
    }),
  );
    // reference: the largest possible response, impact and sensor both at the tip (|φ_n| ≤ 1 everywhere),
  // so moving the impact or sensor changes the plotted amplitude instead of being normalized away
  const ymax = $derived(fn.reduce((s, f) => s + 1 / (2 * Math.PI * f), 0));
  const spec = $derived(dftAmplitude(y.map((v) => v / ymax), 1 / fs));
  const fTop = $derived(Math.min(fs / 2, fn[3] * 1.15));

  // animation: slow motion so the modes can be seen
  let playT = $state<number | null>(null);
  let raf = 0;
  function strike() {
    cancelAnimationFrame(raf);
    const start = performance.now();
    // slow enough that the fastest visible mode still looks smooth at 60 frames/s; stop after 6 s
    const slow = Math.max(4, 2 * (shown === 'sum' ? fn[0] : fn[shown]));
    const tick = (now: number) => {
      const tt = (now - start) / 1000 / slow + t0;
      if (now - start > 6000) { playT = null; return; }
      playT = tt;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  onDestroy(() => cancelAnimationFrame(raf));
  let shown = $state<'sum' | 0 | 1 | 2 | 3>('sum');
  const XS = Array.from({ length: 61 }, (_, i) => i / 60);
  const shape = $derived.by(() => {
    if (playT === null || playT < t0) {
      if (shown === 'sum') return XS.map(() => 0);
      return XS.map((u) => phi(shown as number, u) / Math.max(...XS.map((v) => Math.abs(phi(shown as number, v)))));
    }
    const s = playT - t0;
    const scale = Math.max(...fn.map((f, n) => Math.abs(phi(n, xs)) / (2 * Math.PI * f))) || 1;
    return XS.map((u) =>
      fn.reduce((acc, f, n) => {
        if (shown !== 'sum' && shown !== n) return acc;
        const w = 2 * Math.PI * f;
        return acc + ((phi(n, xs) / (2 * Math.PI * f)) * phi(n, u) * Math.exp(-zeta * w * s) * Math.sin(w * s)) / scale;
      }, 0) * 0.8,
    );
  });
  const W = 560, H = 150, x0 = 40, x1 = 540, yc = 75;
  const bx = (u: number) => x0 + u * (x1 - x0);
  const node2 = 0.7834; // node of mode 2
</script>

<div class="card">
  <div class="controls">
    <Seg bind:value={mat} label="Material" options={Object.entries(MAT).map(([k, m]) => ({ value: k as keyof typeof MAT, label: m.label }))} />
    <label class="control"><span>Length L <b>{(L * 100).toFixed(0)} cm</b></span><input type="range" min="0.1" max="0.6" step="0.01" bind:value={L} /></label>
    <label class="control"><span>Thickness h <b>{h.toFixed(1)} mm</b></span><input type="range" min="0.5" max="4" step="0.1" bind:value={h} /></label>
    <label class="control"><span>Impact at x/L <b>{xs.toFixed(2)}</b></span><input type="range" min="0.05" max="1" step="0.01" bind:value={xs} /></label>
    <label class="control"><span>Sensor at x/L <b>{xm.toFixed(2)}</b></span><input type="range" min="0.05" max="1" step="0.01" bind:value={xm} /></label>
    <button class="primary" onclick={strike}>Strike</button>
  </div>
  <div class="cols">
    <div>
      <svg viewBox="0 0 {W} {H}" class="beam" role="img" aria-label="Cantilever beam">
        <rect x={x0 - 14} y={yc - 40} width="14" height="80" class="wall" />
        <path d={XS.map((u, i) => `${i ? 'L' : 'M'}${bx(u).toFixed(1)},${(yc - 55 * shape[i]).toFixed(1)}`).join('')} class="bm" />
        <line x1={bx(0)} x2={bx(1)} y1={yc} y2={yc} class="rest" />
        <g transform="translate({bx(xs)},{yc - 55 * shape[Math.round(xs * 60)] - 10})">
          <path d="M0,0 l-6,-12 h12 z" class="hammer" />
        </g>
        <text x={bx(xs)} y="14" text-anchor="middle" class="lbl">impact</text>
        <rect x={bx(xm) - 5} y={yc - 55 * shape[Math.round(xm * 60)] + 3} width="10" height="7" class="sensor" />
        <text x={bx(xm)} y={H - 6} text-anchor="middle" class="lbl">sensor</text>
        <line x1={bx(node2)} x2={bx(node2)} y1={yc - 6} y2={yc + 6} class="node" />
        <text x={bx(node2)} y={yc + 20} text-anchor="middle" class="lbl muted">node of mode 2</text>
      </svg>
      <div class="controls">
        <Seg bind:value={shown} label="Show" options={[{ value: 'sum', label: 'all modes' }, ...[0, 1, 2, 3].map((n) => ({ value: n as 0 | 1 | 2 | 3, label: `mode ${n + 1}` }))]} />
      </div>
    </div>
    <table class="num">
      <thead><tr><th>mode</th><th>β<sub>n</sub>L</th><th>f<sub>n</sub> (Hz)</th><th>f<sub>n</sub>/f<sub>1</sub></th></tr></thead>
      <tbody>
        {#each fn as f, n}<tr><td>{n + 1}</td><td>{BL[n].toFixed(4)}</td><td>{f.toFixed(1)}</td><td>{(f / fn[0]).toFixed(2)}</td></tr>{/each}
      </tbody>
    </table>
  </div>
  <div class="grid-2">
    <LineChart
      series={[{ y: y.map((v) => v / ymax), dx: 1 / fs, color: 'var(--accent)', width: 1.2 }]}
            xDomain={[0, Math.min(N / fs, t0 + 8 / fn[0])]}
      yDomain={[-1.1, 1.1]}
      height={app.mode === 'lecture' ? 220 : 180}
      xLabel="t (s)"
      yLabel="response (re tip impact)"
      markers={playT !== null ? [{ x: playT, color: 'var(--cls-2)' }] : []}
      ariaLabel="Beam impact response"
    />
    <LineChart
      series={[{ x: spec.freq, y: spec.amp, color: 'var(--accent)', width: 1.5 }]}
            xDomain={[0, fTop]}
      logY
      yDomain={[1e-6, 1]}
      height={app.mode === 'lecture' ? 220 : 180}
      xLabel="frequency (Hz)"
      yLabel="amplitude"
      markers={fn.map((f, n) => ({ x: f, label: `f${n + 1}`, color: 'var(--cls-2)', dash: true }))}
      ariaLabel="Beam response spectrum"
    />
  </div>
  <p class="small secondary">
    Natural frequencies of a uniform cantilever: f<sub>n</sub> = (β<sub>n</sub>L)² / (2πL²) · √(EI/ρA). They are not integer
    multiples of f<sub>1</sub>, unlike the harmonics of a periodic signal. The impact excites mode n in proportion to the mode shape at
    the impact point, and the sensor reads it in proportion to the mode shape at the sensor. Move the impact or the sensor to
    x/L ≈ {node2.toFixed(2)}, a node of mode 2, and the second peak drops out of the spectrum. Thicker or shorter beams raise all
    frequencies; the ratios f<sub>n</sub>/f<sub>1</sub> stay fixed.
  </p>
</div>

<style>
  .cols { display: grid; grid-template-columns: 1fr minmax(220px, 300px); gap: 1rem; align-items: start; }
  .cols > * { min-width: 0; }
  .beam { width: 100%; height: auto; max-height: 190px; overflow: visible; }
  .wall { fill: var(--axis); }
  .bm { fill: none; stroke: var(--accent); stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; }
  .rest { stroke: var(--grid); stroke-dasharray: 3 3; }
  .hammer { fill: var(--cls-2); }
  .sensor { fill: var(--focus); }
  .node { stroke: var(--text-muted); stroke-width: 2; }
  .lbl { font-size: 11px; fill: var(--text-secondary); }
  .lbl.muted { fill: var(--text-muted); }
  table { border-collapse: collapse; font-size: 0.85rem; width: 100%; }
  th, td { padding: 0.2rem 0.5rem; text-align: right; border-bottom: 1px solid var(--grid); }
  th { color: var(--text-muted); font-weight: 600; }
  @media (max-width: 760px) { .cols { grid-template-columns: 1fr; } }
</style>
