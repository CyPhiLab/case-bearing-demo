<script lang="ts">
  // One row of jittered dots per class: how a single feature is distributed across conditions.
  import * as d3 from 'd3';
  import { app } from '../state.svelte';
  import { CLASS_NAMES, CLASS_SHAPES, classColors, classVar, drawMarker } from '../classes';

  interface Props {
    values: number[];
    classes: number[];
    current?: number | null;
    label?: string;
    height?: number;
    onselect?: (i: number) => void;
  }
  let { values, classes, current = null, label = '', height = 260, onselect }: Props = $props();

  const margin = { top: 8, right: 16, bottom: 36, left: 92 };
  let width = $state(500);
  let canvas: HTMLCanvasElement;
  let hovered = $state<number | null>(null);
  const innerW = $derived(Math.max(10, width - margin.left - margin.right));
  const innerH = $derived(height - margin.top - margin.bottom);
  const k = CLASS_NAMES.length;
  const rowH = $derived(innerH / k);

  const x = $derived.by(() => {
    const all = current !== null ? [...values, current] : values;
    const [a, b] = d3.extent(all) as [number, number];
    const pad = (b - a) * 0.04 || 1;
    return d3.scaleLinear().domain([a - pad, b + pad]).range([0, innerW]).nice();
  });
  // deterministic jitter
  const jitter = $derived(values.map((_, i) => ((Math.sin(i * 91.7) * 43758.5453) % 1 + 1) % 1 - 0.5));
  const py = (i: number) => (classes[i] + 0.5 + jitter[i] * 0.62) * rowH;

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
    values.forEach((v, i) => {
      const c = classes[i];
      drawMarker(ctx, CLASS_SHAPES[c], x(v), py(i), 2.6);
      if (CLASS_SHAPES[c] === 'ring') {
        ctx.strokeStyle = colors[c];
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = colors[c];
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });
    void surface;
  });

  // class medians, drawn as a tick for each row
  const medians = $derived(
    Array.from({ length: k }, (_, c) => d3.median(values.filter((_, i) => classes[i] === c)) ?? 0),
  );

  function pick(e: MouseEvent): number | null {
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    let best: number | null = null, bd = 64;
    values.forEach((v, i) => {
      const d = (x(v) - mx) ** 2 + (py(i) - my) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  const fmt = d3.format('.4~g');
</script>

<div class="host" bind:clientWidth={width} style:height="{height}px">
  <svg {width} {height} role="img" aria-label="Distribution of {label} for each bearing condition">
    <g transform="translate({margin.left},{margin.top})">
      {#each { length: k } as _, c}
        <rect x={0} y={c * rowH + 1} width={innerW} height={rowH - 2} class="row" />
        <text x={-10} y={(c + 0.5) * rowH} dy="0.32em" text-anchor="end" class="rlabel" fill={classVar(c)}>{CLASS_NAMES[c]}</text>
      {/each}
      {#each x.ticks(Math.max(2, Math.floor(innerW / 90))) as t}
        <line x1={x(t)} x2={x(t)} y1={0} y2={innerH} class="gridline" />
        <text x={x(t)} y={innerH + 15} text-anchor="middle" class="tick">{x.tickFormat()(t)}</text>
      {/each}
      <text x={innerW / 2} y={innerH + 31} text-anchor="middle" class="axis-label">{label}</text>
    </g>
  </svg>
  <canvas
    bind:this={canvas}
    style:left="{margin.left}px"
    style:top="{margin.top}px"
    style:width="{innerW}px"
    style:height="{innerH}px"
    style:cursor={hovered !== null && onselect ? 'pointer' : 'default'}
    onmousemove={(e) => (hovered = pick(e))}
    onmouseleave={() => (hovered = null)}
    onclick={(e) => {
      const i = pick(e);
      if (i !== null) onselect?.(i);
    }}
  ></canvas>
  <svg class="over" {width} {height} aria-hidden="true">
    <g transform="translate({margin.left},{margin.top})">
      {#each medians as m, c}
        <line x1={x(m)} x2={x(m)} y1={c * rowH + 4} y2={(c + 1) * rowH - 4} class="median" />
      {/each}
      {#if current !== null}
        <line x1={x(current)} x2={x(current)} y1={-4} y2={innerH} class="current" />
        <text x={x(current)} y={innerH - 4} dx="4" class="current-label">this window</text>
      {/if}
    </g>
  </svg>
  {#if hovered !== null}
    <div class="tooltip" style:left="{Math.min(width - 160, margin.left + x(values[hovered]) + 10)}px" style:top="{margin.top + py(hovered) - 34}px">
      <b>{CLASS_NAMES[classes[hovered]]}</b> · {fmt(values[hovered])}
    </div>
  {/if}
</div>

<style>
  .host { position: relative; width: 100%; min-width: 0; }
  svg, canvas { position: absolute; left: 0; top: 0; }
  svg.over { pointer-events: none; }
  .row { fill: var(--surface-2); opacity: 0.6; }
  .rlabel { font-size: var(--chart-label); font-weight: 600; }
  .gridline { stroke: var(--grid); }
  .tick { fill: var(--text-muted); font-size: var(--chart-font); font-variant-numeric: tabular-nums; }
  .axis-label { fill: var(--text-secondary); font-size: var(--chart-label); }
  .median { stroke: var(--text-primary); stroke-width: 2; opacity: 0.55; }
  .current { stroke: var(--focus); stroke-width: 2; }
  .current-label { fill: var(--focus); font-size: var(--chart-font); font-weight: 600; paint-order: stroke; stroke: var(--surface-1); stroke-width: 3px; }
</style>
