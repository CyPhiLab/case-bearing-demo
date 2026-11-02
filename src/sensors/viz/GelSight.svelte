<script lang="ts">
  // Camera-based touch sensing (GelSight): an object pressed into a reflective elastomer is lit from three directions
  // with coloured lights. Each colour channel records how much the surface faces that light, which gives the surface
  // normal at every pixel (photometric stereo) and, integrated, the shape.
  import { onMount } from 'svelte';
  import LineChart from '../../lib/charts/LineChart.svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import { app } from '../../lib/state.svelte';

  const N = 160; // pixels across a 20 mm pad
  const MM = 20 / N;
  type Shape = 'sphere' | 'rod' | 'pins';
  let shape = $state<Shape>('sphere');
  let depth = $state(1); // mm
  const height = (x: number, y: number): number => {
    // x, y in mm from the pad center; returns indentation depth (mm, ≥ 0)
    if (shape === 'sphere') {
      const R = 6, r2 = x * x + y * y;
      const a = Math.sqrt(Math.max(0, 2 * R * depth - depth * depth));
      return r2 < a * a ? Math.sqrt(R * R - r2) - (R - depth) : 0;
    }
    if (shape === 'rod') {
      const R = 3, xr = 0.7 * x + 0.7 * y;
      const a = Math.sqrt(Math.max(0, 2 * R * depth - depth * depth));
      return Math.abs(xr) < a ? Math.sqrt(R * R - xr * xr) - (R - depth) : 0;
    }
    let h = 0;
    for (const [cx, cy] of [[-4, -4], [4, -4], [-4, 4], [4, 4], [0, 0]]) {
      const r2 = (x - cx) ** 2 + (y - cy) ** 2;
      h = Math.max(h, depth * Math.exp(-r2 / 1.2));
    }
    return h;
  };
  // three lights 120° apart, 30° above the pad
  const el = Math.PI / 6;
  const LIGHTS = [0, 2, 4].map((k) => {
    const az = (k * Math.PI) / 3;
    return [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
  });
  let canvas: HTMLCanvasElement;
  let recovered = $state<number[]>([]);
  let truth = $state<number[]>([]);
  function render() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(N, N);
    const H = new Float64Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = -height((i - N / 2) * MM, (j - N / 2) * MM);
    const I: number[][] = [];
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const gx = (H[j * N + Math.min(N - 1, i + 1)] - H[j * N + Math.max(0, i - 1)]) / (2 * MM);
        const gy = (H[Math.min(N - 1, j + 1) * N + i] - H[Math.max(0, j - 1) * N + i]) / (2 * MM);
        const nn = Math.hypot(gx, gy, 1);
        const n = [-gx / nn, -gy / nn, 1 / nn];
        const c = LIGHTS.map((L) => Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]));
        const p = (j * N + i) * 4;
        img.data[p] = 255 * c[0];
        img.data[p + 1] = 255 * c[1];
        img.data[p + 2] = 255 * c[2];
        img.data[p + 3] = 255;
        if (j === N / 2) I.push(c);
      }
    ctx.putImageData(img, 0, 0);
    // photometric stereo along the middle row: solve L n = I for n, then integrate the slope −n_x/n_z
    const L = LIGHTS;
    const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const D = det(L);
    let z = 0;
    const rec: number[] = [];
    for (const c of I) {
      const sol = [0, 1, 2].map((k) => det(L.map((row, r) => row.map((v, q) => (q === k ? c[r] : v)))) / D);
      z += (-sol[0] / sol[2]) * MM;
      rec.push(z);
    }
    recovered = rec.map((v) => -v);
    truth = Array.from({ length: N }, (_, i) => height((i - N / 2) * MM, 0));
  }
  onMount(render);
  $effect(() => {
    void shape;
    void depth;
    render();
  });
  const xs = Array.from({ length: N }, (_, i) => (i - N / 2) * MM);
</script>

<div class="card">
  <div class="controls">
    <Seg options={[{ value: 'sphere' as const, label: 'Ball' }, { value: 'rod' as const, label: 'Rod' }, { value: 'pins' as const, label: 'Five bumps' }]} bind:value={shape} label="Object" />
    <label class="control"><span>Indentation depth <b>{depth.toFixed(2)} mm</b></span><input type="range" min="0.1" max="2" step="0.05" bind:value={depth} /></label>
  </div>
  <div class="layout">
    <canvas bind:this={canvas} width={N} height={N} class="img" aria-label="Simulated camera image of the gel"></canvas>
    <LineChart
      series={[
        { x: xs, y: truth, color: 'var(--text-muted)', width: 3, label: 'true indentation' },
        { x: xs, y: recovered, color: 'var(--accent)', width: 1.6, label: 'recovered from the three colours', dash: [5, 3] },
      ]}
      xDomain={[-10, 10]}
      yDomain={[-0.2, 2.2]}
      height={app.mode === 'lecture' ? 220 : 190}
      xLabel="position across the middle of the pad (mm)"
      yLabel="depth (mm)"
      legend
      ariaLabel="Recovered indentation profile"
    />
  </div>
  <p class="small secondary">
    Red, green and blue lights shine from three sides. A flat area looks grey; a slope facing one light takes on that light's color. Because the
    three colors give three equations at each pixel, the surface slope can be solved for and integrated into a depth map with micrometre detail.
  </p>
</div>

<style>
  .layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 1rem; align-items: center; margin-top: 0.5rem; }
  .img { width: 220px; height: 220px; border-radius: 8px; image-rendering: auto; }
  @media (max-width: 640px) { .layout { grid-template-columns: minmax(0, 1fr); } .img { margin: 0 auto; display: block; } }
</style>
