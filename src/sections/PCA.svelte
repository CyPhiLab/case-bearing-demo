<script lang="ts">
  import * as d3 from 'd3';
  import Section from '../lib/ui/Section.svelte';
  import Predict from '../lib/ui/Predict.svelte';
  import ScatterPlot from '../lib/charts/ScatterPlot.svelte';
  import ClassLegend from '../lib/charts/ClassLegend.svelte';
  import LineChart from '../lib/charts/LineChart.svelte';
  import { app } from '../lib/state.svelte';
  import { featureTable, type Dataset } from '../lib/data';
  import { FEATURES } from '../lib/dsp/features';
  import { pcaSpace } from '../lib/ml/prep';
  import { CLASS_NAMES, classVar } from '../lib/classes';

  let { ds }: { ds: Dataset } = $props();

  const rows = $derived(featureTable(ds));
  let selected = $state<boolean[]>(FEATURES.map(() => true));
  let showLabels = $state(true);
  let hovered = $state<number | null>(null);

  const cols = $derived(selected.flatMap((on, j) => (on ? [j] : [])));
  const space = $derived(cols.length >= 2 ? pcaSpace(rows, cols) : null);
  const explained = $derived(space?.model.explained ?? []);
  const cumulative = $derived(explained.reduce<number[]>((acc, v) => [...acc, (acc.at(-1) ?? 0) + v], []));
  const n95 = $derived(cumulative.findIndex((c) => c >= 0.95) + 1);

  function preset(kind: 'all' | 'time' | 'freq') {
    selected = FEATURES.map((f) => kind === 'all' || f.domain === kind);
  }

  // top loadings of PC1 / PC2, to show what each axis "means"
  const loadings = $derived(
    space
      ? [0, 1].map((k) =>
          cols
            .map((j, ci) => ({ name: FEATURES[j].name, w: space.model.components[k][ci] }))
            .sort((a, b) => Math.abs(b.w) - Math.abs(a.w))
            .slice(0, 6),
        )
      : [],
  );

  const hoverRow = $derived(hovered !== null ? rows[hovered] : null);
  const hoverWin = $derived(hoverRow ? ds.recordings[hoverRow.rec].signal.subarray(hoverRow.start, hoverRow.start + ds.frame) : null);
  const pct = d3.format('.0%');
</script>

