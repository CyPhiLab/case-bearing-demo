<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import Section from '../lib/ui/Section.svelte';
  import Predict from '../lib/ui/Predict.svelte';
  import Quiz from '../lib/ui/Quiz.svelte';
  import RecordingPicker from '../lib/ui/RecordingPicker.svelte';
  import LineChart from '../lib/charts/LineChart.svelte';
  import Heatmap from '../lib/charts/Heatmap.svelte';
  import Confusion from '../lib/charts/Confusion.svelte';
  import { app, results } from '../lib/state.svelte';
  import { windowStarts, type Dataset } from '../lib/data';
  import { loadCNN } from '../lib/ml/cnnLoader';
  import { powerSpectrum } from '../lib/dsp/fft';
  import { mulberry32 } from '../lib/ml/mlp';
  import type { BearingCNN, CNNOutput } from '../lib/ml/cnn';
  import { CLASS_NAMES, classVar } from '../lib/classes';

  let { ds }: { ds: Dataset } = $props();

  let cnn = $state<BearingCNN | null>(null);
  let loadError = $state('');
  let testIdx = $state(5);
  let noise = $state(0);
  let filterView = $state<'time' | 'freq'>('freq');
  let sweep = $state<{ noise: number; acc: number }[]>([]);
  let sweeping = $state(false);

  onMount(async () => {
    try {
      cnn = await loadCNN();
    } catch (e) {
      loadError = String(e);
    }
  });

  const rec = $derived(ds.recordings[app.rec]);
  const testStarts = $derived(windowStarts(rec.signal.length, ds.frame, ds.hop, ds.splits).filter((w) => w.split === 'test'));
  const start = $derived(testStarts[Math.min(testIdx, testStarts.length - 1)].start);

  function noisy(sig: Float64Array, s0: number, sigma: number, seed: number): Float64Array {
    const out = sig.slice(s0, s0 + ds.frame);
    if (sigma > 0) {
      const r = mulberry32(seed);
      for (let i = 0; i < out.length; i++) {
        // Box-Muller Gaussian noise
        const g = Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
        out[i] += sigma * g;
      }
    }
    return out;
  }

  const input = $derived(noisy(rec.signal, start, noise, start + app.rec * 7919));
  const out = $derived<CNNOutput | null>(cnn ? cnn.run(input) : null);
  const pred = $derived(out ? out.probs.indexOf(Math.max(...out.probs)) : -1);

  // learned first-layer filters and their frequency responses
  const filters = $derived(cnn?.kernels ?? []);
  const responses = $derived(
    filters.map((k) => {
      // |FFT| of the zero-padded kernel: the filter's frequency response (no window, the kernel IS the signal)
      const padded = new Float64Array(256);
      padded.set(k);
      const P = powerSpectrum(padded);
      return { freq: Float64Array.from(P, (_, i) => (i * ds.fs) / 256), amp: P.map(Math.sqrt) };
    }),
  );

  const inBand = $derived(
    responses.filter(({ freq, amp }) => {
      let k = 0;
      for (let i = 1; i < amp.length; i++) if (amp[i] > amp[k]) k = i;
      return freq[k] >= 2000 && freq[k] <= 5000;
    }).length,
  );

  async function runSweep() {
    if (!cnn) return;
    sweeping = true;
    sweep = [];
    const levels = [0, 0.1, 0.2, 0.4, 0.8, 1.6];
    for (const sigma of levels) {
      const wins: Float64Array[] = [];
      const ys: number[] = [];
      ds.recordings.forEach((r, ri) => {
        for (const w of windowStarts(r.signal.length, ds.frame, ds.hop, ds.splits))
          if (w.split === 'test') {
            wins.push(noisy(r.signal, w.start, sigma, w.start + ri * 7919));
            ys.push(r.clsIndex);
          }
      });
      const probs = cnn.predict(wins);
      const acc = probs.filter((p, i) => p.indexOf(Math.max(...p)) === ys[i]).length / ys.length;
      sweep = [...sweep, { noise: sigma, acc }];
      await new Promise((r) => setTimeout(r, 0));
    }
    sweeping = false;
    results.cnnNoise = { acc: sweep.at(-1)!.acc, detail: `with ${sweep.at(-1)!.noise} g of added noise` };
  }

  $effect(() => {
    if (cnn) results.cnn = { acc: cnn.spec.testAccuracy, detail: 'raw 2048-sample windows' };
  });

  const ARCH = $derived.by(() => {
    if (!cnn) return [];
    const s = cnn.spec;
    let len = s.frame, ch = 1;
    const blocks: { name: string; detail: string; shape: string; params: number }[] = [
      { name: 'Input', detail: 'raw window, z-scored', shape: `${len} × 1`, params: 0 },
    ];
    s.conv.forEach((c, i) => {
      const p = c.kernel * ch * c.filters + c.filters + 4 * c.filters;
      len = Math.floor((len - c.kernel + 1) / 2);
      ch = c.filters;
      blocks.push({ name: `Conv ${i + 1}`, detail: `${c.filters} filters × ${c.kernel} taps, ReLU, pool ÷2`, shape: `${len} × ${ch}`, params: p });
    });
    blocks.push({ name: 'Global avg pool', detail: 'average over time', shape: `${ch}`, params: 0 });
    blocks.push({ name: 'Dense', detail: `${s.dense} neurons, ReLU`, shape: `${s.dense}`, params: ch * s.dense + s.dense + 4 * s.dense });
    blocks.push({ name: 'Softmax', detail: '4 classes', shape: '4', params: s.dense * 4 + 4 });
    return blocks;
  });
  const pct = d3.format('.0%');
