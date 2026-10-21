<script lang="ts" module>
  export interface LineSeries {
    y: ArrayLike<number>;
    /** explicit x values; otherwise x = xStart + i * dx */
    x?: ArrayLike<number>;
    xStart?: number;
    dx?: number;
    color: string; // CSS color or var(--token)
    width?: number;
    label?: string;
    dash?: number[];
    /** fill the area between the line and zero */
    fill?: boolean;
  }
  export interface Marker {
    x: number;
    label?: string;
    color?: string;
    dash?: boolean;
    /** stack labels of nearby markers on separate rows */
    row?: number;
  }
  export interface Band {
    x0: number;
    x1: number;
    fill: string;
    label?: string;
  }
</script>

<script lang="ts">
  import * as d3 from 'd3';
  import { app } from '../state.svelte';

  interface Props {
    series: LineSeries[];
    height?: number;
    xDomain?: [number, number];
    yDomain?: [number, number];
    xLabel?: string;
    yLabel?: string;
    xFormat?: (v: number) => string;
    yFormat?: (v: number) => string;
    markers?: Marker[];
    bands?: Band[];
    logY?: boolean;
    /** show a crosshair + tooltip with every series' value */
    hover?: boolean;
    legend?: boolean;
    /** pointer interaction in data coordinates */
    onpoint?: (x: number, phase: 'down' | 'move' | 'up') => void;
    /** extra SVG drawn in plot coordinates */
    overlay?: import('svelte').Snippet<[{ x: d3.ScaleLinear<number, number>; y: d3.ScaleContinuousNumeric<number, number>; w: number; h: number }]>;
    ariaLabel?: string;
    margin?: { top: number; right: number; bottom: number; left: number };
  }

  let {
    series,
    height = 220,
    xDomain,
    yDomain,
    xLabel = '',
    yLabel = '',
    xFormat,
    yFormat,
    markers = [],
    bands = [],
    logY = false,
    hover = true,
    legend = false,
    onpoint,
    overlay,
    ariaLabel = 'chart',
    margin = { top: 10, right: 14, bottom: 38, left: 56 },
  }: Props = $props();

  let width = $state(600);
  let canvas: HTMLCanvasElement;
  let hostEl: HTMLDivElement;
  let hoverX = $state<number | null>(null);
  let dragging = false;

  const xAt = (s: LineSeries, i: number) => (s.x ? s.x[i] : (s.xStart ?? 0) + i * (s.dx ?? 1));

  const innerW = $derived(Math.max(10, width - margin.left - margin.right));
  const innerH = $derived(Math.max(10, height - margin.top - margin.bottom));

  const xd = $derived.by((): [number, number] => {
    if (xDomain) return xDomain;
    let lo = Infinity, hi = -Infinity;
    for (const s of series) {
      if (!s.y.length) continue;
      lo = Math.min(lo, xAt(s, 0));
      hi = Math.max(hi, xAt(s, s.y.length - 1));
    }
    return Number.isFinite(lo) ? [lo, hi] : [0, 1];
  });

  const yd = $derived.by((): [number, number] => {
    if (yDomain) return yDomain;
    let lo = Infinity, hi = -Infinity;
    for (const s of series)
      for (let i = 0; i < s.y.length; i++) {
        const x = xAt(s, i);
        if (x < xd[0] || x > xd[1]) continue;
        const v = s.y[i];
        if (logY && v <= 0) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    if (!Number.isFinite(lo)) return [0, 1];
    if (logY) return [Math.max(lo, hi * 1e-5), hi * 1.5];
    const pad = (hi - lo) * 0.06 || 1;
    return [lo - pad, hi + pad];
  });

  const x = $derived(d3.scaleLinear().domain(xd).range([0, innerW]));
  const y = $derived(
    (logY ? d3.scaleLog() : d3.scaleLinear()).domain(yd).range([innerH, 0]) as d3.ScaleContinuousNumeric<number, number>,
  );
  const xTicks = $derived(x.ticks(Math.max(2, Math.floor(innerW / 90))));
  // log axes: label only 1-2-5 steps (or just powers of ten when that is still too many)
  const yTicks = $derived.by(() => {
    if (!logY) return y.ticks(Math.max(2, Math.floor(innerH / 45)));
    const mant = (t: number) => Math.round(t / 10 ** Math.floor(Math.log10(t) + 1e-9));
    const t125 = y.ticks().filter((t) => [1, 2, 5].includes(mant(t)));
    return t125.length <= Math.max(3, innerH / 28) ? t125 : t125.filter((t) => mant(t) === 1);
  });
  const fx = $derived(xFormat ?? x.tickFormat());
  const fy = $derived(yFormat ?? (logY ? d3.format('~g') : y.tickFormat()));

  function resolve(color: string): string {
    const m = color.match(/^var\((--[\w-]+)\)$/);
    return m ? getComputedStyle(hostEl).getPropertyValue(m[1]).trim() : color;
  }

  $effect(() => {
    // redraw whenever inputs, size or palette change
    void app.paletteTick;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerW * dpr;
    canvas.height = innerH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerW, innerH);
    for (const s of series) drawSeries(ctx, s);
  });

  function drawSeries(ctx: CanvasRenderingContext2D, s: LineSeries) {
    const n = s.y.length;
    if (!n) return;
    const color = resolve(s.color);
    ctx.strokeStyle = color;
    ctx.lineWidth = s.width ?? 1.5;
    ctx.lineJoin = 'round';
    ctx.setLineDash(s.dash ?? []);
    const [a, b] = xd;
    // index range in view (assumes x increasing)
    let i0 = 0, i1 = n - 1;
    while (i0 < n - 1 && xAt(s, i0 + 1) < a) i0++;
    while (i1 > 0 && xAt(s, i1 - 1) > b) i1--;
    const count = i1 - i0 + 1;
    const pts: [number, number][] = [];
    const clampY = (v: number) => (logY && v <= 0 ? innerH : y(v));
    if (count > innerW * 2) {
      // min/max decimation per pixel column keeps every spike visible
      let col = -1, mn = 0, mx = 0, first = 0, last = 0;
      const flush = () => {
        if (col < 0) return;
        pts.push([col, clampY(first)]);
        pts.push([col, clampY(mx)]);
        pts.push([col, clampY(mn)]);
        pts.push([col, clampY(last)]);
      };
      for (let i = i0; i <= i1; i++) {
        const c = Math.round(x(xAt(s, i)));
        const v = s.y[i];
        if (c !== col) {
          flush();
          col = c; mn = mx = first = last = v;
        } else {
          if (v < mn) mn = v;
          if (v > mx) mx = v;
          last = v;
        }
      }
      flush();
    } else {
      for (let i = i0; i <= i1; i++) pts.push([x(xAt(s, i)), clampY(s.y[i])]);
    }
    if (s.fill) {
      ctx.beginPath();
      const base = logY ? innerH : y(Math.max(yd[0], Math.min(0, yd[1])));
      ctx.moveTo(pts[0][0], base);
      for (const [px, py] of pts) ctx.lineTo(px, py);
      ctx.lineTo(pts[pts.length - 1][0], base);
      ctx.closePath();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
  }

  function dataX(e: PointerEvent): number {
    const r = canvas.getBoundingClientRect();
    return x.invert(Math.max(0, Math.min(innerW, e.clientX - r.left)));
  }

  function nearest(s: LineSeries, xv: number): number {
    if (!s.x) return Math.max(0, Math.min(s.y.length - 1, Math.round((xv - (s.xStart ?? 0)) / (s.dx ?? 1))));
    let lo = 0, hi = s.x.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (s.x[mid] < xv) lo = mid;
      else hi = mid;
    }
    return Math.abs(s.x[lo] - xv) < Math.abs(s.x[hi] - xv) ? lo : hi;
  }

  const tip = $derived.by(() => {
    if (hoverX === null || !hover) return null;
    const rows = series
      .filter((s) => s.y.length)
      .map((s) => {
        const i = nearest(s, hoverX!);
        return { label: s.label ?? '', color: s.color, x: xAt(s, i), v: s.y[i] };
      });
    return rows.length ? { x: rows[0].x, rows } : null;
  });
