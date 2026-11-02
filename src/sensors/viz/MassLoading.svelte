<script lang="ts">
  // Mass loading: an accelerometer glued to a light structure adds mass and lowers its natural frequencies.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { MATERIALS, beamFreqs, loadedFreq, phi } from '../../lib/beam';
  import { app } from '../../lib/state.svelte';

  const L = 0.3, b = 0.025, h = 0.002;
  const { E, rho } = MATERIALS.steel;
  const mBeam = L * b * h * rho; // kg
  const f0 = beamFreqs(E, rho, h, L).slice(0, 3);
  let M = $state(5); // g
  let u = $state(1); // sensor position x/L
  const zeta = 0.01;
  const fL = $derived(f0.map((f, n) => loadedFreq(f, n, M / 1000 / mBeam, u)));

  const fmax = f0[2] * 1.2;
  const freqs = Array.from({ length: 1500 }, (_, i) => 1 + (i / 1499) * (fmax - 1));
  // point receptance at the sensor (accelerance shape), modal sum with unit modal mass, scaled by ω₁²
  const frf = (fs: number[], uu: number) =>
    freqs.map((f) => {
      let re = 0, im = 0;
      fs.forEach((fn, n) => {
        const r = f / fn;
        const g = phi(n, uu) ** 2 * (f0[0] / f0[n]) ** 2; // modal stiffness is unchanged by the added mass
        const D = (1 - r * r) ** 2 + (2 * zeta * r) ** 2;
        re += (g * (1 - r * r)) / D;
        im -= (g * 2 * zeta * r) / D;
      });
      return Math.hypot(re, im);
    });
  const bare = $derived(frf(f0, u));
  const loaded = $derived(frf(fL, u));
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Accelerometer mass <b>{M.toFixed(1)} g</b> ({((M / 1000 / mBeam) * 100).toFixed(0)} % of the beam)</span><input type="range" min="0" max="30" step="0.5" bind:value={M} /></label>
    <label class="control"><span>Mounting position x/L <b>{u.toFixed(2)}</b></span><input type="range" min="0.1" max="1" step="0.01" bind:value={u} /></label>
  </div>
  <svg viewBox="0 0 440 60" class="rig" role="img" aria-label="Cantilever with an accelerometer attached">
    <rect x="20" y="10" width="16" height="44" class="wall" />
    <rect x="36" y="28" width="380" height="6" class="beam" />
    <rect x={36 + u * 380 - 5 - M / 4} y={28 - 6 - M / 2} width={10 + M / 2} height={6 + M / 2} rx="2" class="acc" />
  </svg>
  <LineChart
    series={[
      { x: freqs, y: bare, color: 'var(--text-muted)', width: 1.5, label: 'bare beam', dash: [4, 3] },
      { x: freqs, y: loaded, color: 'var(--accent)', width: 2, label: 'with accelerometer' },
    ]}
    logY
    xDomain={[0, fmax]}
    yDomain={[1e-3, 200]}
    height={app.mode === 'lecture' ? 240 : 200}
    xLabel="frequency (Hz)"
    yLabel="response at the sensor"
    legend
    ariaLabel="Frequency response with and without the accelerometer"
  />
  <table class="small num">
    <thead><tr><th>Mode</th><th>bare beam</th><th>with accelerometer</th><th>shift</th></tr></thead>
    <tbody>
      {#each f0 as f, n}
        <tr><td>{n + 1}</td><td>{f.toFixed(1)} Hz</td><td>{fL[n].toFixed(1)} Hz</td><td>{(((fL[n] - f) / f) * 100).toFixed(1)} %</td></tr>
      {/each}
    </tbody>
  </table>
  <p class="small muted">Steel beam {L * 1000} × {b * 1000} × {h * 1000} mm, mass {(mBeam * 1000).toFixed(0)} g. Rayleigh estimate: the mode shapes are assumed unchanged.</p>
</div>

<style>
  .rig { width: 100%; max-height: 80px; }
  .wall { fill: var(--axis); }
  .beam { fill: var(--surface-3); stroke: var(--text-muted); }
  .acc { fill: var(--cls-2); }
  table { border-collapse: collapse; margin-top: 0.5rem; }
  th, td { padding: 0.15rem 0.8rem 0.15rem 0; text-align: left; }
  th { font-weight: 600; color: var(--text-secondary); }
</style>
