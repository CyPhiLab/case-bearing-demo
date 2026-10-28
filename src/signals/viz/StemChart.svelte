<script lang="ts">
  // Lollipop/stem plot (Fourier coefficients, DFT bins, kernels) drawn on LineChart's axes.
  import LineChart from '../../lib/charts/LineChart.svelte';

  interface Stem { x: number; y: number; color?: string; label?: string }
  interface Props {
    stems: Stem[];
    xDomain: [number, number];
    yDomain?: [number, number];
    height?: number;
    xLabel?: string;
    yLabel?: string;
    xFormat?: (v: number) => string;
    ariaLabel?: string;
    baseline?: number;
  }
  let { stems, xDomain, yDomain, height = 180, xLabel = '', yLabel = '', xFormat, ariaLabel = 'stem plot', baseline = 0 }: Props = $props();
  const yd = $derived.by((): [number, number] => {
    if (yDomain) return yDomain;
    let lo = baseline, hi = baseline;
    for (const s of stems) { lo = Math.min(lo, s.y); hi = Math.max(hi, s.y); }
    const pad = (hi - lo) * 0.12 || 1;
    return [lo < baseline ? lo - pad : lo, hi + pad];
  });
</script>

<LineChart series={[]} {xDomain} yDomain={yd} {height} {xLabel} {yLabel} {xFormat} hover={false} {ariaLabel}>
  {#snippet overlay({ x, y })}
    <line x1={x(xDomain[0])} x2={x(xDomain[1])} y1={y(baseline)} y2={y(baseline)} class="base" />
    {#each stems as s}
      {#if s.x >= xDomain[0] && s.x <= xDomain[1]}
        <line x1={x(s.x)} x2={x(s.x)} y1={y(baseline)} y2={y(Math.max(yd[0], Math.min(yd[1], s.y)))} stroke={s.color ?? 'var(--accent)'} stroke-width="2.5" />
        <circle cx={x(s.x)} cy={y(Math.max(yd[0], Math.min(yd[1], s.y)))} r="4" fill={s.color ?? 'var(--accent)'} />
        {#if s.label}<text x={x(s.x)} y={y(Math.max(yd[0], Math.min(yd[1], s.y))) - 8} text-anchor="middle" class="lbl">{s.label}</text>{/if}
      {/if}
    {/each}
  {/snippet}
</LineChart>

<style>
  .base { stroke: var(--axis); }
  .lbl { font-size: var(--chart-font); fill: var(--text-secondary); font-variant-numeric: tabular-nums; paint-order: stroke; stroke: var(--surface-1); stroke-width: 3px; }
</style>
