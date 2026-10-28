<script lang="ts">
  // Domain shift: run the CWRU-trained classifiers on every snapshot of the IMS bearing's life.
  import { onMount } from 'svelte';
  import { loadIMS, type IMSData } from '../ims';
  import { transform, type Scaler } from '../ml/linalg';
  import type { MLP } from '../ml/mlp';
  import { CLASS_NAMES, CLASS_SHAPES, classVar, markerPath } from '../classes';

  let { models }: { models: { scaler: Scaler; lr: MLP; mlp: MLP } | null } = $props();
  let ims = $state<IMSData | null>(null);
  let which = $state<'mlp' | 'lr'>('mlp');
  onMount(() => {
    loadIMS().then((d) => (ims = d));
  });

  const preds = $derived.by(() => {
    if (!ims || !models) return [];
    const m = models[which];
    return transform(models.scaler, ims.features12k).map((x) => {
      const p = Array.from(m.predict(x));
      return p.indexOf(Math.max(...p));
    });
  });
  const DAY_DAMAGE = 3.7; // when the BPFO line appears in the envelope spectrum
  const share = (from: number, to: number, cls: number) => {
    if (!ims) return 0;
    const idx = ims.hours.map((h, i) => [h / 24, i] as const).filter(([d]) => d >= from && d < to);
    return idx.filter(([, i]) => preds[i] === cls).length / Math.max(1, idx.length);
  };

  let width = $state(700);
  const L = 92, R = 12, rowH = 26;
  const end = $derived(ims ? ims.hours.at(-1)! / 24 : 7);
  const xs = (d: number) => L + (d / end) * (width - L - R);
</script>

{#if ims && models}
  <div class="controls">
    <div class="seg" role="group" aria-label="Model">
      <button aria-pressed={which === 'mlp'} onclick={() => (which = 'mlp')}>MLP</button>
      <button aria-pressed={which === 'lr'} onclick={() => (which = 'lr')}>Logistic regression</button>
    </div>
  </div>
  <div class="host" bind:clientWidth={width}>
    <svg {width} height={rowH * 5 + 30} role="img" aria-label="CWRU model predictions over the IMS bearing's life">
      <rect x={xs(0)} y={2} width={xs(DAY_DAMAGE) - xs(0)} height={rowH - 6} rx="3" class="truth healthy" />
      <rect x={xs(DAY_DAMAGE)} y={2} width={xs(end) - xs(DAY_DAMAGE)} height={rowH - 6} rx="3" class="truth damaged" />
      <text x={L - 8} y={rowH / 2 - 1} text-anchor="end" class="lbl b">Reality</text>
      <text x={xs(DAY_DAMAGE / 2)} y={rowH / 2 - 1} text-anchor="middle" class="tl">healthy</text>
      <text x={xs((DAY_DAMAGE + end) / 2)} y={rowH / 2 - 1} text-anchor="middle" class="tl">outer-race damage growing</text>
      {#each CLASS_NAMES as c, k}
        {@const y = (k + 1) * rowH + 10}
        <text x={L - 8} y={y + rowH / 2} dy="0.32em" text-anchor="end" class="lbl" fill={classVar(k)}>{c}</text>
        <line x1={L} x2={width - R} y1={y + rowH / 2} y2={y + rowH / 2} class="grid" />
      {/each}
      {#each preds as p, i}
        <rect x={xs(ims.hours[i] / 24)} y={(p + 1) * rowH + 14} width="1.4" height={rowH - 8} fill={classVar(p)} />
      {/each}
      {#each [0, 1, 2, 3, 4, 5, 6] as d}
        <text x={xs(d)} y={rowH * 5 + 26} text-anchor="middle" class="tick">day {d}</text>
      {/each}
    </svg>
  </div>
  <p class="small secondary">
    {which === 'mlp' ? 'The MLP' : 'Logistic regression'}, trained on CWRU, says <b>"Outer Race" for {Math.round(share(0, DAY_DAMAGE, 3) * 100)}%</b>
    of the snapshots taken while this bearing was still <i>healthy</i>, and {Math.round(share(DAY_DAMAGE, 99, 3) * 100)}% after damage
    appeared. Its final prediction is correct, but for the wrong reason. This rig has a different bearing, shaft speed, sensor, housing resonance
    and sampling rate, so every window lies far outside the training data, and the model assigns the nearest class.
    That is <b>domain shift</b>, the most common way in which a laboratory-trained model fails in service. A model has to be trained on, or at least
    calibrated to, the machine it will monitor.
  </p>
{:else}
  <p class="muted small">Loading…</p>
{/if}

<style>
  .host { width: 100%; min-width: 0; }
  svg { display: block; width: 100%; }
  .truth.healthy { fill: color-mix(in srgb, var(--cls-0) 30%, transparent); }
  .truth.damaged { fill: color-mix(in srgb, var(--critical) 25%, transparent); }
  .tl { font-size: var(--chart-font); fill: var(--text-primary); font-weight: 600; dominant-baseline: middle; }
  .lbl { font-size: var(--chart-label); font-weight: 600; }
  .lbl.b { fill: var(--text-primary); dominant-baseline: middle; }
  .grid { stroke: var(--grid); }
  .tick { font-size: var(--chart-font); fill: var(--text-muted); }
  .seg { display: flex; }
  .seg button { border-radius: 0; font-size: 0.8rem; }
  .seg button:first-child { border-radius: 8px 0 0 8px; }
  .seg button:last-child { border-radius: 0 8px 8px 0; margin-left: -1px; }
</style>