<Section id="pca" num={5} kicker="Embedding" title="Squash 18 dimensions into 2 you can see" lecture="Neural networks: embedding & PCA">
  <p class="self-only">
    Every window is now a point in an 18-dimensional space, which nobody can picture. <b>Principal component analysis</b> finds the
    directions along which the data varies most. Projecting onto the top two gives the most informative 2D "shadow" of the cloud.
    PCA never sees the labels. The colors are added afterward, so we can check whether the classes happen to separate.
  </p>

  <div class="layout">
    <div class="card">
      <div class="head">
        <div class="controls">
          <div class="control">
            Features fed to PCA ({cols.length})
            <div class="seg">
              <button onclick={() => preset('all')} aria-pressed={cols.length === FEATURES.length}>All 18</button>
              <button onclick={() => preset('time')} aria-pressed={cols.length === 11 && selected[0]}>Time only</button>
              <button onclick={() => preset('freq')} aria-pressed={cols.length === 7 && selected[17]}>Frequency only</button>
            </div>
          </div>
          <label class="check"><input type="checkbox" bind:checked={showLabels} /> Color by true label</label>
        </div>
      </div>
      {#if space}
        <ScatterPlot
          points={space.coords.map((c, i) => ({ x: c[0], y: c[1], cls: showLabels ? rows[i].y : 0 }))}
          xLabel="PC1 ({pct(explained[0])} of variance)"
          yLabel="PC2 ({pct(explained[1])} of variance)"
          height={app.mode === 'lecture' ? 520 : 440}
          radius={3.2}
          onhover={(i) => (hovered = i)}
          onselect={(i) => {
            app.rec = rows[i].rec;
            app.windowStart = rows[i].start;
          }}
          tooltip={(i) => `<b>${showLabels ? CLASS_NAMES[rows[i].y] : 'Hidden label'}</b>${showLabels ? ` · ${ds.recordings[rows[i].rec].label}` : ''}`}
          ariaLabel="PCA projection of all windows"
        />
        {#if showLabels}<ClassLegend />{:else}<p class="small muted">This is all PCA sees: unlabelled points. Do you see clusters?</p>{/if}
      {:else}
        <p class="muted">Pick at least two features.</p>
      {/if}
      <details class="pick self-only">
        <summary>Choose individual features</summary>
        <div class="fgrid">
          {#each FEATURES as f, j}
            <label><input type="checkbox" bind:checked={selected[j]} /> {f.name}</label>
          {/each}
        </div>
      </details>
    </div>

    <div class="side">
      <div class="card">
        <h3>How much does each component explain?</h3>
        <svg class="scree" viewBox="0 0 300 120" role="img" aria-label="Explained variance per component">
          {#each explained as e, i}
            {@const w = 280 / explained.length}
            <rect x={10 + i * w + 1} y={110 - e * 100} width={w - 2} height={e * 100} rx="2" class:top={i < 2} />
          {/each}
          {#each cumulative as c, i}
            {@const w = 280 / explained.length}
            <circle cx={10 + (i + 0.5) * w} cy={110 - c * 100} r="2" class="cum" />
          {/each}
          <line x1="10" x2="290" y1={110 - 95} y2={110 - 95} class="thresh" />
          <text x="290" y={110 - 97} text-anchor="end" class="tl">95%</text>
        </svg>
        <p class="small secondary" style="margin: 0.3rem 0 0">
          Bars show each component's share and dots the running total. PC1 + PC2 capture <b>{pct(cumulative[1] ?? 0)}</b> of the
          variance. Reaching 95% takes <b>{n95}</b> of {cols.length} components, so many features are partly redundant.
        </p>
      </div>
      <div class="card" style="margin-top: 1rem">
        <h3>What the axes are made of</h3>
        <p class="small muted" style="margin: 0">Largest feature weights in each component (red positive, blue negative).</p>
        {#each loadings as list, k}
          <div class="load">
            <div class="lk">PC{k + 1}</div>
            {#each list as l}
              <div class="lrow">
                <span class="ln">{l.name}</span>
                <span class="lbar"><span class:neg={l.w < 0} style:width="{Math.abs(l.w) * 100}%"></span></span>
                <span class="lv num">{l.w.toFixed(2)}</span>
              </div>
            {/each}
          </div>
        {/each}
      </div>
      {#if hoverWin && hoverRow}
        <div class="card peek" style="margin-top: 1rem">
          <div class="small"><b>Hovered window</b> · {showLabels ? ds.recordings[hoverRow.rec].label : 'label hidden'}</div>
          <LineChart
            series={[{ y: hoverWin, dx: 1000 / ds.fs, color: showLabels ? classVar(hoverRow.y) : 'var(--text-secondary)', width: 1 }]}
            height={100}
            margin={{ top: 4, right: 4, bottom: 18, left: 34 }}
            xFormat={(v) => `${v}ms`}
            hover={false}
          />
        </div>
      {/if}
    </div>
  </div>

  <Predict question="Untick 'Color by true label'. Without the colors, how many clusters would you have guessed?">
    <p>
      Probably six or seven, not four. Several fault classes break into separate islands, one per defect <i>size</i>, because a 7 mil and a
      21 mil fault really do vibrate differently. The outer-race windows even land in opposite corners of the plot. No single straight
      line can fence off a class that's split into pieces like that, which is a problem for logistic regression in this 2D view (next
      section).
    </p>
  </Predict>
</Section>

<style>
  .layout > * { min-width: 0; }
  .layout { display: grid; grid-template-columns: 1fr minmax(260px, 340px); gap: 1rem; align-items: start; }
  .head { margin-bottom: 0.4rem; }
  .seg { display: flex; flex-wrap: wrap; }
  .seg button { border-radius: 0; margin-left: -1px; font-size: 0.8rem; }
  .seg button:first-child { border-radius: 8px 0 0 8px; margin-left: 0; }
  .seg button:last-child { border-radius: 0 8px 8px 0; }
  .check { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--text-secondary); }
  .pick { margin-top: 0.6rem; font-size: 0.85rem; }
  .pick summary { cursor: pointer; color: var(--text-secondary); }
  .fgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 0.15rem 0.8rem; margin-top: 0.4rem; }
  .fgrid label { display: flex; gap: 0.35rem; align-items: center; }
  .scree { width: 100%; height: auto; }
  .scree rect { fill: var(--axis); }
  .scree rect.top { fill: var(--accent); }
  .scree .cum { fill: var(--text-primary); }
  .scree .thresh { stroke: var(--critical); stroke-dasharray: 3 3; }
  .scree .tl { fill: var(--critical); font-size: 9px; }
  .load { margin-top: 0.5rem; }
  .lk { font-size: 0.75rem; font-weight: 700; color: var(--accent-ink); margin-bottom: 0.15rem; }
  .lrow { display: grid; grid-template-columns: 1fr 80px 3rem; gap: 0.4rem; align-items: center; font-size: 0.8rem; }
  .lbar { height: 6px; background: var(--surface-2); border-radius: 3px; overflow: hidden; }
  .lbar span { display: block; height: 100%; background: var(--div-pos); border-radius: 3px; }
  .lbar span.neg { background: var(--div-neg); }
  .lv { text-align: right; color: var(--text-secondary); }
  @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
</style>
