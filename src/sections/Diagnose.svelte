<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import * as d3 from 'd3';
  import Section from '../lib/ui/Section.svelte';
  import LineChart from '../lib/charts/LineChart.svelte';
  import Confusion from '../lib/charts/Confusion.svelte';
  import { featureTable, splitRegions, type Dataset } from '../lib/data';
  import { allFeatures } from '../lib/dsp/features';
  import { amplitudeSpectrum, envelopeSpectrum } from '../lib/dsp/fft';
  import { fitScaler, transform, type Scaler } from '../lib/ml/linalg';
  import { prepare } from '../lib/ml/prep';
  import { TrainingRun } from '../lib/ml/run.svelte';
  import { DEFAULT_CONFIG } from '../lib/ml/trainer';
  import { MLP, mulberry32 } from '../lib/ml/mlp';
  import { loadCNN } from '../lib/ml/cnnLoader';
  import type { BearingCNN } from '../lib/ml/cnn';
  import { RIG_RPM, faultFrequencies } from '../lib/bearing';
  import { CLASS_NAMES, CLASS_SHORT, classVar } from '../lib/classes';
  import { app, results } from '../lib/state.svelte';
  import EarlyWarning from '../lib/viz/EarlyWarning.svelte';
  import CrossMachine from '../lib/viz/CrossMachine.svelte';
  import MachinedVsReal from '../lib/viz/MachinedVsReal.svelte';

  let { ds }: { ds: Dataset } = $props();
  const rows = $derived(featureTable(ds));
  const ff = faultFrequencies(RIG_RPM);
  const pct = d3.format('.0%');

  // ---------- the mystery-signal game ----------
  // Small models trained right here (synchronously, they're tiny) so the game works even if the
  // earlier playgrounds were skipped.
  let models = $state<{ scaler: Scaler; lr: MLP; mlp: MLP } | null>(null);
  let cnn = $state<BearingCNN | null>(null);
  const CLIP = 8192;
  let rng = mulberry32(2024);
  let mystery = $state<{ rec: number; start: number } | null>(null);
  let guess = $state<number | null>(null);
  let score = $state({ rounds: 0, you: 0, lr: 0, mlp: 0, cnn: 0 });

  onMount(() => {
    const train = rows.filter((r) => r.split !== 'test');
    const scaler = fitScaler(train.map((r) => r.x));
    const X = transform(scaler, train.map((r) => r.x));
    const y = train.map((r) => r.y);
    const counts = [0, 0, 0, 0];
    y.forEach((v) => counts[v]++);
    const cw = counts.map((c) => y.length / (4 * c));
    const lr = new MLP({ sizes: [18, 4], activation: 'relu', dropout: 0, l2: 0, lr: 0.03, seed: 1 });
    const mlp = new MLP({ sizes: [18, 32, 16, 4], activation: 'relu', dropout: 0, l2: 0, lr: 0.005, seed: 1 });
    for (let e = 0; e < 40; e++) {
      lr.epoch(X, y, 64, cw);
      mlp.epoch(X, y, 64, cw);
    }
    models = { scaler, lr, mlp };
    loadCNN().then((c) => (cnn = c));
    next();
  });

  function next() {
    const rec = Math.floor(rng() * ds.recordings.length);
    const n = ds.recordings[rec].signal.length;
    const test = splitRegions(n, ds.splits).find((r) => r.split === 'test')!;
    const start = test.lo + Math.floor(rng() * (test.hi - test.lo - CLIP));
    mystery = { rec, start };
    guess = null;
  }

  const clip = $derived(mystery ? ds.recordings[mystery.rec].signal.subarray(mystery.start, mystery.start + CLIP) : null);
  const spec = $derived(clip ? amplitudeSpectrum(clip, ds.fs) : null);
  const env = $derived.by(() => {
    if (!clip) return null;
    const e = envelopeSpectrum(clip, ds.fs, [2000, 5000]);
    const n = e.freq.findIndex((f) => f > 520);
    return { freq: e.freq.subarray(1, n), amp: e.amp.subarray(1, n) };
  });

  const verdicts = $derived.by(() => {
    if (!clip || !models) return null;
    const w = clip.subarray(0, ds.frame);
    const x = transform(models.scaler, [allFeatures(w)])[0];
    const arg = (p: ArrayLike<number>) => Array.from(p).indexOf(Math.max(...Array.from(p)));
    return {
      lr: arg(models.lr.predict(x)),
      mlp: arg(models.mlp.predict(x)),
      cnn: cnn ? arg(cnn.run(w).probs) : null,
    };
  });

  function submit(k: number) {
    if (guess !== null || !mystery || !verdicts) return;
    guess = k;
    const truth = ds.recordings[mystery.rec].clsIndex;
    score = {
      rounds: score.rounds + 1,
      you: score.you + (k === truth ? 1 : 0),
      lr: score.lr + (verdicts.lr === truth ? 1 : 0),
      mlp: score.mlp + (verdicts.mlp === truth ? 1 : 0),
      cnn: score.cnn + (verdicts.cnn === truth ? 1 : 0),
    };
  }

  const truth = $derived(mystery ? ds.recordings[mystery.rec] : null);

  // ---------- out-of-distribution test ----------
  const ood = new TrainingRun();
  onDestroy(() => ood.dispose());
  let heldSize = $state(14);
  const oodData = $derived(prepare(rows, 4, { holdoutRecs: (ri) => ds.recordings[ri].size === heldSize }));
  function runOOD() {
    ood.start({ ...DEFAULT_CONFIG, hidden: [32, 16], lr: 0.005, epochs: 60, sendWeights: false }, oodData);
  }
  $effect(() => {
    if (ood.result) results.ood = { acc: ood.result.testAcc, detail: `MLP tested on unseen ${heldSize} mil defects` };
  });

  const summary = $derived(
    [
      { key: 'lr2d', model: 'Logistic regression', input: 'PC1 + PC2' },
      { key: 'mlp2d', model: 'MLP', input: 'PC1 + PC2' },
      { key: 'lr18', model: 'Logistic regression', input: '18 features' },
      { key: 'mlp18', model: 'MLP', input: '18 features' },
      { key: 'cnn', model: 'CNN', input: 'raw 2048 samples' },
      { key: 'cnnNoise', model: 'CNN + heavy noise', input: 'raw 2048 samples' },
      { key: 'ood', model: 'MLP, unseen defect size', input: '18 features' },
      { key: 'puMachined', model: 'MLP, machined → real damage', input: '18 features' },
      { key: 'puMixed', model: 'MLP, machined + some real → real', input: '18 features' },
    ].map((r) => ({ ...r, res: results[r.key] })),
  );
