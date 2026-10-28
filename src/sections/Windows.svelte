<script lang="ts">
  import Section from '../lib/ui/Section.svelte';
  import Predict from '../lib/ui/Predict.svelte';
  import RecordingPicker from '../lib/ui/RecordingPicker.svelte';
  import LineChart from '../lib/charts/LineChart.svelte';
  import { app } from '../lib/state.svelte';
  import { splitRegions, windowStarts, type Dataset } from '../lib/data';
  import { RIG_RPM, faultFrequencies } from '../lib/bearing';
  import { classVar } from '../lib/classes';

  let { ds }: { ds: Dataset } = $props();

  const SIZES = [256, 512, 1024, 2048, 4096, 8192];
  let sizeIdx = $state(3);
  let overlap = $state(0.5);
  const frame = $derived(SIZES[sizeIdx]);
  const hop = $derived(Math.max(1, Math.round(frame * (1 - overlap))));
  const isDefault = $derived(frame === ds.frame && hop === ds.hop);

  const rec = $derived(ds.recordings[app.rec]);
  const fs = $derived(ds.fs);
  const n = $derived(rec.signal.length);
  const regions = $derived(splitRegions(n, ds.splits));
  const starts = $derived(windowStarts(n, frame, hop, ds.splits));
  const lanes = $derived(Math.min(6, Math.ceil(1 / (1 - overlap + 1e-9))));
  const ff = faultFrequencies(RIG_RPM);

  // keep the selected window on the current grid
  const selIdx = $derived.by(() => {
    let best = 0;
    starts.forEach((s, i) => {
      if (Math.abs(s.start - app.windowStart) < Math.abs(starts[best].start - app.windowStart)) best = i;
    });
    return best;
  });
  const sel = $derived(starts[selIdx]);
  const selWindow = $derived(rec.signal.subarray(sel.start, sel.start + frame));

  const overview = $derived.by(() => {
    const m = 1000;
    const step = Math.floor(n / m);
    const y = new Float64Array(m);
    for (let i = 0; i < m; i++) {
      let v = 0;
      for (let j = i * step; j < (i + 1) * step; j++) v = Math.max(v, Math.abs(rec.signal[j]));
      y[i] = v;
    }
    return { y, dx: step / fs };
  });
  const ymax = $derived(Math.max(...overview.y));

  const SPLIT_LABEL: Record<string, string> = { train: 'training', val: 'validation', test: 'held-out test' };
  const SPLIT_FILL: Record<string, string> = { train: 'var(--split-train)', val: 'var(--split-val)', test: 'var(--split-test)' };

  function pick(x: number) {
    const target = x * fs - frame / 2;
    let best = 0;
    starts.forEach((s, i) => {
      if (Math.abs(s.start - target) < Math.abs(starts[best].start - target)) best = i;
    });
    app.windowStart = starts[best].start;
  }
  function stepWin(d: number) {
    app.windowStart = starts[Math.max(0, Math.min(starts.length - 1, selIdx + d))].start;
  }
</script>

