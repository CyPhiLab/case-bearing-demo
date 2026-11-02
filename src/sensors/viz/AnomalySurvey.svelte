<script lang="ts">
  // Magnetic survey: a towed magnetometer passes over a buried iron object. The object's induced dipole field adds
  // a few nT to the ~50 000 nT Earth field. The anomaly falls off as 1/r³.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import { app } from '../../lib/state.svelte';

  const OBJ = {
    anchor: { m: 300, label: 'Anchor (~200 kg)' },
    cannon: { m: 3000, label: 'Cannon (~2 t)' },
    wreck: { m: 1e5, label: 'Steel wreck (~1000 t)' },
  } as const;
  let obj = $state<keyof typeof OBJ>('cannon');
  let depth = $state(15);
  let offset = $state(0);
  const xs = Array.from({ length: 401 }, (_, i) => -100 + i * 0.5);
  // vertical induced dipole, vertical field (high-latitude approximation): ΔB = (μ0/4π) m (3cos²θ − 1)/r³
  const prof = $derived(
    xs.map((x) => {
      const r = Math.hypot(x, offset, depth);
      const c = depth / r;
      return Math.abs(1e-7 * OBJ[obj].m * (3 * c * c - 1) / r ** 3) * 1e9;
    }),
  );
  const peak = $derived(Math.max(...prof));
</script>

<div class="card">
  <div class="controls">
    <Seg options={Object.entries(OBJ).map(([value, o]) => ({ value: value as keyof typeof OBJ, label: o.label }))} bind:value={obj} label="Buried object" />
    <label class="control"><span>Depth below the sensor <b>{depth} m</b></span><input type="range" min="3" max="60" step="1" bind:value={depth} /></label>
    <label class="control"><span>Survey line offset <b>{offset} m</b></span><input type="range" min="0" max="50" step="1" bind:value={offset} /></label>
  </div>
  <LineChart
    series={[{ x: xs, y: prof, color: 'var(--accent)', width: 2, fill: true }]}
    logY
    xDomain={[-100, 100]}
    yDomain={[0.01, 1e5]}
    height={app.mode === 'lecture' ? 220 : 190}
    xLabel="position along the survey line (m)"
    yLabel="|field anomaly| (nT)"
    markers={[{ x: 0, label: 'closest approach', color: 'var(--text-muted)', dash: true }]}
    bands={[]}
    ariaLabel="Magnetic anomaly along the survey line"
  />
  <p class="small secondary">
    Peak anomaly <b class="num">{peak < 1 ? peak.toFixed(2) : peak.toFixed(0)} nT</b>, against an Earth field of about 50 000 nT. A marine
    magnetometer resolves about 0.1 nT, so the object is {peak > 1 ? 'clearly detectable' : peak > 0.1 ? 'barely detectable' : 'not detectable'}.
    Doubling the distance reduces the anomaly eightfold. The dip on each side is where the dipole field reverses sign.
  </p>
</div>
