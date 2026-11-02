<script lang="ts">
  // A 2D scanning lidar in a room. The beam rotates, each angle returns the nearest hit with some range noise;
  // dark surfaces and grazing angles return too little light and drop out. Drag the objects.
  import { onDestroy, onMount } from 'svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import { gaussian } from '../../lib/dsp/signals';

  const W = 8, H = 5.5; // m
  const S = 50; // px per m
  interface Box { kind: 'box'; x: number; y: number; w: number; h: number; dark?: boolean; label: string }
  interface Circ { kind: 'circle'; x: number; y: number; r: number; label: string }
  let objs = $state<(Box | Circ)[]>([
    { kind: 'box', x: 1.0, y: 0.8, w: 1.4, h: 0.8, label: 'table' },
    { kind: 'box', x: 5.6, y: 3.6, w: 1.2, h: 1.0, dark: true, label: 'black sofa' },
    { kind: 'circle', x: 5.8, y: 1.5, r: 0.3, label: 'column' },
  ]);
  const scanner = { x: 3.2, y: 2.9 };
  let step = $state(2); // degrees
  let sigma = $state(2); // cm
  let sweep = $state(360);
  const segs = $derived.by(() => {
    const s: { a: [number, number]; b: [number, number]; dark: boolean }[] = [
      { a: [0, 0], b: [W, 0], dark: false },
      { a: [W, 0], b: [W, H], dark: false },
      { a: [W, H], b: [0, H], dark: false },
      { a: [0, H], b: [0, 0], dark: false },
    ];
    for (const o of objs) {
      if (o.kind !== 'box') continue;
      const p: [number, number][] = [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]];
      for (let i = 0; i < 4; i++) s.push({ a: p[i], b: p[(i + 1) % 4], dark: !!o.dark });
    }
    return s;
  });
  function cast(th: number) {
    const dx = Math.cos(th), dy = Math.sin(th);
    let best = Infinity, dark = false, cosInc = 1;
    for (const { a, b, dark: dk } of segs) {
      const ex = b[0] - a[0], ey = b[1] - a[1];
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const wx = a[0] - scanner.x, wy = a[1] - scanner.y;
      const t = (wx * ey - wy * ex) / den;
      const u = (wx * dy - wy * dx) / den;
      if (t > 1e-6 && u >= 0 && u <= 1 && t < best) {
        best = t;
        dark = dk;
        cosInc = Math.abs(dx * ey - dy * ex) / Math.hypot(ex, ey);
      }
    }
    for (const o of objs) {
      if (o.kind !== 'circle') continue;
      const fx = scanner.x - o.x, fy = scanner.y - o.y;
      const bq = fx * dx + fy * dy;
      const c = fx * fx + fy * fy - o.r * o.r;
      const disc = bq * bq - c;
      if (disc < 0) continue;
      const t = -bq - Math.sqrt(disc);
      if (t > 1e-6 && t < best) {
        best = t;
        dark = false;
        const nx = (scanner.x + t * dx - o.x) / o.r, ny = (scanner.y + t * dy - o.y) / o.r;
        cosInc = Math.abs(nx * dx + ny * dy);
      }
    }
    return { r: best, dark, cosInc };
  }
  const pts = $derived.by(() => {
    const n = Math.round(360 / step);
    const g = gaussian(n, sigma / 100, 7);
    const u = gaussian(n, 1, 8);
    const out: { x: number; y: number; deg: number }[] = [];
    for (let i = 0; i < n; i++) {
      const deg = i * step;
      const th = (deg * Math.PI) / 180;
      const h = cast(th);
      // returned signal ∝ reflectivity × cos(incidence) / r²; drop the point when it falls below a threshold
      const sig = ((h.dark ? 0.08 : 0.8) * h.cosInc) / (h.r * h.r);
      if (sig * (1 + 0.3 * u[i]) < 0.012) continue;
      const r = h.r + g[i];
      out.push({ x: scanner.x + r * Math.cos(th), y: scanner.y + r * Math.sin(th), deg });
    }
    return out;
  });
  const visible = $derived(pts.filter((p) => p.deg <= sweep));

  let raf = 0;
  let playing = $state(false);
  function scan() {
    cancelAnimationFrame(raf);
    playing = true;
    const t0 = performance.now();
    const tick = (now: number) => {
      sweep = ((now - t0) / 2500) * 360;
      if (sweep >= 360) { sweep = 360; playing = false; return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  onMount(scan);
  onDestroy(() => cancelAnimationFrame(raf));

  // dragging
  let svg: SVGSVGElement;
  let drag: { i: number; ox: number; oy: number } | null = null;
  function toWorld(e: PointerEvent) {
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const q = p.matrixTransform(svg.getScreenCTM()!.inverse());
    return [q.x / S, q.y / S];
  }
  function down(i: number, e: PointerEvent) {
    const [x, y] = toWorld(e);
    drag = { i, ox: x - objs[i].x, oy: y - objs[i].y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!drag) return;
    const [x, y] = toWorld(e);
    const o = objs[drag.i];
    o.x = Math.min(W - 0.3, Math.max(0.1, x - drag.ox));
    o.y = Math.min(H - 0.3, Math.max(0.1, y - drag.oy));
  }
  const beam = $derived((sweep * Math.PI) / 180);
</script>

<div class="card">
  <div class="controls">
    <span class="small">Angular step</span>
    <Seg options={[0.5, 1, 2, 5].map((v) => ({ value: v, label: `${v}°` }))} bind:value={step} label="Angular step" />
    <label class="control"><span>Range noise <b>{sigma} cm</b></span><input type="range" min="0" max="10" step="0.5" bind:value={sigma} /></label>
    <button onclick={scan} disabled={playing}>Scan again</button>
  </div>
  <svg
    bind:this={svg}
    viewBox="-10 -10 {W * S + 20} {H * S + 20}"
    class="room"
    role="img"
    aria-label="Top view of a room scanned by a lidar"
    onpointermove={move}
    onpointerup={() => (drag = null)}
  >
    <rect x="0" y="0" width={W * S} height={H * S} class="walls" />
    {#each objs as o, i}
      {#if o.kind === 'box'}
        <rect x={o.x * S} y={o.y * S} width={o.w * S} height={o.h * S} class="obj" class:dark={o.dark} onpointerdown={(e) => down(i, e)} role="button" tabindex="-1" aria-label="Drag {o.label}" />
        <text x={(o.x + o.w / 2) * S} y={(o.y + o.h / 2) * S + 4} text-anchor="middle" class="ol" class:dl={o.dark}>{o.label}</text>
      {:else}
        <circle cx={o.x * S} cy={o.y * S} r={o.r * S} class="obj" onpointerdown={(e) => down(i, e)} role="button" tabindex="-1" aria-label="Drag {o.label}" />
      {/if}
    {/each}
    {#if playing}
      <line x1={scanner.x * S} y1={scanner.y * S} x2={(scanner.x + 12 * Math.cos(beam)) * S} y2={(scanner.y + 12 * Math.sin(beam)) * S} class="beam" />
    {/if}
    {#each visible as p}<circle cx={p.x * S} cy={p.y * S} r="2.2" class="pt" />{/each}
    <circle cx={scanner.x * S} cy={scanner.y * S} r="7" class="scanner" />
  </svg>
  <p class="small secondary">
    {visible.length} of {Math.round(360 / step)} beams returned a point. Drag the objects to rearrange the room. The black sofa reflects too little
    light, and surfaces hit at a grazing angle return too little, so parts of the room are missing from the point cloud. Objects behind other objects
    are not seen at all (shadowing); real lidars combine scans from several positions.
  </p>
</div>

<style>
  .room { width: 100%; max-width: 620px; display: block; margin: 0.6rem auto; touch-action: none; }
  .walls { fill: var(--surface-2); stroke: var(--text-muted); stroke-width: 2; }
  .obj { fill: var(--surface-3); stroke: var(--text-muted); cursor: grab; }
  .obj.dark { fill: #222; }
  .ol { font-size: 11px; fill: var(--text-secondary); pointer-events: none; }
  .ol.dl { fill: #ddd; }
  .beam { stroke: var(--cls-2); stroke-width: 1.5; opacity: 0.7; }
  .pt { fill: var(--cls-2); }
  .scanner { fill: var(--accent); stroke: var(--surface-1); stroke-width: 2; }
</style>
