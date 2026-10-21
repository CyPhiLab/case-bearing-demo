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
  const hidden = $derived([width1, width2, width3].slice(0, layers));

  const full = new TrainingRun();
  onDestroy(() => full.dispose());
  const data = $derived(prepare(rows, 4, { trainFraction }));
  function trainFull() {
    full.start(
      { ...DEFAULT_CONFIG, model: 'mlp', hidden: $state.snapshot(hidden), activation, lr, epochs, dropout, l2, sendWeights: true },
      data,
    );
  }
  $effect(() => {
    if (full.result) results.mlp18 = { acc: full.result.testAcc, detail: `${hidden.join('-')} ${activation}, ${Math.round(trainFraction * 100)}% of training data` };
  });

  // network diagram follows the controls until a run reports real weights for the same shape
  const sizes = $derived([FEATURES.length, ...hidden, 4]);
  const liveWeights = $derived(
    full.weights && full.weights.length === sizes.length - 1 && full.weights.every((k, l) => k.length === sizes[l] && k[0].length === sizes[l + 1]) ? full.weights : null,
  );

  function overfitPreset() {
    layers = 2; width1 = 128; width2 = 64; dropout = 0; l2 = 0; trainFraction = 0.04; epochs = 200; lr = 0.003;
  }
  function resetPreset() {
    layers = 2; width1 = 128; width2 = 64; dropout = 0; l2 = 0; trainFraction = 1; epochs = 60; lr = 0.003; activation = 'relu';
  }
</script>

<Section id="mlp" num={7} kicker="Multilayer perceptron" title="Neural networks: bend the boundaries" lecture="Neural networks: hidden layers, ReLU, backprop">
  <div class="intro self-only">
    <p>
      A <b>multilayer perceptron</b> stacks layers of "neurons." Each one computes a weighted sum of its inputs and passes it through a
      nonlinearity, the <b>activation function</b>:
    </p>
    <div class="eq"><Tex display math={'\\mathbf{h}_1 = \\mathrm{ReLU}(W_1\\mathbf{x} + \\mathbf{b}_1),\\quad \\mathbf{h}_2 = \\mathrm{ReLU}(W_2\\mathbf{h}_1 + \\mathbf{b}_2),\\quad \\hat{\\mathbf{y}} = \\mathrm{softmax}(W_3\\mathbf{h}_2 + \\mathbf{b}_3)'} /></div>
    <p>
      Without the ReLUs, the whole stack would collapse into one big linear map, which is logistic regression again. With them, the
      network can bend its decision boundaries. Training is the same gradient descent, with the gradients computed by
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
      It should get close to 100%. Watch the colored regions bend and wrap around the outer-race islands. Same inputs, same data. The
      only difference is the hidden layers with nonlinear activations. Try the 1 × 8 network too: even 8 ReLU neurons make a big
      difference.
    </p>
  </Predict>

  <div class="card" style="margin-top: 1rem">
    <div class="head">
      <h3>B. Neural-network playground (all 18 features)</h3>
      <div class="presets">
        <button onclick={overfitPreset} title="Huge network, 4% of the data, many epochs">Make it overfit</button>
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
        <input type="range" min="0" max="0.01" step="0.0005" bind:value={l2} />
      </label>
      <label class="control">
        <span>Training data used <b>{Math.round(trainFraction * 100)}% · {data.xTrain.length} windows</b></span>
        <input type="range" min="0.02" max="1" step="0.02" bind:value={trainFraction} />
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
      <li><b>Overfitting.</b> Click <i>Make it overfit</i> and train. With only a few dozen training windows and about 10,000 weights, the training loss dives to zero while the validation loss levels off or climbs. That widening gap is the overfitting signature from the Data lecture.</li>
      <li><b>Regularization.</b> Keep the tiny training set, then add 30–50% dropout or some L2 and retrain. Does the validation curve behave better?</li>
      <li><b>Learning rate.</b> Set it to the maximum. The loss curve gets jumpy, because the steps overshoot. Set it very low and training crawls.</li>
      <li><b>Activations.</b> Swap ReLU for sigmoid with 3 layers. Training is noticeably slower, which shows the vanishing-gradient issue in miniature.</li>
    </ol>
  </div>

  <Quiz
    question="With all 18 features, both logistic regression and the MLP hit ~100% here. When does the extra power of an MLP actually pay off?"
    options={[
      'Always: neural networks are strictly better',
      'When the classes are not (close to) linearly separable in the features you give it, like the PCA plane',
      'Only when you have fewer than 100 examples',
      'Only when using the sigmoid activation',
    ]}
    answer={1}
    explain="If straight boundaries already work, the MLP can't do better. It just costs more parameters and is harder to interpret. Its advantage shows up when the boundary needs to curve, as in part A."
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