</script>

<Section id="cnn" num={8} kicker="Deep learning" title="A CNN learns its own features" lecture="Neural networks: types of networks">
  <p class="self-only">
    Everything so far relied on <b>features we designed</b>. A 1D <b>convolutional neural network</b> skips that step. It reads the raw
    2048 samples and learns its own filters. Each first-layer filter is a short pattern of 32 weights slid along the signal. Deeper layers
    combine those patterns into more abstract ones. This network was trained offline (in PyTorch, same windows and split) and now runs live
    in your browser.
  </p>

  {#if loadError}
    <p class="card" style="color: var(--critical)">Couldn't load the CNN: {loadError}</p>
  {:else if !cnn}
    <p class="card muted">Loading TensorFlow.js and the pretrained CNN…</p>
  {:else}
    <div class="arch card" aria-label="CNN architecture">
      {#each ARCH as b, i}
        <div class="block" class:conv={b.name.startsWith('Conv')}>
          <div class="bn">{b.name}</div>
          <div class="bd">{b.detail}</div>
          <div class="bs num">{b.shape}</div>
          {#if b.params}<div class="bp num">{b.params.toLocaleString()} params</div>{/if}
        </div>
        {#if i < ARCH.length - 1}<div class="arrow" aria-hidden="true">→</div>{/if}
      {/each}
    </div>

    <div class="card" style="margin-top: 1rem">
      <RecordingPicker {ds} bind:value={app.rec} />
      <div class="controls" style="margin-top: 0.6rem">
        <label class="control">
          <span>Test window <b>{testIdx + 1} of {testStarts.length}</b></span>
          <input type="range" min="0" max={testStarts.length - 1} step="1" bind:value={testIdx} />
        </label>
        <label class="control">
          <span>Added noise <b>{noise.toFixed(2)} g RMS</b></span>
          <input type="range" min="0" max="2" step="0.05" bind:value={noise} />
        </label>
      </div>

      <div class="io">
        <div>
          <h4>Input: 2048 raw samples <span class="muted small">(from the held-out test part of {rec.label})</span></h4>
          <LineChart
            series={[{ y: input, dx: 1000 / ds.fs, color: classVar(rec.clsIndex), width: 1 }]}
            height={150}
            xLabel="time (ms)"
            yLabel="g"
            hover={false}
            ariaLabel="CNN input window"
          />
        </div>
        <div class="probs">
          <h4>Output</h4>
          {#each CLASS_NAMES as c, k}
            <div class="prow" class:win={k === pred}>
              <span class="pl" style:color={classVar(k)}>{c}</span>
              <span class="pbar"><span style:width="{(out?.probs[k] ?? 0) * 100}%" style:background={classVar(k)}></span></span>
              <span class="pv num">{pct(out?.probs[k] ?? 0)}</span>
            </div>
          {/each}
          <p class="verdict" class:wrong={pred !== rec.clsIndex}>
            {pred === rec.clsIndex ? '✓ Correct' : `✗ Wrong: it's really ${rec.cls}`}
          </p>
        </div>
      </div>

      {#if out}
        <div class="maps">
          {#each out.activations as a, i}
            <div class="map">
              <div class="small"><b>Conv {i + 1} feature maps</b> <span class="muted">{a[0].length} channels × {a.length} time steps. Bright means the filter fired (each row scaled to its own peak).</span></div>
              <Heatmap data={a} height={Math.min(140, 30 + a[0].length * 1.6)} label="Conv layer {i + 1} activations" />
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="card" style="margin-top: 1rem">
      <div class="head">
        <h3>What did the first layer learn?</h3>
        <div class="seg" role="group" aria-label="Filter view">
          <button aria-pressed={filterView === 'freq'} onclick={() => (filterView = 'freq')}>Frequency response</button>
          <button aria-pressed={filterView === 'time'} onclick={() => (filterView = 'time')}>Weights (time)</button>
        </div>
      </div>
      <div class="filters">
        {#each filters as k, f}
          <div class="filter">
            {#if filterView === 'time'}
              <LineChart series={[{ y: k, color: 'var(--accent)', width: 1.5 }]} height={70} margin={{ top: 4, right: 4, bottom: 4, left: 4 }} hover={false} xFormat={() => ''} yFormat={() => ''} />
            {:else}
              <LineChart series={[{ x: responses[f].freq, y: responses[f].amp, color: 'var(--focus)', width: 1.5, fill: true }]} xDomain={[0, 6000]} height={70} margin={{ top: 4, right: 4, bottom: 4, left: 4 }} hover={false} xFormat={() => ''} yFormat={() => ''} bands={[{ x0: 2000, x1: 5000, fill: 'color-mix(in srgb, var(--cls-2) 12%, transparent)' }]} />
            {/if}
            <span class="fl">#{f + 1}</span>
          </div>
        {/each}
      </div>
      <p class="small secondary" style="margin: 0.5rem 0 0">
        {#if filterView === 'freq'}
          Each panel runs from 0 to 6 kHz. The shaded strip is the 2–5 kHz resonance band we used for envelope analysis in section 2. Each
          filter is a learned <b>frequency-selective filter</b>, bumpier than a textbook band-pass, and <b>{inBand} of {filters.length}</b>
          have their strongest response inside that band (the band covers half the axis, so chance alone would give about 8). Nobody told the
          network where the resonance was. It leaned toward that band from the data.
        {:else}
          Each filter is just 32 numbers. Convolution slides it along the signal and outputs a large value wherever the signal locally looks
          like the filter.
        {/if}
      </p>
    </div>

    <div class="grid-2" style="margin-top: 1rem">
      <div class="card">
        <h3>How it trained</h3>
        <LineChart
          series={[
            { y: cnn.spec.history.map((h) => h.loss), xStart: 1, color: 'var(--accent)', width: 2, label: 'training loss' },
            { y: cnn.spec.history.map((h) => h.valLoss), xStart: 1, color: 'var(--cls-2)', width: 2, label: 'validation loss', dash: [5, 3] },
          ]}
          logY
          height={190}
          xLabel="epoch"
          yLabel="log loss (log scale)"
          legend
        />
        <div style="margin-top: 0.4rem"><Confusion matrix={cnn.spec.confusion} title="Test set ({pct(cnn.spec.testAccuracy)} accuracy)" /></div>
      </div>
      <div class="card">
        <h3>Stress test: add noise</h3>
        <p class="small secondary">
          Real factories are noisy. Corrupt all {ds.recordings.length * 22} test windows with Gaussian noise and see how quickly the CNN
          degrades.
        </p>
        <button class="primary" onclick={runSweep} disabled={sweeping}>{sweeping ? 'Testing…' : '▶ Run noise sweep'}</button>
        {#if sweep.length}
          <table class="sweep">
            <thead><tr><th>noise (g RMS)</th><th>accuracy</th><th></th></tr></thead>
            <tbody>
              {#each sweep as s}
                <tr>
                  <td class="num">{s.noise}</td>
                  <td class="num"><b>{pct(s.acc)}</b></td>
                  <td class="bar"><span style:width="{s.acc * 100}%"></span></td>
                </tr>
              {/each}
            </tbody>
          </table>
          <p class="small muted">For scale: the healthy bearing's own RMS is about {ds.recordings[0].rms.toFixed(2)} g.</p>
        {/if}
      </div>
    </div>
  {/if}

  <Predict question="The CNN gets ~100%, like logistic regression on our 18 features. So why bother hand-engineering features at all?">
    <p>
      Here, with clean lab data, both work. The trade-offs: the CNN needed far more training effort and data augmentation, it has
      {cnn ? ARCH.reduce((s, b) => s + b.params, 0).toLocaleString() : '~27,000'} parameters versus 76 for logistic regression, and it's
      much harder to explain. Engineered features carry decades of domain knowledge and generalize in ways you can reason about. CNNs shine
      when you have lots of data and the useful patterns are hard to describe by hand.
    </p>
  </Predict>

  <Quiz
    question="Why does a CNN use the SAME small filter at every position in the signal?"
    options={[
      'To save memory only',
      'Because a bearing impact looks the same whenever it happens, so a pattern detector should work at any time shift',
      'Because the signal is periodic',
      'It doesn\'t. Each position has its own weights',
    ]}
    answer={1}
    explain="Weight sharing builds in translation invariance. An impact at 10 ms or at 150 ms is the same event. It also cuts the parameter count enormously compared with a dense layer over all 2048 samples."
  />
</Section>

<style>
  .io > * { min-width: 0; }
  .arch { display: flex; align-items: stretch; gap: 0.3rem; overflow-x: auto; padding: 0.8rem; }
  .block { flex: 1 0 110px; background: var(--surface-2); border-radius: 8px; padding: 0.5rem 0.6rem; display: grid; gap: 0.1rem; align-content: start; }
  .block.conv { background: color-mix(in srgb, var(--focus) 10%, var(--surface-2)); }
  .bn { font-weight: 700; font-size: 0.85rem; }
  .bd { font-size: 0.72rem; color: var(--text-secondary); }
  .bs { font-size: 0.8rem; font-family: var(--mono); color: var(--accent-ink); margin-top: 0.2rem; }
  .bp { font-size: 0.7rem; color: var(--text-muted); }
  .arrow { align-self: center; color: var(--text-muted); }
  h4 { margin: 0.6rem 0 0.2rem; font-size: 0.9rem; }
  .io { display: grid; grid-template-columns: 1fr minmax(220px, 300px); gap: 1rem; align-items: start; }
  .prow { display: grid; grid-template-columns: 6rem 1fr 3rem; gap: 0.4rem; align-items: center; font-size: 0.85rem; padding: 0.15rem 0; }
  .prow.win { font-weight: 700; }
  .pl { font-weight: 600; }
  .pbar { height: 10px; background: var(--surface-2); border-radius: 5px; overflow: hidden; }
  .pbar span { display: block; height: 100%; border-radius: 5px; transition: width 0.2s; }
  .pv { text-align: right; }
  .verdict { margin: 0.4rem 0 0; font-weight: 700; color: var(--good); }
  .verdict.wrong { color: var(--critical); }
  .maps { display: grid; gap: 0.6rem; margin-top: 0.8rem; }
  .head { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
  .head h3 { margin: 0; }
  .seg { display: flex; }
  .seg button { border-radius: 0; font-size: 0.8rem; }
  .seg button:first-child { border-radius: 8px 0 0 8px; }
  .seg button:last-child { border-radius: 0 8px 8px 0; margin-left: -1px; }
  .filters { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.4rem; }
  .filter { position: relative; background: var(--surface-2); border-radius: 6px; }
  .fl { position: absolute; top: 2px; right: 6px; font-size: 0.65rem; color: var(--text-muted); }
  .sweep { width: 100%; border-collapse: collapse; margin-top: 0.6rem; font-size: 0.85rem; }
  .sweep th { text-align: left; font-weight: 500; color: var(--text-muted); font-size: 0.75rem; }
  .sweep td { padding: 0.2rem 0.3rem; border-bottom: 1px solid var(--grid); }
  .sweep td.bar { width: 45%; }
  .sweep td.bar span { display: block; height: 8px; border-radius: 4px; background: var(--accent); }
  @media (max-width: 800px) { .io { grid-template-columns: 1fr; } }
</style>
