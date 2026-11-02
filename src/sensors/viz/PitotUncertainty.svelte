<script lang="ts">
  // Because v ∝ √Δp, a fixed pressure uncertainty matters most at low speed: u_v/v = u_Δp / (2Δp).
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { pitotUncertainty, pitotVelocity } from '../lib/physics';
  import { app } from '../../lib/state.svelte';

  const rho = 1.225;
  let uDp = $state(2); // Pa
  const vs = Array.from({ length: 300 }, (_, i) => 0.5 + (i / 299) * 59.5);
  const rel = $derived(vs.map((v) => (pitotUncertainty(v, uDp, rho) / v) * 100));
  const dps = Array.from({ length: 300 }, (_, i) => (i / 299) * 2200);
  const vOfDp = dps.map((p) => pitotVelocity(p, rho));
  const vAt = (pct: number) => Math.sqrt(uDp / (rho * pct / 100)); // speed where u_v/v = pct
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Pressure transducer uncertainty <b>±{uDp.toFixed(1)} Pa</b></span><input type="range" min="0.2" max="20" step="0.1" bind:value={uDp} /></label>
  </div>
  <div class="grid-2">
    <LineChart
      series={[{ x: dps, y: vOfDp, color: 'var(--accent)', width: 2 }]}
      xDomain={[0, 2200]}
      yDomain={[0, 62]}
      height={app.mode === 'lecture' ? 220 : 190}
      xLabel="dynamic pressure Δp (Pa)"
      yLabel="velocity (m/s)"
      ariaLabel="Velocity vs dynamic pressure"
    />
    <LineChart
      series={[{ x: vs, y: rel, color: 'var(--cls-2)', width: 2, fill: true }]}
      xDomain={[0, 60]}
      yDomain={[0, 50]}
      height={app.mode === 'lecture' ? 220 : 190}
      xLabel="velocity (m/s)"
      yLabel="velocity uncertainty (%)"
      markers={[{ x: vAt(5), label: '5 %', color: 'var(--text-muted)', dash: true }]}
      ariaLabel="Relative velocity uncertainty"
    />
  </div>
  <p class="small secondary">
    The curve on the left is steep near zero: a small pressure change means a large change in speed. With ±{uDp.toFixed(1)} Pa, the velocity is known to
    5 % only above <b class="num">{vAt(5).toFixed(1)} m/s</b>. Pitot tubes are therefore poor at low speeds; hot-wire anemometers or larger-range
    instruments are used there.
  </p>
</div>