</script>

<Section id="diagnose" num={9} kicker="Diagnosis" title="Diagnosis and generalization">
  <p class="self-only">
    The clip below is drawn from the held-out test data. Classify it using the waveform and the envelope spectrum, checking for the
    fault frequencies. The three models trained on the same data classify it as well.
  </p>

  {#if mystery && clip && spec && env}
    <div class="card">
      <div class="game">
        <div class="plots">
          <LineChart
            series={[{ y: clip, dx: 1 / ds.fs, color: 'var(--text-secondary)', width: 1 }]}
            xDomain={[0, 0.1]}
            height={150}
            xLabel="time (s), first 100 ms"
            yLabel="g"
            hover={false}
            ariaLabel="Mystery waveform"
          />
          <div class="grid-2 tight">
            <LineChart series={[{ x: spec.freq, y: spec.amp, color: 'var(--text-secondary)', width: 1 }]} xDomain={[0, 6000]} height={150} xLabel="frequency (Hz)" yLabel="spectrum" ariaLabel="Mystery spectrum" />
            <LineChart
              series={[{ x: env.freq, y: env.amp, color: 'var(--text-secondary)', width: 1.3 }]}
              xDomain={[0, 520]}
              height={150}
              xLabel="frequency (Hz)"
              yLabel="envelope"
              markers={[
                { x: ff.bpfo, label: 'BPFO', color: classVar(3) },
                { x: 2 * ff.bsf, label: '2×BSF', color: classVar(1), row: 1 },
                { x: ff.bpfi, label: 'BPFI', color: classVar(2), row: 2 },
              ]}
              ariaLabel="Mystery envelope spectrum"
            />
          </div>
        </div>
        <div class="answer">
          <h3>Your diagnosis</h3>
          <div class="choices">
            {#each CLASS_NAMES as c, k}
              <button
                onclick={() => submit(k)}
                disabled={guess !== null}
                class:picked={guess === k}
                class:right={guess !== null && truth?.clsIndex === k}
                style:--c={classVar(k)}
              >{c}</button>
            {/each}
          </div>
          {#if guess !== null && truth && verdicts}
            <div class="reveal" role="status">
              <p><b>Answer: {truth.label}</b> {guess === truth.clsIndex ? '✓ Correct.' : '✗ Incorrect.'}</p>
              <table>
                <tbody>
                  {#each [['Logistic regression', verdicts.lr], ['MLP', verdicts.mlp], ['CNN', verdicts.cnn]] as [name, v]}
                    <tr>
                      <td>{name}</td>
                      <td>{v === null ? '…' : CLASS_SHORT[v as number]}</td>
                      <td>{v === null ? '' : v === truth.clsIndex ? '✓' : '✗'}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
            <button class="primary" onclick={next}>Next mystery →</button>
          {/if}
          <div class="score num">
            <span>You <b>{score.you}/{score.rounds}</b></span>
            <span>LR <b>{score.lr}/{score.rounds}</b></span>
            <span>MLP <b>{score.mlp}/{score.rounds}</b></span>
            <span>CNN <b>{score.cnn}/{score.rounds}</b></span>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <div class="card" style="margin-top: 1rem">
    <div class="head">
      <h3>Generalization to an unseen defect size</h3>
      <div class="controls">
        <label class="control">Hold out
          <select bind:value={heldSize}>
            <option value={7}>7 mil (smallest)</option>
            <option value={14}>14 mil (middle)</option>
            <option value={21}>21 mil (largest)</option>
          </select>
        </label>
        <button class="primary" onclick={runOOD} disabled={ood.status === 'training'}>{ood.status === 'training' ? 'Training…' : '▶ Train & test'}</button>
      </div>
    </div>
    <div class="ood">
      <div>
        <p class="secondary">
          So far, every test window came from a recording that the model had seen during training (a later part of it). In service, a
    fault's size or shape may not be represented in the training set. Here an MLP is trained on the other two defect sizes and tested on <b>{heldSize} mil</b> faults (plus held-out healthy windows).
        </p>
        {#if ood.result}
          <div class="stat">
            <span class="value" style:color={ood.result.testAcc < 0.8 ? 'var(--critical)' : undefined}>{pct(ood.result.testAcc)}</span>
            <span class="label">accuracy on unseen {heldSize} mil defects ({oodData.yTest.length} windows)</span>
          </div>
          <p class="small secondary">
            Compare this with ~100% when the test windows came from familiar recordings. This is the out-of-distribution problem from the
    first ML lecture. The remedy is training data that cover the conditions the model will encounter, not a more complex network.
          </p>
        {/if}
      </div>
      <Confusion matrix={ood.result?.confusion ?? null} title="Unseen-size test set" />
    </div>
  </div>

  <div class="card" style="margin-top: 1rem">
    <h3>Anomaly detection on run-to-failure data</h3>
    <p class="small secondary">
      On the NASA/IMS rig it was not known which bearing would fail, so there are no fault labels for training a classifier. Instead,
    the normal behavior can be learned and an alarm raised when a bearing departs from it. This is <b>anomaly detection</b>. Choose a health indicator from section 4 and an alarm threshold, and see how much warning it gives before bearing 1 fails.
    </p>
    <EarlyWarning />
  </div>

  <div class="card" style="margin-top: 1rem">
    <h3>Generalization to a different machine</h3>
    <p class="small secondary">
      Do the classifiers trained on CWRU data detect the failure of the IMS bearing? Each tick below is one 10-minute snapshot of bearing 1,
      resampled to 12 kHz and turned into the same 18 features, colored by the predicted class.
    </p>
    <CrossMachine {models} />
  </div>

  <div class="card" style="margin-top: 1rem">
    <h3>Generalization from machined to real damage</h3>
    <p class="small secondary">
      The Paderborn bearings make it possible to test what the CWRU data cannot: whether a model trained on artificial faults recognizes
    <i>real</i> ones. Here healthy, inner-race and outer-race windows are split by <b>whole bearings</b>, so every test bearing is new to
      the model.
    </p>
    <MachinedVsReal />
  </div>

  <div class="grid-2" style="margin-top: 1rem">
    <div class="card">
      <h3>Summary of results</h3>
      <table class="summary">
        <thead><tr><th>Model</th><th>Input</th><th class="r">Test accuracy</th></tr></thead>
        <tbody>
          {#each summary as s}
            <tr class:pending={!s.res}>
              <td>{s.model}</td>
              <td class="muted">{s.input}</td>
              <td class="r num">{s.res ? pct(s.res.acc) : 'not run yet'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <div class="card">
      <h3>Takeaways</h3>
      <ul class="take">
        <li><b>Measure carefully and plot the data first.</b> Sampling rate, sensor placement and windowing decide what any model can possibly learn.</li>
        <li><b>Physics-informed features are effective.</b> 18 features and a linear model already separate these classes.</li>
        <li><b>Neural networks form curved boundaries</b> when linear ones are not sufficient, at the cost of parameters and interpretability.</li>
        <li><b>CNNs learn features</b> directly from raw signals, and their first layer rediscovered frequency-selective filtering.</li>
        <li><b>Real failures grow slowly.</b> Trending a physics-informed indicator (envelope at BPFO) gave days of warning on the IMS bearing, with no labels needed.</li>
        <li><b>Lab accuracy ≠ field accuracy.</b> New fault sizes, loads and machines are out of distribution. A model is only reliable within the range of its training data.</li>
      </ul>
    </div>
  </div>

  <div class="self-only refs">
    <h3>Go further</h3>
    <ul>
      <li>Case Western Reserve University Bearing Data Center: <a href="https://engineering.case.edu/bearingdatacenter">engineering.case.edu/bearingdatacenter</a></li>
      <li>NASA/IMS run-to-failure data: J. Lee, H. Qiu, G. Yu, J. Lin, and Rexnord Technical Services (2007), "Bearing Data Set," IMS, University of Cincinnati, NASA Prognostics Data Repository. See also H. Qiu et al. (2006), <i>Journal of Sound and Vibration</i> 289, 1066–1090.</li>
      <li>Paderborn KAt Bearing DataCenter (CC BY-NC 4.0): C. Lessmeier, J. K. Kimotho, D. Zimmer, W. Sextro (2016), "Condition Monitoring of Bearing Damage in Electromechanical Drive Systems by Using Motor Current Signals of Electric Motors: A Benchmark Data Set for Data-Driven Classification," PHM Society European Conference. <a href="https://mb.uni-paderborn.de/kat/datacenter">mb.uni-paderborn.de/kat/datacenter</a></li>
      <li>W. A. Smith &amp; R. B. Randall (2015), "Rolling element bearing diagnostics using the Case Western Reserve University data: A benchmark study," <i>Mechanical Systems and Signal Processing</i> 64–65.</li>
      <li>The Python behind this page (data prep, features, CNN training): the <code>pipeline/</code> folder of this site's GitHub repository.</li>
      <li>3Blue1Brown, <a href="https://www.3blue1brown.com/topics/neural-networks">Neural networks</a> · Google, <a href="https://developers.google.com/machine-learning/crash-course">ML Crash Course</a></li>
    </ul>
  </div>
</Section>

<style>
  .game > *, .ood > * { min-width: 0; }
  .game { display: grid; grid-template-columns: 1fr minmax(240px, 300px); gap: 1.2rem; align-items: start; }
  .plots { display: grid; gap: 0.6rem; min-width: 0; }
  .tight { gap: 0.6rem; }
  .answer h3 { margin-bottom: 0.5rem; }
  .choices { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; }
  .choices button { padding: 0.6em; font-weight: 600; border-color: var(--c); }
  .choices button.picked { background: color-mix(in srgb, var(--c) 20%, var(--surface-1)); }
  .choices button.right { outline: 3px solid var(--good); outline-offset: 1px; opacity: 1; }
  .reveal { margin: 0.8rem 0; padding: 0.6rem 0.8rem; background: var(--surface-2); border-radius: 8px; }
  .reveal p { margin: 0 0 0.4rem; }
  .reveal table { width: 100%; font-size: 0.85rem; border-collapse: collapse; }
  .reveal td { padding: 0.15rem 0.2rem; }
  .score { display: flex; flex-wrap: wrap; gap: 0.3rem 0.9rem; font-size: 0.85rem; margin-top: 0.8rem; color: var(--text-secondary); }
  .head { display: flex; justify-content: space-between; align-items: end; gap: 0.5rem 1rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
  .head h3 { margin: 0; }
  .ood { display: grid; grid-template-columns: 1fr auto; gap: 1.5rem; align-items: start; }
  .summary { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
  .summary th { text-align: left; font-weight: 500; font-size: 0.75rem; color: var(--text-muted); border-bottom: 1px solid var(--grid); padding: 0.3rem; }
  .summary td { padding: 0.35rem 0.3rem; border-bottom: 1px solid var(--grid); }
  .summary .r { text-align: right; }
  .summary tr.pending td.r { color: var(--text-muted); font-size: 0.8rem; }
  .summary td.r { font-weight: 700; }
  .take { padding-left: 1.1rem; margin: 0; }
  .take li { margin-bottom: 0.45rem; }
  .refs { margin-top: 1.5rem; font-size: 0.9rem; }
  .refs ul { padding-left: 1.1rem; }
  @media (max-width: 860px) { .game, .ood { grid-template-columns: 1fr; } }
</style>
