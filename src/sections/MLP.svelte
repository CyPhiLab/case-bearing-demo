<script lang="ts">
  import { onDestroy } from 'svelte';
  import Section from '../lib/ui/Section.svelte';
  import Tex from '../lib/ui/Tex.svelte';
  import Predict from '../lib/ui/Predict.svelte';
  import Quiz from '../lib/ui/Quiz.svelte';
  import BoundaryLab from '../lib/viz/BoundaryLab.svelte';
  import TrainPanel from '../lib/viz/TrainPanel.svelte';
  import NetDiagram from '../lib/charts/NetDiagram.svelte';
  import { featureTable, type Dataset } from '../lib/data';
  import { FEATURES } from '../lib/dsp/features';
  import { pcaSpace, prepare } from '../lib/ml/prep';
  import { TrainingRun } from '../lib/ml/run.svelte';
  import { DEFAULT_CONFIG } from '../lib/ml/trainer';
  import type { Activation, TrainConfig } from '../lib/ml/trainTypes';
  import { app, results } from '../lib/state.svelte';
  import { CLASS_SHORT, classVar } from '../lib/classes';

  let { ds }: { ds: Dataset } = $props();

  const rows = $derived(featureTable(ds));
  const space = $derived(pcaSpace(rows));

  const ARCHS: { label: string; hidden: number[] }[] = [
    { label: '1 layer × 8', hidden: [8] },
    { label: '2 layers: 32, 16', hidden: [32, 16] },
    { label: '2 layers: 128, 64 (notebook)', hidden: [128, 64] },
  ];
  let arch2d = $state(1);
  let config2d = $state<TrainConfig>({ ...DEFAULT_CONFIG, hidden: [32, 16], lr: 0.01, epochs: 120, sendWeights: false });
  $effect(() => {
    config2d.hidden = ARCHS[arch2d].hidden;
  });

  // full playground
  let layers = $state(2);
  let width1 = $state(128);
  let width2 = $state(64);
  let width3 = $state(32);
  let activation = $state<Activation>('relu');
  let lr = $state(0.003);
  let epochs = $state(60);
  let dropout = $state(0);
  let l2 = $state(0);
  let trainFraction = $state(1);
  let labelNoise = $state(0);
  const hidden = $derived([width1, width2, width3].slice(0, layers));

  const full = new TrainingRun();
  onDestroy(() => full.dispose());
  const data = $derived(prepare(rows, 4, { trainFraction, labelNoise }));
  function trainFull() {
    full.start(
      { ...DEFAULT_CONFIG, model: 'mlp', hidden: $state.snapshot(hidden), activation, lr, epochs, dropout, l2, sendWeights: true },
      data,
    );
  }
  $effect(() => {
    if (full.result) results.mlp18 = { acc: full.result.testAcc, detail: `${hidden.join('-')} ${activation}, ${Math.round(trainFraction * 100)}% of training data${labelNoise ? `, ${Math.round(labelNoise * 100)}% mislabeled` : ''}` };
  });

  // network diagram follows the controls until a run reports real weights for the same shape
  const sizes = $derived([FEATURES.length, ...hidden, 4]);
  const liveWeights = $derived(
    full.weights && full.weights.length === sizes.length - 1 && full.weights.every((k, l) => k.length === sizes[l] && k[0].length === sizes[l + 1]) ? full.weights : null,
  );

  // Calibrated with the browser MLP (seed 42): overfit ≈ 99% train / 75% test; +L2 ≈ 74% / 95%;
  // more data ≈ 88% test; more data + L2 ≈ 100%.
  function overfitPreset() {
    layers = 2; width1 = 128; width2 = 64; dropout = 0; l2 = 0; trainFraction = 0.1; labelNoise = 0.3; epochs = 300; lr = 0.003; activation = 'relu';
  }
  function resetPreset() {
    layers = 2; width1 = 128; width2 = 64; dropout = 0; l2 = 0; trainFraction = 1; labelNoise = 0; epochs = 60; lr = 0.003; activation = 'relu';
  }
</script>

