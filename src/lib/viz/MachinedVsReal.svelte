<script lang="ts">
  // Paderborn stress test: train on machined faults, test on bearings with real damage.
  import { onDestroy, onMount } from 'svelte';
  import * as d3 from 'd3';
  import Confusion from '../charts/Confusion.svelte';
  import { featureTable, loadDataset, type Dataset } from '../data';
  import { prepareByRecording } from '../ml/prep';
  import { TrainingRun } from '../ml/run.svelte';
  import { DEFAULT_CONFIG } from '../ml/trainer';
  import { results } from '../state.svelte';

  let ds = $state<Dataset | null>(null);
  onMount(() => {
    loadDataset('pu/').then((d) => (ds = d));
  });

  type Plan = 'machined' | 'mixed';
  let plan = $state<Plan>('machined');
  const run = new TrainingRun();
  onDestroy(() => run.dispose());

  // Healthy K001/K002 train, K003 tests. "Mixed" adds half of the real-damage bearings to training;
  // either way the test set is real-damage bearings the model never saw.
  const MIXED_TRAIN = ['KA04', 'KA15', 'KI04', 'KI14', 'KI16'];
  const split = $derived.by(() => {
    if (!ds) return null;
    const id = (i: number) => ds!.recordings[i].id;
    const dmg = (i: number) => ds!.recordings[i].damage;
    const isTrain = (i: number) =>
      id(i) === 'K001' || id(i) === 'K002' || dmg(i) === 'machined' || (plan === 'mixed' && MIXED_TRAIN.includes(id(i)));
    const isTest = (i: number) => id(i) === 'K003' || (dmg(i) === 'real' && !(plan === 'mixed' && MIXED_TRAIN.includes(id(i))));
    const trainIds = ds.recordings.map((_, i) => i).filter(isTrain).map(id);
    const testIds = ds.recordings.map((_, i) => i).filter(isTest).map(id);
    return { data: prepareByRecording(featureTable(ds), 4, isTrain, isTest), trainIds, testIds };
  });

  function go() {
    if (split) run.start({ ...DEFAULT_CONFIG, hidden: [32, 16], lr: 0.005, epochs: 80, sendWeights: false }, split.data);
  }
  let lastPlan = $state<Plan | null>(null);
  $effect(() => {
    if (run.result && lastPlan) results[lastPlan === 'machined' ? 'puMachined' : 'puMixed'] = { acc: run.result.testAcc, detail: '' };
  });
  const pct = d3.format('.0%');
</script>

{#if ds && split}
  <div class="controls">
    <div class="control">
      Train on
      <div class="seg" role="group" aria-label="Training data">
        <button aria-pressed={plan === 'machined'} onclick={() => (plan = 'machined')}>Machined faults only</button>
        <button aria-pressed={plan === 'mixed'} onclick={() => (plan = 'mixed')}>Machined + some real bearings</button>
      </div>
    </div>
    <button class="primary" disabled={run.status === 'training'} onclick={() => { lastPlan = plan; go(); }}>
      {run.status === 'training' ? 'Training…' : '▶ Train & test'}
    </button>
  </div>
  <div class="cols">
    <div>
      <p class="small secondary">
        <b>Training bearings:</b> {split.trainIds.join(', ')}<br />
        <b>Test bearings (never seen):</b> {split.testIds.join(', ')}
      </p>
      {#if run.result && lastPlan}
        <div class="stat">
          <span class="value" style:color={run.result.testAcc < 0.8 ? 'var(--critical)' : undefined}>{pct(run.result.testAcc)}</span>
          <span class="label">accuracy on real damage ({run.result.confusion.flat().reduce((a, b) => a + b, 0)} windows), trained on {lastPlan === 'machined' ? 'machined faults only' : 'machined + some real'}</span>
        </div>
        {#if results.puMachined && results.puMixed}
          <p class="small secondary">
            Machined only: <b>{pct(results.puMachined.acc)}</b> → adding real examples: <b>{pct(results.puMixed.acc)}</b>.
          </p>
        {/if}
      {/if}
      <p class="small secondary">
        Same MLP, same 18 features, same test stand. Only the <i>origin</i> of the damage changed. Machined notches make clean, sharp
        impacts. Real pitting is rough and irregular, so a model that learned "what a notch sounds like" can miss it. That's why
        researchers warn against judging bearing diagnostics on CWRU-style data alone, and why the most valuable training data is data
        from the failures you actually expect.
      </p>
    </div>
    <Confusion matrix={run.result?.confusion ?? null} title="Real-damage test set" />
  </div>
{:else}
  <p class="muted small">Loading the Paderborn data…</p>
{/if}

<style>
  .seg { display: flex; flex-wrap: wrap; }
  .seg button { border-radius: 0; font-size: 0.85rem; margin-left: -1px; }
  .seg button:first-child { border-radius: 8px 0 0 8px; margin-left: 0; }
  .seg button:last-child { border-radius: 0 8px 8px 0; }
  .controls { align-items: end; margin-bottom: 0.6rem; }
  .cols { display: grid; grid-template-columns: 1fr auto; gap: 1.5rem; align-items: start; }
  .cols > * { min-width: 0; }
  @media (max-width: 860px) { .cols { grid-template-columns: 1fr; } }
</style>
