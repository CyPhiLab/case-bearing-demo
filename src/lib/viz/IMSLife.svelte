<script lang="ts">
  // Step through the life of the IMS bearing that failed on its own: waveform, sound and envelope spectrum.
  import { onMount } from 'svelte';
  import LineChart from '../charts/LineChart.svelte';
  import { loadIMS, fmtDays, type IMSData } from '../ims';
  import { envelopeSpectrum } from '../dsp/fft';
  import * as audio from '../audio';
  import { app } from '../state.svelte';

  let ims = $state<IMSData | null>(null);
  let err = $state('');
  let k = $state(0);
  let playing = $state(false);
  onMount(() => {
    loadIMS().then((d) => (ims = d)).catch((e) => (err = String(e)));
    return () => audio.stop();
  });

  const snap = $derived(ims?.snapshots[k]);
  const sig = $derived(ims?.signals[k]);
  const env = $derived.by(() => {
    if (!ims || !sig) return null;
    const e = envelopeSpectrum(sig.subarray(0, 16384), ims.fs, ims.envBand);
    const n = e.freq.findIndex((f) => f > 760);
    return { freq: e.freq.subarray(1, n), amp: e.amp.subarray(1, n) };
  });
  // fixed y-scale across the whole life so growth is visible
  const envMax = $derived.by(() => {
    if (!ims) return 1;
    let m = 0;
    for (const s of ims.signals) {
      const e = envelopeSpectrum(s.subarray(0, 16384), ims.fs, ims.envBand);
      for (let i = 1; i < e.amp.length && e.freq[i] < 760; i++) m = Math.max(m, e.amp[i]);
    }
    return m * 1.05;
  });
  const sigMax = $derived(ims ? Math.max(...ims.signals.map((s) => Math.max(...Array.from(s, Math.abs)))) : 1);
  const trendY = $derived(ims ? ims.indicators.envBPFO[0] : []);

  function toggle() {
    if (playing) {
      audio.stop();
      playing = false;
      return;
    }
    if (!ims || !sig) return;
    // same gain for every snapshot, so you hear the bearing get louder as it fails
    audio.play(sig, { fs: ims.fs, slow: 1, gain: 0.5 / sigMax, from: 0, onended: () => (playing = false) });
    playing = true;
  }
  $effect(() => {
    void k;
    audio.stop();
    playing = false;
  });
</script>

{#if err}
  <p class="small" style="color: var(--critical)">Couldn't load the run-to-failure data: {err}</p>
{:else if !ims || !snap || !sig || !env}
  <p class="muted small">Loading the run-to-failure recordings…</p>
{:else}
  <div class="controls top">
    <label class="control life">
      <span>Moment in the bearing's life <b>{fmtDays(snap.hours)}</b> <span class="muted">of {fmtDays(ims.hours.at(-1)!)}</span></span>
      <input type="range" min="0" max={ims.snapshots.length - 1} step="1" bind:value={k} />
    </label>
    <button class="primary" onclick={toggle}>{playing ? '■ Stop' : '▶ Listen (1 s)'}</button>
  </div>
  <LineChart
    series={[{ x: ims.hours.map((h) => h / 24), y: trendY, color: 'var(--critical)', width: 1.3 }]}
    height={80}
    margin={{ top: 4, right: 14, bottom: 18, left: 56 }}
    xFormat={(v) => `day ${v}`}
    yFormat={() => ''}
    markers={[{ x: snap.hours / 24, color: 'var(--text-primary)', label: 'current' }]}
    hover={false}
    onpoint={(x) => {
      let best = 0;
      ims!.snapshots.forEach((s, i) => Math.abs(s.hours / 24 - x) < Math.abs(ims!.snapshots[best].hours / 24 - x) && (best = i));
      k = best;
    }}
    ariaLabel="Outer-race health indicator over the bearing's life"
  />
  <div class="grid-2" style="margin-top: 0.6rem">
    <div>
      <div class="small"><b>Waveform</b> <span class="muted">first 100 ms, same scale for every day</span></div>
      <LineChart
        series={[{ y: sig, dx: 1000 / ims.fs, color: 'var(--text-secondary)', width: 1 }]}
        xDomain={[0, 100]}
        yDomain={[-sigMax, sigMax]}
        height={app.mode === 'lecture' ? 220 : 180}
        xLabel="time (ms)"
        yLabel="g"
        hover={false}
        ariaLabel="IMS waveform"
      />
    </div>
    <div>
      <div class="small"><b>Envelope spectrum</b> <span class="muted">{ims.envBand[0] / 1000}–{ims.envBand[1] / 1000} kHz band, same scale for every day</span></div>
      <LineChart
        series={[{ x: env.freq, y: env.amp, color: 'var(--critical)', width: 1.3 }]}
        xDomain={[0, 760]}
        yDomain={[0, envMax]}
        height={app.mode === 'lecture' ? 220 : 180}
        xLabel="frequency (Hz)"
        yLabel="g"
        markers={[
          { x: ims.bpfo, label: `BPFO ${ims.bpfo.toFixed(0)} Hz`, color: 'var(--cls-3)' },
          { x: 2 * ims.bpfo, label: '2×', color: 'var(--cls-3)', dash: true },
          { x: 3 * ims.bpfo, label: '3×', color: 'var(--cls-3)', dash: true },
        ]}
        ariaLabel="IMS envelope spectrum"
      />
    </div>
  </div>
{/if}

<style>
  .top { align-items: end; margin-bottom: 0.4rem; }
  .life { flex: 1 1 320px; max-width: 560px; }
</style>
