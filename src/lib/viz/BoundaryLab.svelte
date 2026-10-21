<script lang="ts">
  // Train a classifier on (PC1, PC2) and paint its decision regions behind the data.
  import { onDestroy } from 'svelte';
  import ScatterPlot from '../charts/ScatterPlot.svelte';
  import ClassLegend from '../charts/ClassLegend.svelte';
  import TrainPanel from './TrainPanel.svelte';
  import { TrainingRun } from '../ml/run.svelte';
  import { prepare2D, type PCASpace } from '../ml/prep';
  import type { TrainConfig } from '../ml/trainTypes';
  import { app, results } from '../state.svelte';
  import { CLASS_NAMES } from '../classes';

  interface Props {
    space: PCASpace;
    config: TrainConfig;
    resultKey: string;
    reference?: number | null;
    referenceLabel?: string;
    autostart?: boolean;
  }
  let { space, config, resultKey, reference = null, referenceLabel = '' }: Props = $props();

  const run = new TrainingRun();
  onDestroy(() => run.dispose());
  const data = $derived(prepare2D(space, 4));

  function train() {
    run.start($state.snapshot(config), data, data.grid);
  }

  $effect(() => {
    if (run.result) results[resultKey] = { acc: run.result.testAcc, detail: 'PC1 + PC2 only' };
  });

  // misclassified test points get flagged once training is done
  const wrong = $derived.by(() => {
    const res = run.result;
    if (!res) return new Set<number>();
    const s = new Set<number>();
    res.testPred.forEach((p, i) => {
      if (p !== data.yTest[i]) s.add(space.rows.indexOf(data.testRows[i]));
    });
    return s;
  });

  const points = $derived(
    space.coords.map((c, i) => ({
      x: c[0],
      y: c[1],
      cls: space.rows[i].y,
      hollow: space.rows[i].split === 'test',
      flag: wrong.has(i),
    })),
  );
</script>

<div class="lab">
  <div>
    <ScatterPlot
      {points}
      boundary={run.grid ? { probs: run.grid, ...data.grid } : null}
      xLabel="PC1"
      yLabel="PC2"
      height={app.mode === 'lecture' ? 470 : 400}
      radius={3}
      tooltip={(i) => `<b>${CLASS_NAMES[space.rows[i].y]}</b> · ${space.rows[i].split} set${wrong.has(i) ? '<br><span style="color:var(--critical)">misclassified</span>' : ''}`}
      ariaLabel="Decision regions in the PCA plane"
    />
    <ClassLegend
      extra={[
        { label: 'hollow = test window', svg: '<svg width="14" height="14" viewBox="-7 -7 14 14"><circle r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
        { label: 'misclassified', svg: '<svg width="16" height="16" viewBox="-8 -8 16 16"><circle r="6.5" fill="none" stroke="var(--critical)" stroke-width="1.5"/></svg>' },
      ]}
    />
  </div>
  <TrainPanel {run} totalEpochs={config.epochs} ontrain={train} compact {reference} {referenceLabel} />
</div>

<style>
  .lab > * { min-width: 0; }
  .lab { display: grid; grid-template-columns: 1fr minmax(260px, 360px); gap: 1.2rem; align-items: start; }
  @media (max-width: 900px) { .lab { grid-template-columns: 1fr; } }
</style>