</script>

<div class="host" bind:this={hostEl} bind:clientWidth={width} style:height="{height}px">
  <svg {width} {height} role="img" aria-label={ariaLabel}>
    <g transform="translate({margin.left},{margin.top})">
      {#each bands as b}
        {@const bx0 = Math.max(0, x(b.x0))}
        {@const bx1 = Math.min(innerW, x(b.x1))}
        {#if bx1 > bx0}
          <rect x={bx0} y={0} width={bx1 - bx0} height={innerH} fill={b.fill} />
          {#if b.label && bx1 - bx0 > 40}
            <text class="band-label" x={(bx0 + bx1) / 2} y={12} text-anchor="middle">{b.label}</text>
          {/if}
        {/if}
      {/each}
      {#each yTicks as t}
        <line class="gridline" x1={0} x2={innerW} y1={y(t)} y2={y(t)} />
        <text class="tick" x={-8} y={y(t)} dy="0.32em" text-anchor="end">{fy(t)}</text>
      {/each}
      {#each xTicks as t}
        <text class="tick" x={x(t)} y={innerH + 16} text-anchor="middle">{fx(t)}</text>
      {/each}
      <line class="axis" x1={0} x2={innerW} y1={innerH} y2={innerH} />
      {#if xLabel}<text class="axis-label" x={innerW / 2} y={innerH + 33} text-anchor="middle">{xLabel}</text>{/if}
      {#if yLabel}
        <text class="axis-label" transform="translate({-margin.left + 13},{innerH / 2}) rotate(-90)" text-anchor="middle">{yLabel}</text>
      {/if}
    </g>
  </svg>
  <canvas
    bind:this={canvas}
    style:left="{margin.left}px"
    style:top="{margin.top}px"
    style:width="{innerW}px"
    style:height="{innerH}px"
    class:interactive={!!onpoint}
    onpointerdown={(e) => {
      if (!onpoint) return;
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
      onpoint(dataX(e), 'down');
    }}
    onpointermove={(e) => {
      hoverX = dataX(e);
      if (dragging) onpoint?.(dataX(e), 'move');
    }}
    onpointerup={(e) => {
      if (dragging) onpoint?.(dataX(e), 'up');
      dragging = false;
    }}
    onpointerleave={() => (hoverX = null)}
  ></canvas>
  <svg class="over" {width} {height} aria-hidden="true">
    <g transform="translate({margin.left},{margin.top})">
      {#each markers as m}
        {#if m.x >= xd[0] && m.x <= xd[1]}
          <line class="marker" x1={x(m.x)} x2={x(m.x)} y1={0} y2={innerH} stroke={m.color ?? 'var(--text-muted)'} stroke-dasharray={m.dash ? '4 3' : undefined} />
          {#if m.label}
            <text class="marker-label" x={x(m.x) + 3} y={10 + (m.row ?? 0) * 13} fill={m.color ?? 'var(--text-secondary)'}>{m.label}</text>
          {/if}
        {/if}
      {/each}
      {#if overlay}{@render overlay({ x, y, w: innerW, h: innerH })}{/if}
      {#if tip}
        <line class="crosshair" x1={x(tip.x)} x2={x(tip.x)} y1={0} y2={innerH} />
      {/if}
    </g>
  </svg>
  {#if tip}
    <div class="tooltip" style:left="{Math.min(width - 150, margin.left + x(tip.x) + 12)}px" style:top="{margin.top + 4}px">
      <div class="muted">{xLabel ? `${xLabel.replace(/ \(.*\)/, '')}: ` : ''}{fx(tip.x)}</div>
      {#each tip.rows as r}
        <div><span class="swatch" style:background={r.color}></span>{r.label ? `${r.label}: ` : ''}<b class="num">{d3.format('.4~g')(r.v)}</b></div>
      {/each}
    </div>
  {/if}
  {#if legend}
    <div class="legend">
      {#each series.filter((s) => s.label) as s}
        <span><span class="swatch" style:background={s.color}></span>{s.label}</span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .host {
    position: relative;
    width: 100%;
    min-width: 0;
  }
  svg, canvas {
    position: absolute;
    left: 0;
    top: 0;
  }
  svg.over { pointer-events: none; }
  canvas { touch-action: pan-y; }
  canvas.interactive { cursor: ew-resize; touch-action: none; }
  .gridline { stroke: var(--grid); stroke-width: 1; }
  .axis { stroke: var(--axis); }
  .tick { fill: var(--text-muted); font-size: var(--chart-font); font-variant-numeric: tabular-nums; }
  .axis-label { fill: var(--text-secondary); font-size: var(--chart-label); }
  .band-label { fill: var(--text-secondary); font-size: var(--chart-font); font-weight: 600; paint-order: stroke; stroke: var(--surface-1); stroke-width: 3px; }
  .marker { stroke-width: 1.5; }
  .marker-label { font-size: var(--chart-font); font-weight: 600; paint-order: stroke; stroke: var(--surface-1); stroke-width: 3px; }
  .crosshair { stroke: var(--text-muted); stroke-width: 1; stroke-dasharray: 2 3; }
  .swatch {
    display: inline-block;
    width: 10px;
    height: 3px;
    border-radius: 2px;
    margin-right: 6px;
    vertical-align: middle;
  }
  .legend {
    position: absolute;
    right: 14px;
    top: 0;
    display: flex;
    gap: 0.8rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
    background: color-mix(in srgb, var(--surface-1) 85%, transparent);
    padding: 0 0.3rem;
    border-radius: 6px;
  }
</style>
