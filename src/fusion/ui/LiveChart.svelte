<script lang="ts">
  // A scrolling chart of the last few seconds of live data.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { buf, live, recent } from '../lib/live.svelte';

  interface Trace {
    key: keyof typeof buf;
    color: string;
    label?: string;
    width?: number;
    dash?: number[];
  }
  interface Props {
    traces: Trace[];
    yDomain: [number, number];
    yLabel: string;
    seconds?: number;
    height?: number;
    ariaLabel?: string;
  }
  let { traces, yDomain, yLabel, seconds = 20, height = 200, ariaLabel = 'Live sensor data' }: Props = $props();
  const series = $derived.by(() => {
    void live.tick;
    return traces.map((tr) => {
      const r = recent(tr.key, seconds);
      return { x: r.x, y: r.y, color: tr.color, label: tr.label, width: tr.width ?? 1.6, dash: tr.dash };
    });
  });
</script>

<LineChart {series} xDomain={[-seconds, 0]} {yDomain} {height} xLabel="time (s, now = 0)" {yLabel} legend={traces.some((t) => t.label)} {ariaLabel} />
