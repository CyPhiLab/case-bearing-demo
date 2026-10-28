<script lang="ts">
  import Section from '../../lib/ui/Section.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { dftAmplitude, gaussian, linspace, mean, rms } from '../../lib/dsp/signals';
  import { app } from '../../lib/state.svelte';

  const fs = 500;
  const T = 2;
  const t = linspace(T * fs, 1 / fs);
  let sigma = $state(0.4);
  let drift = $state(0);
  let hum = $state(0);
  let seed = $state(3);
  let logY = $state(true);

  const clean = t.map((tt) => 2 + Math.sin(2 * Math.PI * tt));
  const noise = $derived(gaussian(t.length, sigma, seed));
  // interference: deterministic but unwanted, e.g. a slow drift (like the slide) or mains hum
  const interference = $derived(t.map((tt) => drift * (1.6 * tt + 1.2 * Math.sin(2 * Math.PI * 0.5 * tt) * tt) / 2 + hum * Math.sin(2 * Math.PI * 60 * tt)));
  const measured = $derived(clean.map((v, i) => v + noise[i] + interference[i]));
  const spec = $derived(dftAmplitude(measured.map((v) => v - mean(measured)), 1 / fs, 'hann'));
  const specClean = $derived(dftAmplitude(clean.map((v) => v - 2), 1 / fs, 'hann'));
  const err = $derived(measured.map((v, i) => v - clean[i]));
</script>

<Section id="noise" num={3} kicker="Measurement errors" title="Noise and interference">
  <p class="self-only">
    A measurement contains more than the signal of interest. <b>Noise</b> is random: thermal noise in resistors, electronic noise in the
    amplifier, turbulence. It is spread across all frequencies and differs from one measurement to the next. <b>Interference</b> is an unwanted signal
    that is <i>not</i> random, but comes from another source: 60 Hz mains hum picked up by a cable, a slow thermal drift, a nearby
    motor. Both corrupt the measurement, but they are reduced in different ways.
  </p>

  <div class="card">
    <div class="controls">
      <label class="control"><span>Random noise σ <b>{sigma.toFixed(2)} V</b></span><input type="range" min="0" max="1" step="0.02" bind:value={sigma} /></label>
      <label class="control"><span>Interference: drift <b>{drift.toFixed(2)}</b></span><input type="range" min="0" max="1.5" step="0.05" bind:value={drift} /></label>
      <label class="control"><span>Interference: 60 Hz hum <b>{hum.toFixed(2)} V</b></span><input type="range" min="0" max="1" step="0.02" bind:value={hum} /></label>
      <button onclick={() => seed++}>Measure again</button>
    </div>
    <LineChart
      series={[
        { y: measured, dx: 1 / fs, color: 'var(--text-secondary)', width: 1, label: 'measured' },
        { y: clean, dx: 1 / fs, color: 'var(--accent)', width: 2.5, label: 'signal y(t) = 2 + sin 2πt' },
      ]}
      height={app.mode === 'lecture' ? 300 : 240}
      xLabel="time (s)"
      yLabel="y (V)"
      legend
      ariaLabel="Signal with noise and interference"
    />
    <div class="grid-2" style="margin-top: 0.6rem">
      <div>
        <div class="row">
          <b class="small">Amplitude spectrum</b>
          <label class="check"><input type="checkbox" bind:checked={logY} /> log scale</label>
        </div>
        <LineChart
          series={[
            { x: spec.freq, y: spec.amp, color: 'var(--text-secondary)', width: 1, label: 'measured' },
            { x: specClean.freq, y: specClean.amp, color: 'var(--accent)', width: 1.5, label: 'signal' },
          ]}
          xDomain={[0, 100]}
          logY={logY}
          height={200}
          xLabel="frequency (Hz)"
          yLabel="amplitude (V)"
          markers={hum > 0 ? [{ x: 60, label: '60 Hz', color: 'var(--critical)', dash: true }] : []}
          ariaLabel="Spectrum"
        />
      </div>
      <div class="stats">
        <div class="stat"><span class="value num">{mean(measured).toFixed(3)} V</span><span class="label">mean of the measurement (signal: 2.000)</span></div>
        <div class="stat"><span class="value num">{rms(err).toFixed(3)} V</span><span class="label">RMS error vs the true signal</span></div>
        <p class="small secondary">
          <b>Noise</b> raises the whole floor of the spectrum. A fresh measurement gives a different trace with the same statistics.
          <b>Interference</b> shows up as specific features: a sharp line at 60 Hz, or the drift piling up near 0 Hz. It is the same in every
          measurement.
        </p>
      </div>
    </div>
  </div>

  <Predict question="After averaging 100 repeated measurements, which is reduced: the noise, the 60 Hz hum, or both?">
    <p>
      Only the <b>noise</b>. Random errors average toward zero, decreasing by √100 = 10× (see section 9). The hum is locked to the
      power grid, so if the measurements are triggered in the same way it is identical in each one and is not reduced by averaging.
      Interference must be removed at the source (shielding, grounding, twisted-pair cables) or with a <b>filter</b> at its frequency (section 7).
    </p>
  </Predict>
</Section>

<style>
  .row { display: flex; justify-content: space-between; align-items: center; }
  .check { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--text-secondary); }
  .stats { display: grid; gap: 0.8rem; align-content: start; }
</style>