<Section id="windows" num={3} kicker="Data preparation" title="Windowing the recordings" lecture="Data: how much data?">
  <p class="self-only">
    A classifier needs <i>many</i> labelled examples, but there are only 10 recordings. Each recording is therefore divided into
    short <b>windows</b>, and every window is treated as one example with the label of its recording. Overlapping the windows increases
    the number of examples further, although overlapping examples are not fully independent.
  </p>

  <div class="card">
    <RecordingPicker {ds} bind:value={app.rec} />
    <div class="controls" style="margin-top: 0.8rem">
      <label class="control">
        <span>Window size <b>{frame} samples = {((frame / fs) * 1000).toFixed(0)} ms</b></span>
        <input type="range" min="0" max={SIZES.length - 1} step="1" bind:value={sizeIdx} />
      </label>
      <label class="control">
        <span>Overlap <b>{Math.round(overlap * 100)}%</b></span>
        <input type="range" min="0" max="0.9" step="0.05" bind:value={overlap} />
      </label>
      <div class="stat">
        <span class="value">{starts.length}</span>
        <span class="label">windows from this recording</span>
      </div>
      <div class="stat">
        <span class="value">{(starts.length * ds.recordings.length).toLocaleString()}</span>
        <span class="label">examples in the whole dataset</span>
      </div>
      {#if !isDefault}
        <button onclick={() => { sizeIdx = 3; overlap = 0.5; }}>Reset to 2048 / 50%</button>
      {/if}
    </div>

    <div style="margin-top: 0.8rem">
      <LineChart
        series={[{ y: overview.y, dx: overview.dx, color: classVar(rec.clsIndex), width: 1, fill: true }]}
        yDomain={[-ymax * 0.9, ymax * 1.05]}
        height={app.mode === 'lecture' ? 230 : 190}
        xLabel="time (s)"
        yFormat={() => ''}
        yLabel=" "
        bands={regions.map((r) => ({ x0: r.lo / fs, x1: r.hi / fs, fill: SPLIT_FILL[r.split], label: SPLIT_LABEL[r.split] }))}
        hover={false}
        onpoint={(x) => pick(x)}
        ariaLabel="Recording with analysis windows"
      >
        {#snippet overlay({ x, y, h })}
          {@const laneH = Math.min(9, (h * 0.42) / lanes)}
          {#each starts as s, i}
            <rect
              x={x(s.start / fs)}
              width={Math.max(1, x((s.start + frame) / fs) - x(s.start / fs) - 1)}
              y={h - (1 + (i % lanes)) * (laneH + 2)}
              height={laneH}
              rx="2"
              class="win"
              class:sel={i === selIdx}
            />
          {/each}
        {/snippet}
      </LineChart>
    </div>
    <p class="small muted" style="margin: 0.3rem 0 0">
      Click to pick a window. The last 20% of every recording is set aside for testing, and windows never straddle that boundary.
    </p>
  </div>

  <div class="grid-2" style="margin-top: 1rem">
    <div class="card">
      <div class="head">
        <h3>Window #{selIdx + 1} <span class="muted small">{SPLIT_LABEL[sel.split]} · starts at {(sel.start / fs).toFixed(3)} s</span></h3>
        <div>
          <button onclick={() => stepWin(-1)} aria-label="Previous window">←</button>
          <button onclick={() => stepWin(1)} aria-label="Next window">→</button>
        </div>
      </div>
      <LineChart
        series={[{ y: selWindow, xStart: 0, dx: 1000 / fs, color: classVar(rec.clsIndex), width: 1.1, label: 'g' }]}
        height={200}
        xLabel="time within window (ms)"
        yLabel="acceleration (g)"
        ariaLabel="Selected window"
      />
      <p class="small secondary" style="margin: 0.3rem 0 0">
        This window contains <b>{frame}</b> samples. The next section reduces them to 18 features.
      </p>
    </div>
    <div class="card">
      <h3>Choice of window size</h3>
      <table class="tradeoff">
        <tbody>
          <tr><td>Duration</td><td class="num">{((frame / fs) * 1000).toFixed(1)} ms</td></tr>
          <tr><td>Shaft revolutions inside</td><td class="num">{((frame / fs) * ff.shaft).toFixed(1)}</td></tr>
          <tr><td>Outer-race impacts inside (BPFO)</td><td class="num">{((frame / fs) * ff.bpfo).toFixed(1)}</td></tr>
          <tr><td>FFT frequency resolution Δf = f<sub>s</sub>/N</td><td class="num">{(fs / frame).toFixed(1)} Hz</td></tr>
          <tr><td>Examples in the dataset</td><td class="num">{(starts.length * ds.recordings.length).toLocaleString()}</td></tr>
        </tbody>
      </table>
      <p class="small secondary self-only">
        A window that is too short may contain few or no impacts, and its spectrum has coarse resolution because Δf is large. A window
        that is too long gives fewer examples to learn from. The course notebook used <b>2048 samples with 50% overlap</b>, about 5 shaft revolutions and
        roughly 18 outer-race impacts per window, as do the rest of this page and its models.
      </p>
    </div>
  </div>

  <Predict question="With 2048-sample windows and 50% overlap, about how many examples does one 10 s recording give?">
    <p>
      The hop between windows is 1024 samples, so roughly 120,000 / 1024 ≈ 117. The actual number is slightly lower (113) because windows may not cross the train/validation/test boundaries. Across all 10 recordings this gives 1,130 examples, of which 113 are healthy and 339 per
      fault type.
    </p>
  </Predict>
</Section>

<style>
  .head { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.3rem; }
  .head h3 { margin: 0; }
  .win { fill: color-mix(in srgb, var(--text-primary) 22%, transparent); }
  .win.sel { fill: var(--accent); }
  .tradeoff { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 0.6rem; }
  .tradeoff td { padding: 0.35rem 0.3rem; border-bottom: 1px solid var(--grid); }
  .tradeoff td.num { text-align: right; font-weight: 600; }
</style>
