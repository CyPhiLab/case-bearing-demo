<script lang="ts">
  // Laser Doppler vibrometry: light reflected from a moving surface is shifted by f_D = 2v/λ. Mixed with the
  // reference beam it produces fringes; without a frequency-shifted reference the sign of v is lost.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { dopplerShift } from '../lib/physics';
  import { app } from '../../lib/state.svelte';

  const lambda = 632.8e-9;
  let V = $state(100); // peak velocity, mm/s
  let f = $state(100); // vibration frequency, Hz
  const w = $derived(2 * Math.PI * f);
  const X = $derived((V / 1000) / w); // displacement amplitude, m
  // Doppler shift over two vibration periods
  const tt = Array.from({ length: 600 }, (_, i) => (i / 599) * 2);
  const fd = $derived(tt.map((p) => dopplerShift(((V / 1000) * Math.cos(2 * Math.PI * p)), lambda) / 1000));
  const fdAbs = $derived(fd.map(Math.abs));
  // detector signal near the turning point (v = 0): cos(4πx/λ) with x = X cos(ωt) around t = 0. The window is
  // narrowed for large motions so that about ten fringes appear on each side.
  const pw = $derived(Math.min(1 / 12, Math.acos(Math.max(-1, 1 - (10 * lambda) / X)) / (2 * Math.PI)));
  const tz = $derived(Array.from({ length: 2000 }, (_, i) => -pw + (2 * pw * i) / 1999)); // periods relative to the turning point
  const fringes = $derived(tz.map((p) => Math.cos((4 * Math.PI * X * Math.cos(2 * Math.PI * p)) / lambda)));
  const nFringes = $derived((8 * X) / lambda);
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Peak surface velocity <b>{V} mm/s</b></span><input type="range" min="1" max="200" step="1" bind:value={V} /></label>
    <label class="control"><span>Vibration frequency <b>{f} Hz</b></span><input type="range" min="20" max="1000" step="10" bind:value={f} /></label>
  </div>
  <div class="grid-2">
    <LineChart
      series={[
        { x: tt, y: fd, color: 'var(--accent)', width: 2, label: 'with frequency shift (sign kept)' },
        { x: tt, y: fdAbs, color: 'var(--cls-2)', width: 1.5, dash: [4, 3], label: 'without (only |f_D|)' },
      ]}
      xDomain={[0, 2]}
      yDomain={[-700, 900]}
      height={app.mode === 'lecture' ? 220 : 190}
      xLabel="time (vibration periods)"
      yLabel="Doppler shift (kHz)"
      legend
      ariaLabel="Doppler shift over time"
    />
    <LineChart
      series={[{ x: tz.map((p) => (p / f) * 1000), y: fringes, color: 'var(--text-secondary)', width: 1 }]}
      xDomain={[(-pw / f) * 1000, (pw / f) * 1000]}
      yDomain={[-1.2, 1.2]}
      height={app.mode === 'lecture' ? 220 : 190}
      xLabel="time around a turning point (ms)"
      yLabel="detector signal"
      markers={[{ x: 0, label: 'v = 0', color: 'var(--cls-2)', dash: true }]}
      ariaLabel="Interference fringes near a turning point"
    />
  </div>
  <p class="small secondary">
    Displacement amplitude <b class="num">{(X * 1e6).toFixed(2)} µm</b>; peak Doppler shift <b class="num">{(dopplerShift(V / 1000, lambda) / 1000).toFixed(1)} kHz</b>
    for a helium–neon laser (λ = 632.8 nm). Each λ/2 = 316 nm of motion produces one fringe, about <b class="num">{nFringes.toFixed(0)}</b> per vibration
    cycle. Near the turning point (right) the fringes slow down, stop and speed up again, and the signal looks the same whichever way the surface
    moves. Shifting the reference beam by 40 MHz with an acousto-optic (Bragg) cell moves the beat to 40 MHz ± f<sub>D</sub>, which keeps the sign.
  </p>
</div>
