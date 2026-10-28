<script lang="ts">
  // Spectral leakage: the DFT assumes the record repeats, so a tone without a whole number of cycles leaks.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import { dftAmplitude, linspace } from '../../lib/dsp/signals';
  import { hanning } from '../../lib/dsp/fft';
  import { app } from '../../lib/state.svelte';

  const fs = 100;
  let N = $state(64);
  let f = $state(13.2);
  let win = $state<'rect' | 'hann'>('rect');
  let pad = $state(1);
  const x = $derived(linspace(N, 1 / fs).map((tt) => Math.sin(2 * Math.PI * f * tt)));
  const spec = $derived(dftAmplitude(x, 1 / fs, win, N * pad));
  const specDb = $derived(spec.amp.map((a) => 20 * Math.log10(a + 1e-6)));
  const df = $derived(fs / N);
  const peak = $derived.by(() => {
    let b = 0;
    for (let i = 1; i < spec.amp.length; i++) if (spec.amp[i] > spec.amp[b]) b = i;
    return { f: spec.freq[b], a: spec.amp[b] };
  });
  // the record as the DFT "sees" it: windowed and repeated end to end
  const w = $derived(win === 'hann' ? hanning(N) : null);
  const repeated = $derived(Float64Array.from({ length: 3 * N }, (_, i) => x[i % N] * (w ? w[i % N] : 1)));
  const bins = $derived(f / df);
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Tone f <b>{f.toFixed(2)} Hz</b> = {bins.toFixed(2)} δf</span><input type="range" min="5" max="20" step="0.01" bind:value={f} /></label>
    <Seg bind:value={N} label="Record length" options={[32, 64, 128, 256, 512].map((v) => ({ value: v, label: `N=${v}` }))} />
    <Seg bind:value={win} label="Window" options={[{ value: 'rect', label: 'Rectangular (none)' }, { value: 'hann', label: 'Hann' }]} />
    <Seg bind:value={pad} label="Zero padding" options={[1, 4, 16].map((v) => ({ value: v, label: v === 1 ? 'no padding' : `pad ×${v}` }))} />
    <button onclick={() => (f = Math.round(f / df) * df)}>Snap f to a bin</button>
  </div>
  <div class="grid-2">
    <div>
      <b class="small">Periodic extension assumed by the DFT</b>
      <LineChart
        series={[{ y: repeated, dx: 1 / fs, color: 'var(--accent)', width: 1.5 }]}
        xDomain={[0, (3 * N) / fs]}
        yDomain={[-1.2, 1.2]}
        height={app.mode === 'lecture' ? 220 : 180}
        xLabel="t (s)"
        yLabel="y"
        bands={[{ x0: N / fs, x1: (2 * N) / fs, fill: 'color-mix(in srgb, var(--accent) 8%, transparent)', label: 'record' }]}
        markers={[{ x: N / fs, color: 'var(--critical)', dash: true }, { x: (2 * N) / fs, color: 'var(--critical)', dash: true }]}
        hover={false}
        ariaLabel="Periodic extension of the record"
      />
      <p class="small secondary">
        {#if win === 'rect' && Math.abs(bins - Math.round(bins)) > 0.02}
          The record does not contain a whole number of cycles, so there is a <b>discontinuity at each joint</b> (red lines). A
          discontinuity contains many frequencies, so energy leaks across the spectrum.
        {:else if win === 'hann'}
          The Hann window tapers both ends to zero, so the joints are continuous for any f. The cost is a wider main peak.
        {:else}
          The record contains a whole number of cycles, so the joints are continuous and there is no leakage.
        {/if}
      </p>
    </div>
    <div>
      <b class="small">Amplitude spectrum (dB)</b>
      <LineChart
        series={[{ x: spec.freq, y: specDb, color: 'var(--accent)', width: 1.5 }]}
        xDomain={[0, fs / 2]}
        yDomain={[-80, 5]}
        height={app.mode === 'lecture' ? 220 : 180}
        xLabel="frequency (Hz)"
        yLabel="dB re 1"
        markers={[{ x: f, label: 'true f', color: 'var(--cls-2)', dash: true }]}
        ariaLabel="Spectrum in dB"
      >
        {#snippet overlay({ x: sx, y: sy })}
          {#if pad === 1 && N <= 128}
            {#each specDb as v, i}<circle cx={sx(spec.freq[i])} cy={sy(Math.max(-80, v))} r="2.5" class="bin" />{/each}
          {/if}
        {/snippet}
      </LineChart>
      <div class="statrow">
        <div class="stat"><span class="value num">{df.toFixed(2)} Hz</span><span class="label">δf = 1/(Nδt)</span></div>
        <div class="stat"><span class="value num">{peak.f.toFixed(2)} Hz</span><span class="label">peak location</span></div>
        <div class="stat"><span class="value num">{peak.a.toFixed(2)}</span><span class="label">peak amplitude (true 1.00)</span></div>
      </div>
    </div>
  </div>
</div>

<style>
  .bin { fill: var(--accent); }
  .statrow { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; margin-top: 0.4rem; }
</style>
