<script lang="ts">
  // Health indicators of all four IMS bearings over the week-long test.
  import { onMount } from 'svelte';
  import LineChart, { type LineSeries, type Marker } from '../charts/LineChart.svelte';
  import { loadIMS, INDICATORS, type IMSData, type Indicator } from '../ims';
  import { app } from '../state.svelte';

  interface Props {
    indicator?: Indicator;
    markers?: Marker[];
    extra?: LineSeries[];
    height?: number;
    picker?: boolean;
  }
  let { indicator = $bindable('envBPFO'), markers = [], extra = [], height, picker = true }: Props = $props();

  let ims = $state<IMSData | null>(null);
  let logY = $state(true);
  onMount(() => {
    loadIMS().then((d) => (ims = d));
  });

  // bearing 1 (the one that failed) carries the color; the others stay quiet but labelled
  const STYLE = [
    { color: 'var(--critical)', width: 2, dash: undefined },
    { color: 'var(--text-muted)', width: 1.2, dash: [6, 3] },
    { color: 'var(--axis)', width: 1.2, dash: undefined },
    { color: 'var(--text-secondary)', width: 1, dash: [2, 2] },
  ];
  const info = $derived(INDICATORS.find((i) => i.key === indicator)!);
  const days = $derived(ims ? ims.hours.map((h) => h / 24) : []);
  const series = $derived<LineSeries[]>(
    ims
      ? [
          ...ims.indicators[indicator].map((y, b) => ({ x: days, y, ...STYLE[b], label: b === 0 ? 'bearing 1 (failed)' : `bearing ${b + 1}` })),
          ...extra,
        ]
      : [],
  );
</script>

{#if ims}
  {#if picker}
    <div class="controls head">
      <label class="control">
        Health indicator
        <select bind:value={indicator}>{#each INDICATORS as i}<option value={i.key}>{i.name}</option>{/each}</select>
      </label>
      <label class="check"><input type="checkbox" bind:checked={logY} /> log scale</label>
      <span class="small muted blurb">{info.blurb}</span>
    </div>
  {/if}
  <LineChart
    series={series.slice().reverse()}
    {logY}
    height={height ?? (app.mode === 'lecture' ? 300 : 240)}
    xLabel="time since start of test (days)"
    yLabel={info.unit ? `${info.name} (${info.unit})` : info.name}
    legend
    {markers}
    ariaLabel="{info.name} of four bearings over time"
  />
{:else}
  <p class="muted small">Loading the run-to-failure data…</p>
{/if}

<style>
  .head { align-items: center; margin-bottom: 0.3rem; }
  .check { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--text-secondary); }
  .blurb { flex: 1 1 260px; }
</style>
