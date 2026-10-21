<script lang="ts">
  // A layer-by-layer drawing of a dense network. Edge color = weight sign, opacity = magnitude.
  interface Props {
    sizes: number[]; // nodes per layer, input first
    weights: number[][][] | null; // kernel per dense layer, [in][out]
    inputLabels?: string[];
    outputLabels?: string[];
    outputColors?: string[];
    activation?: string;
    height?: number;
  }
  let { sizes, weights, inputLabels = [], outputLabels = [], outputColors = [], activation = 'relu', height = 360 }: Props = $props();

  const MAX = 12;
  let width = $state(600);
  const padL = 142, padR = 96, padT = 26, padB = 16;

  // which real node indices we draw for each layer
  const shown = $derived(sizes.map((n, l) => (l === 0 || l === sizes.length - 1 || n <= MAX ? [...Array(n).keys()] : [...Array(MAX).keys()])));
  const xs = $derived(sizes.map((_, l) => padL + (l * (width - padL - padR)) / Math.max(1, sizes.length - 1)));
  const ys = $derived(
    shown.map((idx) => {
      const n = idx.length;
      const avail = height - padT - padB;
      const gap = Math.min(28, avail / Math.max(1, n));
      const top = padT + (avail - gap * (n - 1)) / 2;
      return idx.map((_, i) => top + i * gap);
    }),
  );

  const edges = $derived.by(() => {
    if (!weights) return [];
    const out: { x1: number; y1: number; x2: number; y2: number; w: number; o: number }[] = [];
    weights.forEach((K, l) => {
      if (!shown[l] || !shown[l + 1]) return;
      let m = 1e-9;
      for (const i of shown[l]) for (const j of shown[l + 1]) m = Math.max(m, Math.abs(K[i]?.[j] ?? 0));
      for (const [a, i] of shown[l].entries())
        for (const [b, j] of shown[l + 1].entries()) {
          const w = K[i]?.[j] ?? 0;
          const o = Math.abs(w) / m;
          if (o < 0.08) continue;
          out.push({ x1: xs[l], y1: ys[l][a], x2: xs[l + 1], y2: ys[l + 1][b], w, o });
        }
    });
    return out;
  });

  const layerName = (l: number) =>
    l === 0 ? `input · ${sizes[0]}` : l === sizes.length - 1 ? `softmax · ${sizes[l]}` : `hidden ${l} · ${sizes[l]} ${activation}`;
</script>

<div class="host" bind:clientWidth={width}>
  <svg {width} {height} role="img" aria-label="Network diagram with {sizes.join('-')} neurons">
    {#each edges as e}
      <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={e.w < 0 ? 'var(--div-neg)' : 'var(--div-pos)'} stroke-opacity={0.08 + 0.75 * e.o * e.o} stroke-width={0.5 + 1.8 * e.o} />
    {/each}
    {#if !weights}
      {#each sizes.slice(0, -1) as _, l}
        {#each ys[l] as y1}
          {#each ys[l + 1] as y2}
            <line x1={xs[l]} y1={y1} x2={xs[l + 1]} y2={y2} class="ghost" />
          {/each}
        {/each}
      {/each}
    {/if}
    {#each sizes as n, l}
      <text x={xs[l]} y={12} text-anchor="middle" class="lname">{layerName(l)}</text>
      {#each ys[l] as y, i}
        <circle cx={xs[l]} cy={y} r={l === 0 || l === sizes.length - 1 ? 5.5 : 4.5} class="node" style:fill={l === sizes.length - 1 ? outputColors[i] : undefined} />
        {#if l === 0 && inputLabels[i]}
          <text x={xs[l] - 10} y={y} dy="0.32em" text-anchor="end" class="nlabel">{inputLabels[i]}</text>
        {/if}
        {#if l === sizes.length - 1 && outputLabels[i]}
          <text x={xs[l] + 10} y={y} dy="0.32em" class="nlabel out">{outputLabels[i]}</text>
        {/if}
      {/each}
      {#if n > shown[l].length}
        <text x={xs[l]} y={ys[l][ys[l].length - 1] + 18} text-anchor="middle" class="more">+{n - shown[l].length} more</text>
      {/if}
    {/each}
  </svg>
</div>

<style>
  .host { width: 100%; min-width: 0; overflow: hidden; }
  svg { display: block; width: 100%; }
  .node { fill: var(--surface-1); stroke: var(--text-secondary); stroke-width: 1.3; }
  .ghost { stroke: var(--grid); stroke-width: 0.6; }
  .lname { fill: var(--text-secondary); font-size: var(--chart-font); font-weight: 600; }
  .nlabel { fill: var(--text-secondary); font-size: var(--chart-font); }
  .nlabel.out { font-weight: 600; fill: var(--text-primary); }
  .more { fill: var(--text-muted); font-size: 10px; }
</style>
