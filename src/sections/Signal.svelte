<script lang="ts">
  import { onMount } from 'svelte';
  import Section from '../lib/ui/Section.svelte';
  import Predict from '../lib/ui/Predict.svelte';
  import RecordingPicker from '../lib/ui/RecordingPicker.svelte';
  import LineChart, { type Marker } from '../lib/charts/LineChart.svelte';
  import { app } from '../lib/state.svelte';
  import type { Dataset } from '../lib/data';
  import { amplitudeSpectrum, envelopeSpectrum } from '../lib/dsp/fft';
  import { RIG_RPM, faultFrequencies } from '../lib/bearing';
  import { classVar } from '../lib/classes';
  import * as audio from '../lib/audio';
  import IMSLife from '../lib/viz/IMSLife.svelte';
  import PUCompare from '../lib/viz/PUCompare.svelte';

  let { ds }: { ds: Dataset } = $props();

  const SPANS = [0.02, 0.05, 0.2, 1, 10];
  let span = $state(0.05);
  let t0 = $state(1.0);
  let showPeriod = $state(true);
  let logSpec = $state(false);
  let band = $state<[number, number]>([2000, 5000]);
  let slow = $state(1);
  let equalize = $state(true);
  let playing = $state(false);
  let playhead = $state<number | null>(null);

  const rec = $derived(ds.recordings[app.rec]);
  const fs = $derived(ds.fs);
  const dur = $derived(rec.signal.length / fs);
  const ff = faultFrequencies(RIG_RPM);
  const FAULT_FREQ: Record<string, { f: number; name: string; ci: number }> = {
    Ball: { f: 2 * ff.bsf, name: '2×BSF', ci: 1 },
    'Inner Race': { f: ff.bpfi, name: 'BPFI', ci: 2 },
    'Outer Race': { f: ff.bpfo, name: 'BPFO', ci: 3 },
  };
  const expected = $derived(FAULT_FREQ[rec.cls]);

  $effect(() => {
    // keep the view inside the recording when zooming out
    if (t0 + span > dur) t0 = Math.max(0, dur - span);
  });

  const i0 = $derived(Math.floor(t0 * fs));
  const i1 = $derived(Math.min(rec.signal.length, Math.floor((t0 + span) * fs)));
  const view = $derived(rec.signal.subarray(i0, i1));

  // impact-spacing markers anchored on the biggest spike in view
  const periodMarkers = $derived.by((): Marker[] => {
    if (!showPeriod || !expected || span > 0.25) return [];
    let peak = 0;
    for (let i = 1; i < view.length; i++) if (Math.abs(view[i]) > Math.abs(view[peak])) peak = i;
    const tp = t0 + peak / fs;
    const T = 1 / expected.f;
    const out: Marker[] = [];
    for (let k = -Math.ceil(span / T); k <= Math.ceil(span / T); k++) {
      const x = tp + k * T;
      if (x >= t0 && x <= t0 + span) out.push({ x, color: classVar(expected.ci), dash: true, label: k === 0 ? `every 1/${expected.name} = ${(T * 1000).toFixed(1)} ms` : undefined });
    }
    return out;
  });

  // spectrum of ~1.4 s starting at the view
  const NFFT = 16384;
  const specStart = $derived(Math.min(i0, rec.signal.length - NFFT));
  const spec = $derived(amplitudeSpectrum(rec.signal.subarray(specStart, specStart + NFFT), fs));
  const env = $derived(envelopeSpectrum(rec.signal.subarray(0, 65536), fs, band));
  const envCut = $derived.by(() => {
    const n = env.freq.findIndex((f) => f > 520);
    return { freq: env.freq.subarray(1, n), amp: env.amp.subarray(1, n) };
  });

  const envMarkers = $derived<Marker[]>([
    { x: ff.shaft, label: 'f_r', color: 'var(--text-muted)' },
    { x: ff.bpfo, label: 'BPFO', color: classVar(3) },
    { x: 2 * ff.bpfo, color: classVar(3), dash: true },
    { x: 2 * ff.bsf, label: '2×BSF', color: classVar(1), row: 1 },
    { x: ff.bpfi, label: 'BPFI', color: classVar(2), row: 2 },
    { x: 2 * ff.bpfi, color: classVar(2), dash: true },
  ]);

  // overview: decimated envelope of the whole 10 s for the navigator
  const overview = $derived.by(() => {
    const n = 1200;
    const step = Math.floor(rec.signal.length / n);
    const mx = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let m = 0;
      for (let j = i * step; j < (i + 1) * step; j++) m = Math.max(m, Math.abs(rec.signal[j]));
      mx[i] = m;
    }
    return { y: mx, dx: step / fs };
  });
  const globalMax = $derived(Math.max(...ds.recordings.map((r) => r.rms)));

  function togglePlay() {
    if (playing) {
      audio.stop();
      playing = false;
      return;
    }
    const gain = equalize ? 0.12 / rec.rms : 0.12 / globalMax;
    audio.play(rec.signal, { fs, slow, gain, from: t0, onended: () => (playing = false) });
    playing = true;
  }

  $effect(() => {
    // switching recordings stops playback
    void app.rec;
    audio.stop();
    playing = false;
  });

  onMount(() => {
    let raf = 0;
    const tick = () => {
      playhead = audio.position();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      audio.stop();
    };
  });

  const fmtMs = (v: number) => `${((v - t0) * 1000).toFixed(span < 0.1 ? 0 : 0)}`;
