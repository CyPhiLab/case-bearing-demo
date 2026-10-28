<script lang="ts">
  // Slide 10: the four classic filter shapes, with passband, stopband, cutoff and roll-off labeled.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import type { FilterType } from '../../lib/dsp/filters';
  import { app } from '../../lib/state.svelte';

  let type = $state<FilterType>('lowpass');
  let n = $state(4);
  const f = Float64Array.from({ length: 500 }, (_, i) => 10 ** (-1 + (2.3 * i) / 499)); // 0.1 … 20 (× f_c)
  const f1 = 0.7, f2 = 1.4; // band edges for BP/BS
  const f0 = Math.sqrt(f1 * f2), B = f2 - f1;
  const real = $derived(
    f.map((v) => {
      switch (type) {
        case 'lowpass': return 1 / Math.sqrt(1 + v ** (2 * n));
        case 'highpass': return 1 / Math.sqrt(1 + v ** (-2 * n));
        case 'bandpass': return 1 / Math.sqrt(1 + ((v * v - f0 * f0) / (v * B)) ** (2 * n));
        default: return 1 / Math.sqrt(1 + ((v * B) / (v * v - f0 * f0 + 1e-12)) ** (2 * n));
      }
    }),
  );
  const ideal = $derived(
    f.map((v) => {
      switch (type) {
        case 'lowpass': return v <= 1 ? 1 : 0;
        case 'highpass': return v >= 1 ? 1 : 0;
        case 'bandpass': return v >= f1 && v <= f2 ? 1 : 0;
        default: return v >= f1 && v <= f2 ? 0 : 1;
      }
    }),
  );
  const pass = 'color-mix(in srgb, var(--good) 12%, transparent)';
  const stopc = 'color-mix(in srgb, var(--critical) 9%, transparent)';
  const bands = $derived(
    type === 'lowpass'
      ? [{ x0: 0.1, x1: 0.7, fill: pass, label: 'passband' }, { x0: 2.5, x1: 20, fill: stopc, label: 'stopband' }]
      : type === 'highpass'
        ? [{ x0: 0.1, x1: 0.4, fill: stopc, label: 'stopband' }, { x0: 1.5, x1: 20, fill: pass, label: 'passband' }]
        : type === 'bandpass'
          ? [{ x0: 0.1, x1: 0.35, fill: stopc, label: 'stop' }, { x0: 0.8, x1: 1.25, fill: pass, label: 'pass' }, { x0: 3, x1: 20, fill: stopc, label: 'stop' }]
          : [{ x0: 0.1, x1: 0.45, fill: pass, label: 'pass' }, { x0: 0.88, x1: 1.12, fill: stopc, label: 'stop' }, { x0: 2.2, x1: 20, fill: pass, label: 'pass' }],
  );
  const markers = $derived(
    type === 'lowpass' || type === 'highpass'
      ? [{ x: 1, label: 'cutoff f_c', color: 'var(--cls-2)', dash: true }]
      : [{ x: f1, label: 'f_1', color: 'var(--cls-2)', dash: true }, { x: f2, label: 'f_2', color: 'var(--cls-2)', dash: true }],
  );
  const DESC: Record<FilterType, string> = {
    lowpass: 'Keeps slow content, removes fast content: smoothing noise, anti-aliasing before an ADC.',
    highpass: 'Removes slow content: drift, DC offset, gravity in an accelerometer signal.',
    bandpass: 'Keeps one band: isolating a gear-mesh frequency or one radio station.',
    bandstop: 'Removes one band (a notch when narrow): 60 Hz mains hum.',
  };
</script>

<div class="card">
  <div class="controls">
    <Seg bind:value={type} label="Filter type" options={[
      { value: 'lowpass', label: 'Low-pass' }, { value: 'highpass', label: 'High-pass' },
      { value: 'bandpass', label: 'Band-pass' }, { value: 'bandstop', label: 'Band-stop' }]} />
    <label class="control"><span>Roll-off (order n) <b>{n}</b></span><input type="range" min="1" max="10" step="1" bind:value={n} /></label>
  </div>
  <LineChart
    series={[
      { x: f, y: ideal, color: 'var(--text-muted)', width: 1.5, dash: [5, 4], label: 'ideal ("brick wall")' },
      { x: f, y: real, color: 'var(--accent)', width: 2.5, label: `real (Butterworth, n = ${n})` },
    ]}
    logX
    xDomain={[0.1, 20]}
    yDomain={[0, 1.12]}
    height={app.mode === 'lecture' ? 280 : 220}
    xLabel="frequency (× f_c, log scale)"
    yLabel="gain |G|"
    {bands}
    {markers}
    ariaLabel="Filter magnitude response"
  />
  <p class="small secondary"><span class="key dash"></span> ideal "brick wall" &nbsp; <span class="key"></span> real Butterworth filter, order {n}<br /><b>{type[0].toUpperCase() + type.slice(1, -4)}-{type.slice(-4)}:</b> {DESC[type]} The real filter can't jump from pass to stop. The steepness of that transition is the <b>roll-off</b>.</p>
</div>

<style>
  .key { display: inline-block; width: 18px; height: 0; border-top: 3px solid var(--accent); vertical-align: middle; margin-right: 0.25rem; }
  .key.dash { border-top: 2px dashed var(--text-muted); }
</style>
