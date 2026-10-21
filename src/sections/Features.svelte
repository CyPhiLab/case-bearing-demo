<script lang="ts">
  import * as d3 from 'd3';
  import Section from '../lib/ui/Section.svelte';
  import Tex from '../lib/ui/Tex.svelte';
  import Quiz from '../lib/ui/Quiz.svelte';
  import RecordingPicker from '../lib/ui/RecordingPicker.svelte';
  import LineChart from '../lib/charts/LineChart.svelte';
  import StripPlot from '../lib/charts/StripPlot.svelte';
  import ScatterPlot from '../lib/charts/ScatterPlot.svelte';
  import ClassLegend from '../lib/charts/ClassLegend.svelte';
  import LifeTrend from '../lib/viz/LifeTrend.svelte';
  import { app } from '../lib/state.svelte';
  import { featureTable, type Dataset } from '../lib/data';
  import { FEATURES, allFeatures } from '../lib/dsp/features';
  import { classVar, CLASS_NAMES } from '../lib/classes';

  let { ds }: { ds: Dataset } = $props();

  const rows = $derived(featureTable(ds));
  const rec = $derived(ds.recordings[app.rec]);
  const start = $derived(Math.min(app.windowStart, rec.signal.length - ds.frame));
  const win = $derived(rec.signal.subarray(start, start + ds.frame));
  const feats = $derived(allFeatures(win));
  const f = $derived(FEATURES[app.feature]);

  let fx = $state(2); // RMS
  let fy = $state(6); // kurtosis

  const fmt = d3.format('.3~g');

  function selectRow(i: number) {
    app.rec = rows[i].rec;
    app.windowStart = rows[i].start;
  }

  // how far this window's value sits within the overall range, for the inline bars
  const ranges = $derived(FEATURES.map((_, j) => d3.extent(rows, (r) => r.x[j]) as [number, number]));
</script>

