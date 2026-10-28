<script lang="ts">
  import { onDestroy } from 'svelte';
  import Section from '../../lib/ui/Section.svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import LineChart from '../../lib/charts/LineChart.svelte';
  import StemChart from '../viz/StemChart.svelte';
  import ScrollingSpectrogram from '../viz/ScrollingSpectrogram.svelte';
  import { DEMOS, estimateF0, noteName, startDemo, startMic, type DemoKind, type LiveSource } from '../lib/live';
  import { addClip, clips, request } from '../lib/clips.svelte';
  import { fft, hanning } from '../../lib/dsp/fft';
  import { app } from '../../lib/state.svelte';

  let src = $state<LiveSource | null>(null);
  let error = $state('');
  let demo = $state<DemoKind>('clarinet');
  let nfft = $state(4096);
  let avg = $state(1);
  let fmax = $state(5000);
  let logF = $state<'lin' | 'log'>('lin');
  let specN = $state(1024);
  let floorDb = $state(-95);
  let frozen = $state(false);

  let wave = $state(new Float64Array(0));
  let specDb = $state(new Float64Array(0));
  let specF = $state(new Float64Array(0));
  let f0 = $state(NaN);
  let levelDb = $state(-Infinity);
  let harm = $state<{ k: number; db: number }[]>([]);
  let power: Float64Array | null = null;
  let raf = 0;

  async function useMic() {
    error = '';
    stopAll();
    try {
      src = await startMic();
    } catch (e) {
      error = (e as Error).name === 'NotAllowedError' ? 'Microphone permission was denied. You can still use a simulated source.' : `Couldn't open a microphone (${(e as Error).message}). Try a simulated source.`;
    }
  }
  function useDemo() {
    stopAll();
    src = startDemo(demo);
  }
  function stopAll() {
    src?.stop();
    src = null;
    power = null;
  }

  function analyze() {
    raf = requestAnimationFrame(analyze);
    if (!src || frozen) return;
    const r = src.ring;
    const fs = r.fs;
    // waveform: ~30 ms starting at a rising zero crossing, so periodic sounds stand still
    const show = Math.round(0.03 * fs);
    const chunk = r.latest(show * 2);
    let z = 0;
    for (let i = 1; i < show; i++) if (chunk[i - 1] < 0 && chunk[i] >= 0) { z = i; break; }
    wave = Float64Array.from(chunk.subarray(z, z + show));
    // spectrum, optionally power-averaged across frames (section 9)
    const x = r.latest(nfft);
    const w = hanning(nfft);
    let wsum = 0, ss = 0;
    const re = new Float64Array(nfft), im = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) { re[i] = x[i] * w[i]; wsum += w[i]; ss += x[i] * x[i]; }
    fft(re, im);
    const half = nfft / 2;
    if (!power || power.length !== half) power = new Float64Array(half);
    const a = 1 / avg;
    for (let k = 0; k < half; k++) {
      const p = ((2 * Math.hypot(re[k], im[k])) / wsum) ** 2;
      power[k] = avg === 1 ? p : (1 - a) * power[k] + a * p;
    }
    const df = fs / nfft;
    const top = Math.min(half, Math.ceil(fmax / df) + 1);
    specF = Float64Array.from({ length: top }, (_, k) => k * df);
    specDb = Float64Array.from({ length: top }, (_, k) => 10 * Math.log10(power![k] + 1e-14));
    levelDb = 10 * Math.log10(ss / nfft + 1e-14);
    const mag = power.map(Math.sqrt);
    const est = levelDb > -60 ? estimateF0(mag, df) : NaN;
    f0 = est;
    if (est > 0) {
      const ref = mag[Math.round(est / df)] || 1e-9;
      harm = Array.from({ length: 8 }, (_, i) => {
        const c = Math.round(((i + 1) * est) / df);
        let m = 0;
        for (let j = c - 2; j <= c + 2; j++) if (j > 0 && j < half) m = Math.max(m, mag[j]);
        return { k: i + 1, db: 20 * Math.log10(m / ref + 1e-9) };
      });
    } else harm = [];
  }
  $effect(() => {
    if (!src) return;
    raf = requestAnimationFrame(analyze);
    return () => cancelAnimationFrame(raf);
  });
  onDestroy(stopAll);

  const oddEven = $derived.by(() => {
    if (harm.length < 6) return null;
    const odd = [3, 5, 7].map((k) => harm[k - 1].db), even = [2, 4, 6].map((k) => harm[k - 1].db);
    return odd.reduce((p, q) => p + q, 0) / 3 - even.reduce((p, q) => p + q, 0) / 3;
  });

  // record 2 s into the page-wide clip list
  let recording = $state(0);
  let recCount = $state(0);
  let lastRec = $state('');
  function record() {
    if (!src || recording) return;
    const start = performance.now();
    const s = src;
    const iv = setInterval(() => {
      recording = Math.min(1, (performance.now() - start) / 2000);
      if (recording >= 1) {
        clearInterval(iv);
        recording = 0;
        const x = Float64Array.from(s.ring.latest(2 * s.ring.fs));
        recCount++;
        const id = `mic-${recCount}`;
        addClip({ id, name: `Your recording #${recCount} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})`, fs: s.ring.fs, x, units: 'full scale', recorded: true });
        lastRec = id;
      }
    }, 50);
  }
  function send(where: 'filter' | 'alias') {
    request[where] = lastRec;
    document.getElementById(where === 'filter' ? 'filter-lab' : 'sampling')?.scrollIntoView({ behavior: 'smooth' });
  }
  const fs = $derived(src?.ring.fs ?? 48000);
  const h = $derived(app.mode === 'lecture' ? 280 : 220);
  const fmtF = (f: number) => (f >= 1000 ? `${(f / 1000).toFixed(2)} kHz` : `${f.toFixed(1)} Hz`);
