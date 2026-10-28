<script lang="ts">
  import { onDestroy } from 'svelte';
  import Section from '../lib/ui/Section.svelte';
  import Tex from '../lib/ui/Tex.svelte';
  import Predict from '../lib/ui/Predict.svelte';
  import Quiz from '../lib/ui/Quiz.svelte';
  import BoundaryLab from '../lib/viz/BoundaryLab.svelte';
  import TrainPanel from '../lib/viz/TrainPanel.svelte';
  import CoefHeatmap from '../lib/charts/CoefHeatmap.svelte';
  import { featureTable, type Dataset } from '../lib/data';
  import { FEATURES } from '../lib/dsp/features';
  import { pcaSpace, prepare } from '../lib/ml/prep';
  import { TrainingRun } from '../lib/ml/run.svelte';
  import { DEFAULT_CONFIG } from '../lib/ml/trainer';
  import type { TrainConfig } from '../lib/ml/trainTypes';
  import { results } from '../lib/state.svelte';

  let { ds }: { ds: Dataset } = $props();

  const rows = $derived(featureTable(ds));
  const space = $derived(pcaSpace(rows));

  let config2d = $state<TrainConfig>({ ...DEFAULT_CONFIG, model: 'logistic', hidden: [], lr: 0.05, epochs: 60, sendWeights: false });
  let config18 = $state<TrainConfig>({ ...DEFAULT_CONFIG, model: 'logistic', hidden: [], lr: 0.03, epochs: 60, sendWeights: true });

  const full = new TrainingRun();
  onDestroy(() => full.dispose());
  const data18 = $derived(prepare(rows, 4));
  function trainFull() {
    full.start($state.snapshot(config18), data18);
  }
  $effect(() => {
    if (full.result) results.lr18 = { acc: full.result.testAcc, detail: 'all 18 features' };
  });
</script>

<Section id="logistic" num={6} kicker="Linear baseline" title="Logistic regression" lecture="Regression: logistic regression & log loss">
  <div class="intro self-only">
    <p>
      Logistic regression computes a weighted sum of the features and maps it to a probability. The lecture used the sigmoid function
      for two classes. For four classes its generalization, the <b>softmax</b> function, is used, with one weight vector per class:
    </p>
    <div class="eq"><Tex display math={'P(\\text{class } k \\mid \\mathbf{x}) = \\frac{e^{\\mathbf{w}_k\\cdot\\mathbf{x} + b_k}}{\\sum_j e^{\\mathbf{w}_j\\cdot\\mathbf{x} + b_j}}'} /></div>
    <p>
      Training minimizes the <b>log loss</b> with gradient descent (Adam), as in the lecture. Because the score
      <Tex math={'\\mathbf{w}_k\\cdot\\mathbf{x}+b_k'} /> is linear, the boundary between any two classes is a <b>straight line</b>
      (a hyperplane in more dimensions).
    </p>
  </div>

  <div class="card">
    <div class="head">
      <h3>A. Using only the two PCA coordinates</h3>
      <div class="controls">
        <label class="control">
          <span>Learning rate <b>{config2d.lr}</b></span>
          <input type="range" min="0.005" max="0.2" step="0.005" bind:value={config2d.lr} />
        </label>
        <label class="control">
          <span>Epochs <b>{config2d.epochs}</b></span>
          <input type="range" min="10" max="200" step="10" bind:value={config2d.epochs} />
        </label>
      </div>
    </div>
    <BoundaryLab {space} config={config2d} resultKey="lr2d" />
  </div>

  <Predict question="Before training: can straight lines separate the four classes in this plane?">
    <p>
      Not quite. Look at the outer-race windows (squares). They lie in two separate clusters at opposite corners, with other classes in between. A linear model can give each class only one
      convex region, so one of the clusters is misclassified. Expect roughly 70–80%
      accuracy.
    </p>
  </Predict>

  <div class="card" style="margin-top: 1rem">
    <div class="head">
      <h3>B. Using all 18 features</h3>
      <span class="small muted">{data18.xTrain.length} training · {data18.xVal.length} validation · {data18.xTest.length} test windows</span>
    </div>
    <div class="full">
      <TrainPanel run={full} totalEpochs={config18.epochs} ontrain={trainFull} reference={results.lr2d?.acc ?? null} referenceLabel="same model, PCA plane only" />
      <div>
        <h4>What did it learn?</h4>
        {#if full.weights}
          <CoefHeatmap weights={full.weights[0]} names={FEATURES.map((f) => f.name)} />
        {:else}
          <p class="muted small">Train the model to display its weights. There's one weight per (feature, class) pair: 18 × 4 = 72, plus 4 biases.</p>
        {/if}
      </div>
    </div>
  </div>

  <div class="self-only" style="margin-top: 1rem">
    <p>
      With all 18 features, the classes are (almost) <b>linearly separable</b>: in 18 dimensions, flat boundaries can separate them.
      Projecting to 2D discards this. Logistic regression is fast, resistant to overfitting, and its weights are interpretable. For
      example, the weights show which features move a window toward "Outer Race."
    </p>
  </div>

  <Quiz
    question="The 'Inner' column has a large positive weight on some feature. What does that mean?"
    options={[
      'That feature is measured on the inner race',
      'Larger (z-scored) values of that feature make the model more confident the window is an inner-race fault',
      'That feature is unimportant for inner-race faults',
      'The model will always predict inner race when that feature is present',
    ]}
    answer={1}
    explain="Each weight scales how much one standardized feature adds to that class's score. Positive means 'more of this feature, more likely this class', holding the other features fixed."
  />
</Section>

<style>
  .full > * { min-width: 0; }
  .eq { overflow-x: auto; }
  .head { display: flex; justify-content: space-between; align-items: end; gap: 0.5rem 1rem; flex-wrap: wrap; margin-bottom: 0.6rem; }
  .head h3 { margin: 0; }
  .full { display: grid; grid-template-columns: minmax(260px, 400px) 1fr; gap: 1.5rem; align-items: start; }
  h4 { margin: 0 0 0.4rem; font-size: 0.95rem; }
  @media (max-width: 900px) { .full { grid-template-columns: 1fr; } }
</style>
