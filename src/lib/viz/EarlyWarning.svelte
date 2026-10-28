<script lang="ts">
  // Unsupervised condition monitoring on the IMS run-to-failure data: learn "normal" from the first
  // hours of operation, then alarm when a health indicator leaves that band.
  import { onMount } from 'svelte';
  import LifeTrend from './LifeTrend.svelte';
  import { firstAlarm, loadIMS, INDICATORS, type IMSData, type Indicator } from '../ims';
  import type { Marker } from '../charts/LineChart.svelte';

  let ims = $state<IMSData | null>(null);
  let indicator = $state<Indicator>('envBPFO');
  let baselineHours = $state(24);
  let k = $state(5);
  onMount(() => {
    loadIMS().then((d) => (ims = d));
  });

  const end = $derived(ims ? ims.hours.at(-1)! : 0);
  const alarms = $derived(
    ims ? ims.indicators[indicator].map((v) => firstAlarm(v, ims!.hours, baselineHours, k)) : [],
  );
  // how far the failing bearing finally rose above its own normal level, a measure of margin
  const margin = $derived.by(() => {
    if (!ims) return 0;
    const v = ims.indicators[indicator][0];
    const base = v.filter((_, i) => ims!.hours[i] <= baselineHours);
    const m = base.reduce((a, b) => a + b, 0) / base.length;
    const late = v.filter((_, i) => ims!.hours[i] > 24 * 4 && ims!.hours[i] < 24 * 4.5);
    return late.reduce((a, b) => a + b, 0) / late.length / m;
  });
  const markers = $derived<Marker[]>([
    { x: baselineHours / 24, label: 'baseline ends', color: 'var(--text-muted)', dash: true, row: 1 },
    ...(alarms[0]?.index >= 0 ? [{ x: ims!.hours[alarms[0].index] / 24, label: '⚠ alarm, bearing 1', color: 'var(--critical)', row: 2 }] : []),
  ]);
  const thresholdSeries = $derived(
    ims && alarms[0]
      ? [{ x: [0, end / 24], y: [alarms[0].threshold, alarms[0].threshold], color: 'var(--critical)', width: 1, dash: [2, 3], label: 'bearing 1 threshold' }]
      : [],
  );
  const days = (h: number) => (h / 24).toFixed(2);

</script>

{#if ims}
  <div class="controls">
    <label class="control">
      Health indicator
      <select bind:value={indicator}>{#each INDICATORS as i}<option value={i.key}>{i.name}</option>{/each}</select>
    </label>
    <label class="control">
      <span>Learn "normal" from the first <b>{baselineHours} h</b></span>
      <input type="range" min="6" max="72" step="6" bind:value={baselineHours} />
    </label>
    <label class="control">
      <span>Alarm above mean + <b>{k}σ</b> (3 readings in a row)</span>
      <input type="range" min="2" max="15" step="1" bind:value={k} />
    </label>
  </div>
  <LifeTrend bind:indicator {markers} extra={thresholdSeries} picker={false} />
  <table class="alarms">
    <thead><tr><th>Bearing</th><th>What happened</th><th class="r">First alarm</th><th class="r">Warning before the end</th></tr></thead>
    <tbody>
      {#each alarms as a, b}
        <tr class:failed={b === 0}>
          <td>Bearing {b + 1}</td>
          <td class="muted">{b === 0 ? 'outer race failed at the end' : 'survived the test'}</td>
          <td class="r num">{a.index >= 0 ? `day ${days(ims.hours[a.index])}` : 'no alarm'}</td>
          <td class="r num">{a.index >= 0 ? `${((end - ims.hours[a.index]) / 24).toFixed(1)} days` : '–'}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="small secondary">
    Around day 4, bearing 1's <b>{INDICATORS.find((i) => i.key === indicator)!.name}</b> sits about <b>{margin.toFixed(1)}×</b> its normal
    level. This is the margin available for setting a robust alarm threshold in a noisy plant. Note that the "healthy" bearings 2–4 sometimes alarm
    late in the test too. They share a shaft with bearing 1 and pick up its vibration, so a practical system also compares bearings with each other.
  </p>
{:else}
  <p class="muted small">Loading the run-to-failure data…</p>
{/if}

<style>
  .alarms { width: 100%; border-collapse: collapse; font-size: 0.88rem; margin: 0.6rem 0; }
  .alarms th { text-align: left; font-weight: 500; font-size: 0.75rem; color: var(--text-muted); border-bottom: 1px solid var(--grid); padding: 0.3rem; }
  .alarms td { padding: 0.3rem; border-bottom: 1px solid var(--grid); }
  .alarms .r { text-align: right; }
  .alarms tr.failed td:first-child { color: var(--critical); font-weight: 700; }
</style>