</script>

<Section id="mic" num={10} kicker="Live lab" title="Your microphone is a measurement system">
  <p class="self-only">
    Your laptop's microphone is a transducer, its sound card an ADC sampling at {fs.toLocaleString()} Hz. Turn it on and everything
    from this page runs live: a waveform, a spectrum with its harmonics, averaging, and a spectrogram. Hum, whistle, sing a vowel, tap
    the desk, or play a note on an instrument.
  </p>
  <div class="privacy small self-only">🔒 The sound is analyzed in your browser and never leaves this page. Nothing is uploaded or stored.</div>

  <div class="card">
    <div class="controls">
      <button class="primary" onclick={useMic} data-testid="mic-start">🎤 Use my microphone</button>
      <span class="small muted">or</span>
      <select bind:value={demo} aria-label="Simulated source">{#each DEMOS as d}<option value={d.value}>{d.label}</option>{/each}</select>
      <button onclick={useDemo}>Use simulated sound</button>
      {#if src}<button onclick={stopAll}>■ Stop</button>{/if}
      {#if src}<label class="check"><input type="checkbox" bind:checked={frozen} /> freeze</label>{/if}
    </div>
    {#if error}<p class="err small" role="alert">{error}</p>{/if}
    {#if src}
      <p class="small secondary" data-testid="mic-status">Listening: <b>{src.label}</b>, f<sub>s</sub> = {fs} Hz, f<sub>N</sub> = {fs / 2} Hz</p>
    {:else}
      <p class="small muted">Not listening. Press a button above. Your browser will ask for permission before using the microphone.</p>
    {/if}

    <div class="cols">
      <div>
        <b class="small">Waveform (30 ms)</b>
        <LineChart series={[{ y: wave, dx: 1000 / fs, color: 'var(--accent)', width: 1.5 }]} xDomain={[0, 30]} yDomain={[-1, 1]} height={160} xLabel="t (ms)" yLabel="full scale" hover={false} ariaLabel="Live waveform" />
      </div>
      <div class="stats">
        <div class="stat"><span class="value num" data-testid="mic-f0">{f0 > 0 ? fmtF(f0) : '–'}</span><span class="label">fundamental f₀ {f0 > 0 ? `≈ ${noteName(f0)}` : ''}</span></div>
        <div class="stat"><span class="value num">{Number.isFinite(levelDb) ? levelDb.toFixed(1) : '–'} dBFS</span><span class="label">RMS level (0 dBFS = full scale)</span></div>
        <div class="stat"><span class="value num">{(fs / nfft).toFixed(2)} Hz</span><span class="label">δf, from a {(1000 * nfft / fs).toFixed(0)} ms window</span></div>
      </div>
    </div>

    <div class="controls" style="margin-top: 0.6rem">
      <Seg bind:value={nfft} label="FFT length" options={[1024, 4096, 16384].map((v) => ({ value: v, label: `N = ${v}` }))} />
      <Seg bind:value={avg} label="Averaging" options={[1, 8, 32].map((v) => ({ value: v, label: v === 1 ? 'no averaging' : `average ~${v}` }))} />
      <Seg bind:value={fmax} label="Frequency range" options={[1000, 5000, 20000].map((v) => ({ value: v, label: `0–${v / 1000} kHz` }))} />
      <Seg bind:value={logF} label="Frequency axis" options={[{ value: 'lin', label: 'linear' }, { value: 'log', label: 'log' }]} />
    </div>
    <LineChart
      series={[{ x: specF, y: specDb, color: 'var(--accent)', width: 1.3, fill: true }]}
      xDomain={[logF === 'log' ? 20 : 0, Math.min(fmax, fs / 2)]}
      yDomain={[-120, 0]}
      logX={logF === 'log'}
      height={h}
      xLabel="frequency (Hz)"
      yLabel="amplitude (dBFS)"
      markers={f0 > 0 ? harm.map((p) => ({ x: p.k * f0, label: p.k === 1 ? 'f₀' : `${p.k}f₀`, color: p.k % 2 ? 'var(--cls-2)' : 'var(--cls-3)', dash: true, row: p.k % 2 })) : []}
      ariaLabel="Live amplitude spectrum"
    />
    <div class="cols">
      <div>
        <b class="small">Harmonics relative to f₀</b>
        <StemChart
          stems={harm.map((p) => ({ x: p.k, y: Math.max(-60, p.db), color: p.k % 2 ? 'var(--cls-2)' : 'var(--cls-3)' }))}
          xDomain={[0.5, 8.5]}
          yDomain={[-60, 5]}
          baseline={-60}
          height={150}
          xLabel="harmonic number (orange odd, green even)"
          yLabel="dB re f₀"
          ariaLabel="Harmonic levels"
        />
      </div>
      <p class="small secondary">
        {#if oddEven !== null && f0 > 0}
          The odd harmonics are {oddEven > 0 ? 'stronger' : 'weaker'} than the even ones by <b class="num">{Math.abs(oddEven).toFixed(0)} dB</b>.
          {oddEven > 12 ? 'Mostly odd harmonics: a clarinet-like (closed-pipe) sound.' : 'Even and odd harmonics both present: brass-, voice- or string-like.'}
        {/if}
        Book Example 2.8: a clarinet's spectrum has mostly <b>odd</b> harmonics (a pipe closed at one end), while brass instruments show all of them. The harmonic mix is what makes two
        instruments playing the same note sound different (their <i>timbre</i>).
      </p>
    </div>
  </div>

  <h3>Spectrogram: frequency over time</h3>
  <p class="self-only">
    A spectrogram stacks short spectra side by side: time runs left to right, frequency up, color is level. It's the
    short-time Fourier transform (STFT). The window length sets a trade-off: short windows track fast changes but blur frequency,
    and long windows resolve frequency sharply but smear time. Try it with a whistle that slides up and down.
  </p>
  <div class="card">
    <div class="controls">
      <Seg bind:value={specN} label="STFT window" options={[256, 1024, 4096].map((v) => ({ value: v, label: `${v} (${((1000 * v) / fs).toFixed(0)} ms, δf ${(fs / v).toFixed(0)} Hz)` }))} />
      <label class="control"><span>Color floor <b>{floorDb} dB</b></span><input type="range" min="-130" max="-50" step="5" bind:value={floorDb} /></label>
    </div>
    <ScrollingSpectrogram ring={src?.ring ?? null} nfft={specN} fmax={Math.min(fmax, fs / 2)} {floorDb} height={app.mode === 'lecture' ? 300 : 240} />
  </div>

  <h3>Keep a recording</h3>
  <div class="card rec">
    <button onclick={record} disabled={!src || recording > 0} data-testid="mic-record">{recording ? `Recording… ${(recording * 2).toFixed(1)} s` : '⏺ Record 2 s'}</button>
    {#if lastRec}
      <span class="small">Saved as “{clips.find((c) => c.id === lastRec)?.name}”.</span>
      <button onclick={() => send('filter')}>Filter it (section 7) →</button>
      <button onclick={() => send('alias')}>Alias it (section 6) →</button>
    {:else}
      <span class="small muted">Recordings stay in this tab and show up in the filter lab and the aliasing demo.</span>
    {/if}
  </div>

  <Predict question="Sing a steady 'aaa' and then 'eee' on the same note. What stays the same in the spectrum, and what changes?">
    <p>
      The <b>harmonic spacing</b> stays the same, since f₀ is your pitch and the harmonics sit at exact multiples of it. What changes is
      which harmonics are loud. Your vocal tract acts as a <i>filter</i> with resonances (formants). "aaa" boosts harmonics around
      700–1200 Hz, and "eee" boosts a band near 2–3 kHz. Same source, different filter. That's section 7, in your throat.
    </p>
  </Predict>
</Section>

<style>
  h3 { margin-top: 2rem; }
  .privacy { padding: 0.4rem 0.7rem; background: var(--surface-2); border-radius: 8px; margin-bottom: 0.8rem; display: inline-block; }
  .err { color: var(--critical); }
  .check { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--text-secondary); }
  .cols { display: grid; grid-template-columns: 1fr minmax(220px, 300px); gap: 1rem; align-items: center; margin-top: 0.4rem; }
  .cols > * { min-width: 0; }
  .stats { display: grid; gap: 0.5rem; }
  .rec { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; }
  @media (max-width: 800px) { .cols { grid-template-columns: 1fr; } }
</style>