<Section id="features" num={4} kicker="Feature engineering" title="Boil 2048 numbers down to 18" lecture="Data: normalization; numerical features">
  <p class="self-only">
    Instead of handing the model 2048 raw samples, we compute a handful of <b>features</b>, numbers that summarize the window. Vibration
    analysts have used these for decades. There are 11 in the <i>time domain</i> (statistics of the waveform) and 7 in the <i>frequency
    domain</i> (where the energy sits in the spectrum). Click any feature to see how well it separates the four conditions.
  </p>

  <div class="layout">
    <div class="card list">
      <RecordingPicker {ds} bind:value={app.rec} />
      <div style="margin-top: 0.6rem">
        <LineChart
          series={[{ y: win, dx: 1000 / ds.fs, color: classVar(rec.clsIndex), width: 1 }]}
          height={110}
          margin={{ top: 4, right: 6, bottom: 22, left: 40 }}
          xFormat={(v) => `${v} ms`}
          hover={false}
          ariaLabel="Current window"
        />
      </div>
      <div class="flist" role="listbox" aria-label="Features">
        {#each FEATURES as feat, j}
          {#if j === 0 || FEATURES[j - 1].domain !== feat.domain}
            <div class="domain">{feat.domain === 'time' ? 'Time domain' : 'Frequency domain'}</div>
          {/if}
          <button role="option" aria-selected={app.feature === j} class:on={app.feature === j} onclick={() => (app.feature = j)}>
            <span class="fname">{feat.name}</span>
            <span class="bar" aria-hidden="true">
              <span style:width="{Math.max(2, ((feats[j] - ranges[j][0]) / (ranges[j][1] - ranges[j][0] || 1)) * 100)}%"></span>
            </span>
            <span class="fval num">{fmt(feats[j])}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="detail">
      <div class="card">
        <div class="fhead">
          <div>
            <h3>{f.name}</h3>
            <p class="small secondary" style="margin: 0">{f.blurb}</p>
          </div>
          <div class="formula"><Tex math={f.formula} display /></div>
        </div>
        <StripPlot
          values={rows.map((r) => r.x[app.feature])}
          classes={rows.map((r) => r.y)}
          current={feats[app.feature]}
          label={f.name}
          height={app.mode === 'lecture' ? 320 : 270}
          onselect={selectRow}
        />
        <p class="small muted" style="margin: 0.2rem 0 0">
          Each dot is one window ({rows.length.toLocaleString()} total). Dark ticks mark each class median. Click a dot to load that window.
        </p>
      </div>

      <div class="card" style="margin-top: 1rem">
        <div class="pair-head">
          <h3>Two features at once</h3>
          <div class="controls">
            <label class="control">x-axis
              <select bind:value={fx}>{#each FEATURES as ft, j}<option value={j}>{ft.name}</option>{/each}</select>
            </label>
            <label class="control">y-axis
              <select bind:value={fy}>{#each FEATURES as ft, j}<option value={j}>{ft.name}</option>{/each}</select>
            </label>
          </div>
        </div>
        <ScatterPlot
          points={rows.map((r) => ({ x: r.x[fx], y: r.x[fy], cls: r.y }))}
          xLabel={FEATURES[fx].name}
          yLabel={FEATURES[fy].name}
          height={app.mode === 'lecture' ? 400 : 340}
          radius={3}
          onselect={selectRow}
          tooltip={(i) => `<b>${CLASS_NAMES[rows[i].y]}</b> · ${ds.recordings[rows[i].rec].label}<br>${FEATURES[fx].name}: ${fmt(rows[i].x[fx])}<br>${FEATURES[fy].name}: ${fmt(rows[i].x[fy])}`}
          ariaLabel="Scatter of two features"
        />
        <ClassLegend />
      </div>
    </div>
  </div>

  <div class="self-only" style="margin-top: 1rem">
    <p>
      No single feature separates all four classes, but some pairs come close. That's exactly the job of a classifier: combine features
      to draw the boundaries between the classes. Notice too that the features live on wildly different scales. Kurtosis runs from about
      0 to 20, while the band energies are fractions. That's why we <b>z-score</b> them before training (Data lecture), so no feature
      dominates just because its numbers are bigger.
    </p>
  </div>

  <div class="card" style="margin-top: 1rem">
    <h3>Features over a bearing's life</h3>
    <p class="small secondary">
      Features aren't only classifier inputs. Plotted over time, they become <b>condition-monitoring</b> signals. These are the four
      bearings of the NASA/IMS run-to-failure test, one value every 10 minutes for a week. Bearing 1 failed at the end. Compare the
      indicators: which one wakes up first, and which one gives the clearest margin over its normal level?
    </p>
    <LifeTrend />
  </div>

  <Quiz
    question="Suppose someone doubles the sensor's gain, so every sample is 2× larger. Which feature would NOT change?"
    options={['RMS', 'Peak-to-peak', 'Crest factor', 'Max |x|']}
    answer={2}
    explain="Crest factor is a ratio (peak ÷ RMS), and both scale by 2, so it cancels. Dimensionless features like crest, impulse, shape, clearance, kurtosis and skewness are robust to calibration and mounting differences. That's one reason analysts love them."
  />
</Section>

<style>
  .layout > * { min-width: 0; }
  .layout {
    display: grid;
    grid-template-columns: minmax(280px, 380px) 1fr;
    gap: 1rem;
    align-items: start;
  }
  .flist { display: grid; margin-top: 0.4rem; }
  .domain { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin: 0.6rem 0 0.2rem; font-weight: 600; }
  .flist button {
    display: grid;
    grid-template-columns: 1fr 70px 4.5rem;
    gap: 0.5rem;
    align-items: center;
    text-align: left;
    border: 0;
    border-radius: 6px;
    background: none;
    padding: 0.22rem 0.45rem;
    font-size: 0.85rem;
  }
  .flist button:hover { background: var(--surface-2); }
  .flist button.on { background: var(--accent-soft); font-weight: 600; }
  .bar { height: 6px; background: var(--surface-3); border-radius: 3px; overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--focus); border-radius: 3px; }
  .fval { text-align: right; color: var(--text-secondary); }
  .fhead { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; align-items: start; margin-bottom: 0.4rem; }
  .fhead h3 { margin: 0 0 0.2rem; }
  .formula { font-size: 1.05rem; overflow-x: auto; max-width: 100%; }
  .formula :global(.katex-display) { margin: 0; }
  .pair-head { display: flex; justify-content: space-between; align-items: end; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.3rem; }
  .pair-head h3 { margin: 0; }
  @media (max-width: 860px) {
    .layout { grid-template-columns: 1fr; }
  }
</style>