<Section id="mlp" num={7} kicker="Neural networks" title="Multilayer perceptron" lecture="Neural networks: hidden layers, ReLU, backprop">
  <div class="intro self-only">
    <p>
      A <b>multilayer perceptron</b> (MLP) consists of layers of "neurons." Each one computes a weighted sum of its inputs and passes it through a
      nonlinearity, the <b>activation function</b>:
    </p>
    <div class="eq"><Tex display math={'\\mathbf{h}_1 = \\mathrm{ReLU}(W_1\\mathbf{x} + \\mathbf{b}_1),\\quad \\mathbf{h}_2 = \\mathrm{ReLU}(W_2\\mathbf{h}_1 + \\mathbf{b}_2),\\quad \\hat{\\mathbf{y}} = \\mathrm{softmax}(W_3\\mathbf{h}_2 + \\mathbf{b}_3)'} /></div>
    <p>
      Without the ReLU activations, the layers would combine into a single linear map, equivalent to logistic regression. With them,
      the network can form curved decision boundaries. Training is the same gradient descent, with the gradients computed by
      <b>backpropagation</b>.
    </p>
  </div>

  <div class="card">
    <div class="head">
      <h3>A. Same PCA plane, now with a neural network</h3>
      <div class="controls">
        <label class="control">Architecture
          <select bind:value={arch2d}>{#each ARCHS as a, i}<option value={i}>{a.label}</option>{/each}</select>
        </label>
        <label class="control">Activation
          <select bind:value={config2d.activation}>
            <option value="relu">ReLU</option><option value="tanh">tanh</option><option value="sigmoid">sigmoid</option>
          </select>
        </label>
        <label class="control">
          <span>Epochs <b>{config2d.epochs}</b></span>
          <input type="range" min="20" max="300" step="20" bind:value={config2d.epochs} />
        </label>
      </div>
    </div>
    <BoundaryLab {space} config={config2d} resultKey="mlp2d" reference={results.lr2d?.acc ?? null} referenceLabel="logistic regression, same plane" />
  </div>

  <Predict question="Logistic regression scored about 74% in this plane. What will a small neural network do with the same two inputs?">
    <p>
      Close to 100%. The colored regions curve around the outer-race clusters. The inputs and data are the same; the only difference is
      the hidden layers with nonlinear activations. A 1 × 8 network is also sufficient to make a large difference.
    </p>
  </Predict>

    <dl class="defs self-only" style="margin-top: 1.2rem">
    <dt>Training / validation / test</dt><dd>The model is fitted to the training windows. The validation windows monitor overfitting during training. The test windows are used only for the final accuracy.</dd>
    <dt>Epoch</dt><dd>One pass through all training windows.</dd>
    <dt>Learning rate</dt><dd>The step size of each gradient-descent update.</dd>
    <dt>Overfitting</dt><dd>Fitting the training data, including its noise and errors, so closely that performance on new data suffers.</dd>
    <dt>L2 regularization</dt><dd>A penalty on large weights added to the loss. It favors smoother decision boundaries.</dd>
    <dt>Dropout</dt><dd>Randomly disabling a fraction of the neurons at each training step, so that the network cannot rely on any single one.</dd>
  </dl>

  <div class="card" style="margin-top: 1rem">
    <div class="head">
      <h3>B. Network settings and training (all 18 features)</h3>
      <div class="presets">
        <button onclick={overfitPreset} title="Big network, 10% of the data, 30% of its labels wrong, many epochs">Make it overfit</button>
        <button onclick={() => (l2 = 0.03)} disabled={!labelNoise} title="Penalize large weights">Fix: add L2</button>
        <button onclick={() => (trainFraction = 1)} disabled={!labelNoise} title="Use every training window">Fix: more data</button>
        <button onclick={resetPreset}>Reset</button>
      </div>
    </div>
    <div class="controls knobs">
      <label class="control">
        <span>Hidden layers <b>{layers}</b></span>
        <input type="range" min="1" max="3" step="1" bind:value={layers} />
      </label>
      <label class="control">
        <span>Layer 1 neurons <b>{width1}</b></span>
        <input type="range" min="2" max="128" step="2" bind:value={width1} />
      </label>
      {#if layers >= 2}
        <label class="control">
          <span>Layer 2 neurons <b>{width2}</b></span>
          <input type="range" min="2" max="128" step="2" bind:value={width2} />
        </label>
      {/if}
      {#if layers >= 3}
        <label class="control">
          <span>Layer 3 neurons <b>{width3}</b></span>
          <input type="range" min="2" max="128" step="2" bind:value={width3} />
        </label>
      {/if}
      <label class="control">Activation
        <select bind:value={activation}>
          <option value="relu">ReLU</option><option value="tanh">tanh</option><option value="sigmoid">sigmoid</option>
        </select>
      </label>
      <label class="control">
        <span>Learning rate <b>{lr}</b></span>
        <input type="range" min="0.0005" max="0.05" step="0.0005" bind:value={lr} />
      </label>
      <label class="control">
        <span>Epochs <b>{epochs}</b></span>
        <input type="range" min="10" max="300" step="10" bind:value={epochs} />
      </label>
      <label class="control">
        <span>Dropout <b>{Math.round(dropout * 100)}%</b></span>
        <input type="range" min="0" max="0.6" step="0.05" bind:value={dropout} />
      </label>
      <label class="control">
        <span>L2 regularization <b>{l2}</b></span>
        <input type="range" min="0" max="0.05" step="0.001" bind:value={l2} />
      </label>
      <label class="control">
        <span>Training data used <b>{Math.round(trainFraction * 100)}% · {data.xTrain.length} windows</b></span>
        <input type="range" min="0.02" max="1" step="0.02" bind:value={trainFraction} />
      </label>
      <label class="control">
        <span>Mislabeled training windows <b>{Math.round(labelNoise * 100)}%</b></span>
        <input type="range" min="0" max="0.4" step="0.05" bind:value={labelNoise} />
      </label>
    </div>

    <div class="playground">
      <div class="net">
        <NetDiagram
          {sizes}
          weights={liveWeights}
          inputLabels={FEATURES.map((f) => f.name)}
          outputLabels={CLASS_SHORT}
          outputColors={[0, 1, 2, 3].map(classVar)}
          {activation}
          height={app.mode === 'lecture' ? 460 : 420}
        />
        <p class="small muted" style="margin: 0">
          Lines show the strongest weights (red positive, blue negative). They update as the network trains.
          {#if !liveWeights}Press Train to fill them in.{/if}
        </p>
      </div>
      <TrainPanel run={full} totalEpochs={epochs} ontrain={trainFull} reference={results.lr18?.acc ?? null} referenceLabel="logistic regression, 18 features" />
    </div>
  </div>

  <div class="self-only experiments">
    <h3>Experiments to try</h3>
    <ol>
      <li><b>Overfitting.</b> Click <i>Make it overfit</i> and train. The setup is a big network (about 10,000 weights), only 80 training windows, and 30% of them carrying the <i>wrong</i> label: the "bad labels" problem from the Data lecture. The network memorizes the incorrect labels. Training accuracy climbs to ~100%, but validation loss turns around and climbs while test accuracy stalls near 75%.</li>
      <li><b>Regularization.</b> Now click <i>Fix: add L2</i> and retrain. Training accuracy <i>drops</i> to ~70%, which is about the fraction of labels that are actually right, while test accuracy jumps to ~95%. The penalty on large weights prevents the network from fitting every incorrect label. Dropout (40–50%) has a similar effect.</li>
      <li><b>More data.</b> <i>Fix: more data</i> uses all 810 windows (still 30% mislabeled). The larger set is harder to memorize, so the test accuracy improves. Combine it with L2 and it reaches ~100%. The dashed line on the loss chart marks the lowest validation loss, which is where <b>early stopping</b> would have stopped.</li>
      <li><b>Learning rate.</b> Set it to the maximum. The loss curve becomes erratic because the steps overshoot. At a very low rate, training is very slow.</li>
      <li><b>Activations.</b> Swap ReLU for sigmoid with 3 layers. Training is noticeably slower, an example of the vanishing-gradient problem.</li>
    </ol>
  </div>

  <Quiz
    question="With all 18 features, both logistic regression and the MLP hit ~100% here. When is the additional flexibility of an MLP useful?"
    options={[
      'Always: neural networks are strictly better',
      'When the classes are not (close to) linearly separable in the features you give it, like the PCA plane',
      'Only when you have fewer than 100 examples',
      'Only when using the sigmoid activation',
    ]}
    answer={1}
    explain="If straight boundaries already work, the MLP cannot do better; it only adds parameters and is harder to interpret. Its advantage appears when the boundary must be curved, as in part A."
  />
</Section>

<style>
  .playground > * { min-width: 0; }
  .eq { overflow-x: auto; }
  .head { display: flex; justify-content: space-between; align-items: end; gap: 0.5rem 1rem; flex-wrap: wrap; margin-bottom: 0.6rem; }
  .head h3 { margin: 0; }
  .presets { display: flex; gap: 0.4rem; }
  .knobs { margin-bottom: 1rem; }
  .knobs .control { min-width: 150px; flex: 1 1 150px; max-width: 230px; }
  .playground { display: grid; grid-template-columns: 1fr minmax(260px, 380px); gap: 1.2rem; align-items: start; }
  .experiments { margin-top: 1rem; }
  .experiments ol { padding-left: 1.2rem; max-width: 80ch; }
  .experiments li { margin-bottom: 0.4rem; }
  @media (max-width: 900px) { .playground { grid-template-columns: 1fr; } }
</style>
