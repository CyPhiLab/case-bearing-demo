<script lang="ts">
  // Sampling in amplitude: an N-bit ADC rounds every sample to one of 2^N levels.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import { linspace, quantize, rms } from '../../lib/dsp/signals';
  import { play, stop } from '../../lib/audio';
  import { app } from '../../lib/state.svelte';

  let bits = $state(3);
  let levelDb = $state(-1);
  const range = 2; // ±1 V input range
  const A = $derived(10 ** (levelDb / 20));
  const n = 600;
  const t = linspace(n, 1 / n);
  const analog = $derived(t.map((tt) => A * Math.sin(2 * Math.PI * tt)));
  const digital = $derived(quantize(analog, bits, range));
  const err = $derived(digital.map((v, i) => v - analog[i]));
  const lsb = $derived(range / 2 ** bits);
  const snr = $derived(20 * Math.log10(rms(analog) / Math.max(rms(err), 1e-12)));
  const theory = $derived(6.02 * bits + 1.76 + levelDb);

  // a plucked A-major chord to listen to
  const fsA = 16000;
  const tA = linspace(2 * fsA, 1 / fsA);
  const chord = tA.map((tt) => [220, 277.18, 329.63, 440].reduce((s, f, k) => s + Math.exp(-tt * (1.5 + k * 0.4)) * Math.sin(2 * Math.PI * f * tt + k), 0) / 4);
  const chordPk = chord.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  let playing = $state<string | null>(null);
  function go(which: 'orig' | 'q') {
    if (playing === which) { stop(); playing = null; return; }
    playing = which;
    const sig = chord.map((v) => (v * A * 0.95) / chordPk);
    play(which === 'orig' ? sig : quantize(sig, bits, range), { fs: fsA, slow: 1, gain: 1, from: 0, onended: () => (playing = null) });
  }
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>ADC resolution <b>{bits} bit{bits > 1 ? 's' : ''}</b> = {2 ** bits} levels</span><input type="range" min="1" max="16" step="1" bind:value={bits} /></label>
    <label class="control"><span>Signal level <b>{levelDb} dB</b> of full scale</span><input type="range" min="-40" max="0" step="1" bind:value={levelDb} /></label>
    <button onclick={() => go('orig')}>{playing === 'orig' ? '■ Stop' : '▶ Original'}</button>
    <button onclick={() => go('q')}>{playing === 'q' ? '■ Stop' : `▶ ${bits}-bit`}</button>
  </div>
  <div class="cols">
    <div>
      <LineChart
        series={[
          { y: analog, dx: 1 / n, color: 'var(--text-muted)', width: 1.5, label: 'analog input' },
          { y: digital, dx: 1 / n, color: 'var(--accent)', width: 2, label: 'digital code × LSB' },
        ]}
        xDomain={[0, 1]}
        yDomain={[-1.05, 1.05]}
        height={app.mode === 'lecture' ? 260 : 210}
        xLabel="t / T"
        yLabel="voltage (V)"
        legend
        ariaLabel="Quantized sine"
      >
        {#snippet overlay({ x, y })}
          {#if bits <= 5}
            {#each { length: 2 ** bits } as _, k}<line x1={x(0)} x2={x(1)} y1={y(-1 + k * lsb)} y2={y(-1 + k * lsb)} class="lvl" />{/each}
          {/if}
        {/snippet}
      </LineChart>
      <LineChart
        series={[{ y: err, dx: 1 / n, color: 'var(--cls-2)', width: 1.2 }]}
        xDomain={[0, 1]}
        yDomain={[-Math.max(lsb, 1e-4) * 0.75, Math.max(lsb, 1e-4) * 0.75]}
        height={120}
        xLabel="t / T"
        yLabel="error (V)"
        yFormat={(v) => (Math.abs(v) < 0.01 && v !== 0 ? `${(v * 1000).toPrecision(2)}m` : v.toPrecision(2))}
        ariaLabel="Quantization error"
      />
    </div>
    <div class="stats">
      <div class="stat"><span class="value num">{lsb >= 0.01 ? `${lsb.toFixed(3)} V` : `${(lsb * 1000).toPrecision(3)} mV`}</span><span class="label">LSB step = range / 2<sup>N</sup> (range 2 V)</span></div>
      <div class="stat"><span class="value num">{snr.toFixed(1)} dB</span><span class="label">measured SNR (signal RMS / error RMS)</span></div>
      <div class="stat"><span class="value num">{theory.toFixed(1)} dB</span><span class="label">theory for a full-scale sine, shifted by the signal level</span></div>
      <div class="small"><Tex math={'\\text{SNR} \\approx 6.02N + 1.76\\ \\text{dB}'} /></div>
      <p class="small secondary">
        The error never exceeds ±LSB/2, and each additional bit halves it (+6 dB). A small signal in a large input range uses only a few
        codes: at −40 dB, a 16-bit ADC performs like a 9-bit one. The DAQ input range should be matched to the signal.
      </p>
    </div>
  </div>
</div>

<style>
  .lvl { stroke: var(--grid); stroke-dasharray: 2 3; }
  .cols { display: grid; grid-template-columns: 1fr minmax(220px, 300px); gap: 1rem; align-items: start; }
  .cols > * { min-width: 0; }
  .stats { display: grid; gap: 0.6rem; }
  @media (max-width: 800px) { .cols { grid-template-columns: 1fr; } }
</style>
