<script lang="ts">
  // Train button, live loss curves, test accuracy and confusion matrix for one TrainingRun.
  import * as d3 from 'd3';
  import LineChart from '../charts/LineChart.svelte';
  import Confusion from '../charts/Confusion.svelte';
  import type { TrainingRun } from '../ml/run.svelte';

  interface Props {
    run: TrainingRun;
    totalEpochs: number;
    ontrain: () => void;
    label?: string;
    compact?: boolean;
    reference?: number | null; // accuracy to compare against
    referenceLabel?: string;
  }
  let { run, totalEpochs, ontrain, label = 'Train', compact = false, reference = null, referenceLabel = '' }: Props = $props();

  const ep = $derived(run.epochs);
  const last = $derived(ep.at(-1));
  const pct = d3.format('.1%');
  // where early stopping would have stopped (only worth showing once validation loss has turned around)
  const bestEpoch = $derived.by(() => {
    if (ep.length < 10) return null;
    let b = 0;
    ep.forEach((e, i) => e.valLoss < ep[b].valLoss && (b = i));
    return ep.at(-1)!.valLoss > ep[b].valLoss * 1.25 ? ep[b].epoch : null;
  });
</script>

<div class="panel">
  <div class="row">
    {#if run.status === 'training'}
      <button onclick={() => run.stop()}>■ Stop</button>
    {:else}
      <button class="primary" onclick={ontrain}>{run.status === 'done' ? '↻ Retrain' : `▶ ${label}`}</button>
    {/if}
    <div class="progress" aria-label="training progress">
      <div class="bar" style:width="{((last?.epoch ?? 0) / totalEpochs) * 100}%"></div>
    </div>
    <span class="small muted num">epoch {last?.epoch ?? 0}/{totalEpochs}</span>
  </div>

  <div class="stats">
    <div class="stat">
      <span class="value" class:pending={!run.result}>{run.result ? pct(run.result.testAcc) : last ? pct(last.valAcc) : '–'}</span>
      <span class="label">{run.result ? 'test accuracy' : 'validation accuracy (so far)'}</span>
    </div>
    {#if run.result && last}
      <div class="stat">
        <span class="value train">{pct(last.acc)}</span>
        <span class="label">training accuracy</span>
      </div>
    {/if}
    {#if reference !== null}
      <div class="stat">
        <span class="value ref">{pct(reference)}</span>
        <span class="label">{referenceLabel}</span>
      </div>
    {/if}
    {#if run.result}
      <div class="stat">
        <span class="value small-v">{run.result.params.toLocaleString()}</span>
        <span class="label">trainable parameters</span>
      </div>
    {/if}
  </div>

  <LineChart
    series={[
      { y: ep.map((e) => e.loss), xStart: 1, color: 'var(--accent)', width: 2, label: 'training loss' },
      { y: ep.map((e) => e.valLoss), xStart: 1, color: 'var(--cls-2)', width: 2, label: 'validation loss', dash: [5, 3] },
    ]}
    xDomain={[1, Math.max(2, totalEpochs)]}
    height={compact ? 150 : 180}
    xLabel="epoch"
    yLabel="log loss"
    legend
    markers={bestEpoch ? [{ x: bestEpoch, dash: true, label: 'lowest val. loss', color: 'var(--text-muted)', row: 1 }] : []}
    ariaLabel="Loss curves"
  />
  {#if !compact || run.result}
    <div class="conf"><Confusion matrix={run.result?.confusion ?? null} title="Test set: actual vs predicted" /></div>
  {/if}
  {#if run.error}<p class="small" style="color: var(--critical)">Training failed: {run.error}</p>{/if}
</div>

<style>
  .panel { display: grid; gap: 0.6rem; min-width: 0; }
  .row { display: flex; align-items: center; gap: 0.6rem; }
  .progress { flex: 1; height: 6px; border-radius: 3px; background: var(--surface-3); overflow: hidden; }
  .bar { height: 100%; background: var(--accent); transition: width 0.1s; }
  .stats { display: flex; gap: 1.5rem; flex-wrap: wrap; }
  .value.pending { color: var(--text-muted); }
  .value.ref, .value.train { color: var(--text-muted); }
  .small-v { font-size: 1.1rem !important; padding-top: 0.4rem; }
  .conf { overflow-x: auto; }
</style>
