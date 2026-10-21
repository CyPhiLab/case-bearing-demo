<script lang="ts" module>
  export interface ScatterPoint {
    x: number;
    y: number;
    cls: number;
    /** hollow points (e.g. test set) */
    hollow?: boolean;
    /** misclassified points get a ring */
    flag?: boolean;
  }
  export interface Boundary {
    /** n*n class probabilities, row-major starting bottom-left (y0) */
    probs: number[][];
    n: number;
    x0: number;
    x1: number;
    y0: number;
    y1: number;
  }
</script>

<script lang="ts">
  import * as d3 from 'd3';
  import { app } from '../state.svelte';
  import { CLASS_NAMES, CLASS_SHAPES, classColors, drawMarker } from '../classes';

  interface Props {
    points: ScatterPoint[];
    height?: number;
    xLabel?: string;
    yLabel?: string;
    xDomain?: [number, number];
    yDomain?: [number, number];
    boundary?: Boundary | null;
    highlight?: number | null;
    radius?: number;
    tooltip?: (i: number) => string;
    onselect?: (i: number) => void;
    onhover?: (i: number | null) => void;
    ariaLabel?: string;
  }

  let {
    points,
    height = 380,
    xLabel = '',
    yLabel = '',
    xDomain,
    yDomain,
    boundary = null,
    highlight = null,
    radius = 3.5,
    tooltip,
    onselect,
    onhover,
    ariaLabel = 'scatter plot',
  }: Props = $props();

  const margin = { top: 10, right: 14, bottom: 40, left: 52 };
  let width = $state(500);
  let canvas: HTMLCanvasElement;
  let hovered = $state<number | null>(null);

  const innerW = $derived(Math.max(10, width - margin.left - margin.right));
  const innerH = $derived(Math.max(10, height - margin.top - margin.bottom));

  function extent(vals: number[]): [number, number] {
    const [a, b] = d3.extent(vals) as [number, number];
    if (a === undefined) return [0, 1];
    const pad = (b - a) * 0.05 || 1;
    return [a - pad, b + pad];
  }
  const xd = $derived(xDomain ?? (boundary ? [boundary.x0, boundary.x1] : extent(points.map((p) => p.x))));
  const yd = $derived(yDomain ?? (boundary ? [boundary.y0, boundary.y1] : extent(points.map((p) => p.y))));
  const x = $derived(d3.scaleLinear().domain(xd).range([0, innerW]));
  const y = $derived(d3.scaleLinear().domain(yd).range([innerH, 0]));

  $effect(() => {
    void app.paletteTick;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerW * dpr;
    canvas.height = innerH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerW, innerH);
    const colors = classColors();
    const surface = getComputedStyle(canvas).getPropertyValue('--surface-1').trim();

    if (boundary) {
      // paint the n×n probability grid into a tiny bitmap, then let the browser smooth it up to size
      const { n, probs } = boundary;
      const rgb = colors.map((c) => [1, 3, 5].map((o) => parseInt(c.slice(o, o + 2), 16) || 128));
      const img = new ImageData(n, n);
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          const p = probs[j * n + i];
          let k = 0;
          for (let c = 1; c < p.length; c++) if (p[c] > p[k]) k = c;
          const o = ((n - 1 - j) * n + i) * 4;
          img.data.set([...rgb[k], Math.round(255 * (0.1 + 0.24 * Math.max(0, (p[k] - 0.25) / 0.75)))], o);
        }
      const tmp = document.createElement('canvas');
      tmp.width = tmp.height = n;
      tmp.getContext('2d')!.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tmp, x(boundary.x0), y(boundary.y1), x(boundary.x1) - x(boundary.x0), y(boundary.y0) - y(boundary.y1));
    }

    const order = points.map((_, i) => i);
    for (const i of order) {
      const p = points[i];
      const px = x(p.x), py = y(p.y);
      if (px < -5 || px > innerW + 5 || py < -5 || py > innerH + 5) continue;
      const shape = CLASS_SHAPES[p.cls];
      drawMarker(ctx, shape, px, py, radius);
      ctx.lineWidth = 1.5;
      if (shape === 'ring' || p.hollow) {
        ctx.fillStyle = surface;
        ctx.fill();
        ctx.strokeStyle = colors[p.cls];
        ctx.stroke();
      } else {
        ctx.fillStyle = colors[p.cls];
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = surface;
        ctx.lineWidth = 0.75;
        ctx.stroke();
      }
      if (p.flag) {
        ctx.beginPath();
        ctx.arc(px, py, radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--critical').trim();
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    for (const i of [highlight, hovered]) {
      if (i === null || i === undefined || !points[i]) continue;
      const p = points[i];
      ctx.beginPath();
      ctx.arc(x(p.x), y(p.y), radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--text-primary').trim();
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });

  function pick(e: PointerEvent): number | null {
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    let best: number | null = null, bd = 12 * 12;
    points.forEach((p, i) => {
      const d = (x(p.x) - mx) ** 2 + (y(p.y) - my) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
</script>

<div class="host" bind:clientWidth={width} style:height="{height}px">
  <svg {width} {height} role="img" aria-label={ariaLabel}>
    <g transform="translate({margin.left},{margin.top})">
      {#each y.ticks(6) as t}
        <line class="gridline" x1={0} x2={innerW} y1={y(t)} y2={y(t)} />
        <text class="tick" x={-8} y={y(t)} dy="0.32em" text-anchor="end">{y.tickFormat()(t)}</text>
      {/each}
      {#each x.ticks(Math.max(2, Math.floor(innerW / 80))) as t}
        <line class="gridline" y1={0} y2={innerH} x1={x(t)} x2={x(t)} />
        <text class="tick" x={x(t)} y={innerH + 16} text-anchor="middle">{x.tickFormat()(t)}</text>
      {/each}
      <text class="axis-label" x={innerW / 2} y={innerH + 34} text-anchor="middle">{xLabel}</text>
      <text class="axis-label" transform="translate({-margin.left + 13},{innerH / 2}) rotate(-90)" text-anchor="middle">{yLabel}</text>
    </g>
  </svg>
  <canvas
    bind:this={canvas}
    style:left="{margin.left}px"
    style:top="{margin.top}px"
    style:width="{innerW}px"
    style:height="{innerH}px"
    style:cursor={onselect && hovered !== null ? 'pointer' : 'default'}
    onpointermove={(e) => {
      const i = pick(e);
      if (i !== hovered) {
        hovered = i;
        onhover?.(i);
      }
    }}
    onpointerleave={() => {
      hovered = null;
      onhover?.(null);
    }}
    onclick={(e) => {
      const i = pick(e as unknown as PointerEvent);
      if (i !== null) onselect?.(i);
    }}
  ></canvas>
  {#if hovered !== null && points[hovered]}
    {@const p = points[hovered]}
    <div
      class="tooltip"
      style:left="{Math.min(width - 180, margin.left + x(p.x) + 14)}px"
      style:top="{Math.max(0, margin.top + y(p.y) - 30)}px"
    >
      {@html tooltip ? tooltip(hovered) : `<b>${CLASS_NAMES[p.cls]}</b>`}
    </div>
  {/if}
</div>

<style>
  .host { position: relative; width: 100%; min-width: 0; }
  svg, canvas { position: absolute; left: 0; top: 0; }
  .gridline { stroke: var(--grid); }
  .tick { fill: var(--text-muted); font-size: var(--chart-font); font-variant-numeric: tabular-nums; }
  .axis-label { fill: var(--text-secondary); font-size: var(--chart-label); }
</style>