</script>

<Section id="signal" num={2} kicker="Measured signals" title="Time signals, spectra and envelope analysis" lecture="Data: plot your data!">
  <p class="self-only">
    These are real recordings from the drive-end accelerometer at 1772 rpm (1 hp load): one healthy bearing and three defect sizes for
    each fault location. Each recording is 10 s long, or 120,000 samples. Before any machine learning, the data should be <b>plotted</b>. Here they can also
    be listened to.
  </p>
  <dl class="defs self-only">
    <dt>Time signal</dt><dd>Acceleration (in g) against time. Impacts appear as short bursts, repeated at the fault frequency.</dd>
    <dt>Spectrum</dt><dd>The amplitude of each frequency component, computed with the FFT. It shows which resonances the impacts excite.</dd>
    <dt>Envelope spectrum</dt><dd>The spectrum of the signal's envelope after band-pass filtering around a resonance. It shows how often the resonance is excited, which is the fault frequency.</dd>
  </dl>

  <div class="card">
    <RecordingPicker {ds} bind:value={app.rec} />
  </div>

  <div class="card" style="margin-top: 1rem">
    <div class="head">
      <h3>Time signal <span class="muted small">{rec.label} · RMS {rec.rms.toFixed(3)} g</span></h3>
      <div class="controls">
        <div class="control">
          Zoom
          <div class="seg" role="group" aria-label="Time span">
            {#each SPANS as s}
              <button aria-pressed={span === s} onclick={() => (span = s)}>{s < 1 ? `${s * 1000} ms` : `${s} s`}</button>
            {/each}
          </div>
        </div>
        {#if expected}
          <label class="check"><input type="checkbox" bind:checked={showPeriod} /> Show expected impact spacing</label>
        {/if}
      </div>
    </div>
    <LineChart
      series={[{ y: view, xStart: i0 / fs, dx: 1 / fs, color: 'var(--text-secondary)', width: 1.2, label: 'acceleration' }]}
      xDomain={[t0, t0 + span]}
      height={app.mode === 'lecture' ? 300 : 240}
      xLabel={span <= 0.2 ? 'time in view (ms)' : 'time (s)'}
      xFormat={span <= 0.2 ? fmtMs : undefined}
      yLabel="acceleration (g)"
      markers={periodMarkers}
      ariaLabel="Vibration waveform"
    />
    <div class="nav">
      <span class="muted small">Drag to move through the 10 s recording</span>
      <LineChart
        series={[{ y: overview.y, dx: overview.dx, color: 'var(--axis)', width: 1, fill: true }]}
        height={64}
        margin={{ top: 4, right: 14, bottom: 18, left: 56 }}
        bands={[{ x0: t0, x1: t0 + Math.max(span, 0.04), fill: 'color-mix(in srgb, var(--accent) 30%, transparent)' }]}
        markers={playhead !== null ? [{ x: playhead, color: 'var(--critical)' }] : []}
        hover={false}
        xFormat={(v) => `${v}s`}
        yFormat={() => ''}
        onpoint={(x) => (t0 = Math.max(0, Math.min(dur - span, x - span / 2)))}
        ariaLabel="Recording overview"
      />
    </div>
    <div class="controls audio">
      <button class="primary" onclick={togglePlay}>{playing ? '■ Stop' : '▶ Listen'}</button>
      <label class="control">
        <span>Playback speed <b>{slow === 1 ? 'real time' : `1/${slow}×`}</b></span>
        <select bind:value={slow}>
          <option value={1}>Real time</option>
          <option value={2}>½× (an octave lower)</option>
          <option value={4}>¼× (hear individual impacts)</option>
        </select>
      </label>
      <label class="check"><input type="checkbox" bind:checked={equalize} /> Equalize loudness</label>
      <span class="muted small self-only">Headphones are recommended. Untick "equalize" to hear the actual difference in loudness.</span>
    </div>
  </div>

  <Predict question="Listen to Healthy, then Outer race 7 mil at ¼ speed. What changed besides the volume?">
    <p>
      The healthy bearing produces a smooth hiss. The faulty one adds a regular sequence of <b>clicks</b>: the impacts shown in the
      animation in section 1. At ¼ speed, the outer-race fault ticks about 26 times per second (BPFO ≈ 106 Hz ÷ 4).
    </p>
  </Predict>

  <div class="grid-2" style="margin-top: 1rem">
    <div class="card">
      <div class="head">
        <h3>Spectrum <span class="muted small">FFT of 1.4 s</span></h3>
        <label class="check"><input type="checkbox" bind:checked={logSpec} /> log scale</label>
      </div>
      <LineChart
        series={[{ x: spec.freq, y: spec.amp, color: classVar(rec.clsIndex), width: 1.2, label: 'amplitude' }]}
        xDomain={[0, fs / 2]}
        logY={logSpec}
        height={240}
        xLabel="frequency (Hz)"
        yLabel="amplitude (g)"
        bands={[{ x0: band[0], x1: band[1], fill: 'color-mix(in srgb, var(--focus) 10%, transparent)', label: 'envelope band' }]}
        ariaLabel="Frequency spectrum"
      />
      <p class="small secondary self-only">
        Impacts are very short, so their energy is spread over several kilohertz and excites the <b>resonances</b> of the housing. Note the
        broad band of energy at 2–5 kHz, which the healthy bearing does not have. The fault <i>rate</i> (~100–160 Hz) is contained in the way
        this energy rises and decays with each impact.
      </p>
    </div>
    <div class="card">
      <div class="head">
        <h3>Envelope spectrum <span class="muted small">rate at which the resonance is excited</span></h3>
      </div>
      <LineChart
        series={[{ x: envCut.freq, y: envCut.amp, color: classVar(rec.clsIndex), width: 1.4, label: 'envelope amplitude' }]}
        xDomain={[0, 520]}
        height={240}
        xLabel="frequency (Hz)"
        yLabel="envelope amplitude (g)"
        markers={envMarkers}
        ariaLabel="Envelope spectrum with fault frequency markers"
      />
      <div class="controls">
        <label class="control">
          <span>Band low <b>{band[0]} Hz</b></span>
          <input type="range" min="500" max="5500" step="100" value={band[0]} oninput={(e) => (band = [Math.min(+e.currentTarget.value, band[1] - 200), band[1]])} />
        </label>
        <label class="control">
          <span>Band high <b>{band[1]} Hz</b></span>
          <input type="range" min="700" max="6000" step="100" value={band[1]} oninput={(e) => (band = [band[0], Math.max(+e.currentTarget.value, band[0] + 200)])} />
        </label>
      </div>
    </div>
  </div>

  <div class="self-only explain">
    <p>
      <b>Envelope analysis</b> is a standard technique in bearing diagnostics. The signal is band-pass filtered around the resonance, its
      envelope (the magnitude of the analytic signal) is computed, and the FFT of the envelope is taken. Inner- and outer-race faults then
      produce peaks at BPFI and BPFO, the frequencies calculated from the geometry in section 1.
    </p>
    <p>
      Measured data are less clean than textbook examples. For the <b>ball</b> faults and the <b>outer race 14 mil</b> recording, the
      envelope spectra do not show the expected line clearly. Researchers who benchmarked this dataset (Smith &amp; Randall, 2015) reported the same
      result. This is one reason to use a model that combines many features rather than a single diagnostic rule.
    </p>
  </div>

  <div class="card" style="margin-top: 1rem">
    <h3>Run-to-failure data (NASA/IMS)</h3>
    <p class="small secondary">
      A machined pit is present at full size from the start, whereas real damage develops gradually. This is bearing 1 of the NASA/IMS run-to-failure test
      (the second rig in section 1). It was recorded for one second every 10 minutes for a week, until its outer race failed. Use the slider to move
      through the test, and note when the <b>BPFO line at 236 Hz</b> appears in the envelope spectrum, well before the waveform changes
      noticeably.
    </p>
    <IMSLife />
  </div>

  <div class="card" style="margin-top: 1rem">
    <h3>Machined vs. real damage (Paderborn)</h3>
    <p class="small secondary">
      CWRU and many textbook examples use <i>machined</i> faults: a clean notch or hole. Fatigue damage is different: rough pitting
      spread over a larger area. These recordings come from Paderborn University (third rig in section 1), where the same kind of 6203
      bearing was damaged both ways and measured on the same test stand. Compare the waveforms, the envelope spectra and the sound.
    </p>
    <PUCompare />
  </div>
</Section>

<style>
  .head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem 1rem; margin-bottom: 0.4rem; }
  .head h3 { margin: 0; }
  .seg { display: flex; }
  .seg button { border-radius: 0; margin-left: -1px; font-size: 0.8rem; padding: 0.2em 0.55em; }
  .seg button:first-child { border-radius: 8px 0 0 8px; margin-left: 0; }
  .seg button:last-child { border-radius: 0 8px 8px 0; }
  .check { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--text-secondary); }
  .nav { margin-top: 0.4rem; }
  .audio { margin-top: 0.8rem; align-items: center; }
  .explain { margin-top: 1rem; }
</style>
