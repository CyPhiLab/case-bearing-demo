<script lang="ts">
  // Averaging in the frequency domain: one long FFT versus the Welch average of many short segments,
  // on random vibration with a resonance (a broadband spectrum, where averaging matters most).
  import LineChart from '../../lib/charts/LineChart.svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import { dftAmplitude, gaussian, welch } from '../../lib/dsp/signals';
  import { butter, sosfilt, sosResponse } from '../../lib/dsp/filters';
  import { app } from '../../lib/state.svelte';

  const fs = 1000;
  const n = 16384;
  const sos = butter('bandpass', 1, [115, 125], fs);
  const G = 6, floor = 0.2;
  const e1 = gaussian(n, 1, 77), e2 = gaussian(n, 1, 78);
  const res = sosfilt(sos, e1);
  const x = res.map((v, i) => G * v + floor * e2[i]);
  // amplitude (Hann, sine-normalized) → one-sided PSD: A² / (2 δf ENBW), ENBW = 1.5 bins for Hann
  const psdDb = (amp: ArrayLike<number>, df: number) => Float64Array.from(amp, (a) => 10 * Math.log10((a * a) / (2 * df * 1.5) + 1e-15));
  const one = dftAmplitude(x, 1 / fs, 'hann');
  const oneDb = psdDb(one.amp, fs / n);
  const fTrue = Float64Array.from({ length: 500 }, (_, i) => 1 + i);
  const Hm = sosResponse(sos, fTrue, fs).mag;
  const trueDb = fTrue.map((_, i) => 10 * Math.log10((2 / fs) * (G * G * Hm[i] ** 2 + floor * floor)));
  let nseg = $state(512);
  const w = $derived(welch(x, fs, nseg));
  const wDb = $derived(psdDb(w.amp, fs / nseg));
  const scatter = (f: ArrayLike<number>, d: ArrayLike<number>) => {
    const v: number[] = [];
    for (let i = 0; i < f.length; i++) if (f[i] > 300 && f[i] < 480) v.push(d[i]);
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
  };
  const peak = $derived(Math.max(...wDb));
</script>

<div class="card">
  <div class="controls">
    <Seg bind:value={nseg} label="Welch segment length" options={[64, 512, 2048, 8192].map((v) => ({ value: v, label: `${v} samples` }))} />
    <span class="small secondary">{w.segments} segments averaged (50% overlap), δf = {(fs / nseg).toFixed(2)} Hz</span>
  </div>
  <LineChart
    series={[
      { x: one.freq, y: oneDb, color: 'var(--text-muted)', width: 0.8, label: `one FFT of all ${n} samples` },
      { x: w.freq, y: wDb, color: 'var(--accent)', width: 2.5, label: 'Welch average' },
      { x: fTrue, y: trueDb, color: 'var(--text-primary)', width: 1.5, dash: [5, 4], label: 'true spectrum' },
    ]}
    xDomain={[0, fs / 2]}
    yDomain={[-65, 0]}
    height={app.mode === 'lecture' ? 300 : 250}
    xLabel="frequency (Hz)"
    yLabel="PSD (dB re 1 g²/Hz)"
    legend
    ariaLabel="Single FFT versus Welch average"
  />
  <div class="statrow">
    <div class="stat"><span class="value num">±{scatter(one.freq, oneDb).toFixed(1)} dB</span><span class="label">noise-floor scatter, one FFT</span></div>
    <div class="stat"><span class="value num">±{scatter(w.freq, wDb).toFixed(1)} dB</span><span class="label">scatter, Welch ({w.segments} averages)</span></div>
    <div class="stat"><span class="value num">{peak.toFixed(1)} dB</span><span class="label">Welch peak (true {Math.max(...trueDb).toFixed(1)} dB)</span></div>
  </div>
  <p class="small secondary">
    Random vibration of a structure with a resonance near 120 Hz. One long FFT has fine resolution, but every bin is a single random
    sample, so it scatters by about ±5.6 dB however long you record. Welch averages away the scatter. The price is resolution: with
    64-sample segments (δf ≈ 16 Hz) the resonance is smeared, and its peak reads too low.
  </p>
</div>

<style>
  .statrow { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; margin-top: 0.4rem; }
</style>
