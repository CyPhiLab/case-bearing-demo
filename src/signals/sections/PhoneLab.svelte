<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import QRCode from 'qrcode';
  import Section from '../../lib/ui/Section.svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import LineChart from '../../lib/charts/LineChart.svelte';
  import StemChart from '../viz/StemChart.svelte';
  import { MotionRecorder, motionSupported, requestMotionPermission, resample, simulateRecord, toCSV, type MotionRecord } from '../lib/motion';
  import { addClip, clips, request } from '../lib/clips.svelte';
  import { mean, rms, welch } from '../../lib/dsp/signals';
  import { app } from '../../lib/state.svelte';

  let mobile = $state(false);
  let qr = $state('');
  let url = $state('');
  onMount(async () => {
    mobile = matchMedia('(pointer: coarse)').matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    url = `${location.origin}${location.pathname}#phone`;
    qr = await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#000000', light: '#ffffff' } });
  });

  let duration = $state(10);
  let rec = $state<MotionRecord | null>(null);
  let recorder: MotionRecorder | null = null;
  let elapsed = $state(0);
  let liveCount = $state(0);
  let status = $state('');
  let timer = $state<ReturnType<typeof setInterval> | null>(null);

  async function start() {
    status = '';
    if (!motionSupported()) { status = 'This browser has no motion sensor API. Use a phone, or the simulated recording.'; return; }
    const ok = await requestMotionPermission();
    if (!ok) { status = 'Motion access was denied. On iPhone: Settings → Safari → Motion & Orientation Access.'; return; }
    recorder = new MotionRecorder();
    recorder.start();
    const t0 = performance.now();
    elapsed = 0;
    timer = setInterval(() => {
      elapsed = (performance.now() - t0) / 1000;
      liveCount = recorder!.count;
      if (elapsed > 1.5 && liveCount === 0) {
        finish();
        status = 'No motion events were received. The device may have no accelerometer, or the page must be opened over https.';
        return;
      }
      if (elapsed >= duration) finish();
    }, 100);
  }
  function finish() {
    if (timer) clearInterval(timer);
    timer = null;
    if (!recorder) return;
    const r = recorder.stop();
    recorder = null;
    if (r.t.length > 16) rec = r;
  }
  onDestroy(() => { if (timer) clearInterval(timer); recorder?.stop(); });

  function simulate() {
    const fan = clips.find((c) => c.id === 'fan')!;
    rec = simulateRecord(fan.x, fan.fs);
    status = '';
  }

  // ---- analysis ----
  let axis = $state<'x' | 'y' | 'z' | 'mag'>('z');
  let detrend = $state<'on' | 'off'>('on');
  const dt = $derived(rec ? Float64Array.from({ length: rec.t.length - 1 }, (_, i) => rec!.t[i + 1] - rec!.t[i]) : new Float64Array(0));
  const fsMeas = $derived(rec ? (rec.t.length - 1) / (rec.t[rec.t.length - 1] - rec.t[0]) : 0);
  const jitter = $derived(dt.length ? Math.sqrt(mean(dt.map((v) => (v - 1 / fsMeas) ** 2))) * 1000 : 0);
  const fsU = $derived(Math.max(1, Math.round(fsMeas)));
  const raw = $derived.by(() => {
    if (!rec) return new Float64Array(0);
    const r = rec;
    return axis === 'x' ? r.ax : axis === 'y' ? r.ay : axis === 'z' ? r.az : r.ax.map((v, i) => Math.hypot(v, r.ay[i], r.az[i]));
  });
  const uni = $derived(rec ? resample(rec.t, raw, fsU) : new Float64Array(0));
  const sig = $derived.by(() => { const m = mean(uni); return detrend === 'on' ? uni.map((v) => v - m) : uni; });
  const spec = $derived.by(() => {
    if (sig.length < 64) return null;
    const nseg = Math.min(1024, 2 ** Math.floor(Math.log2(sig.length / 4)));
    return welch(sig, fsU, Math.max(32, nseg));
  });
  const peakF = $derived.by(() => {
    if (!spec) return NaN;
    let b = 1;
    for (let k = 1; k < spec.amp.length; k++) if (spec.amp[k] > spec.amp[b]) b = k;
    return spec.freq[b];
  });
  const hist = $derived.by(() => {
    if (!dt.length) return [] as { x: number; y: number }[];
    const ms = Array.from(dt, (v) => v * 1000);
    const lo = Math.floor(Math.min(...ms)), hi = Math.ceil(Math.max(...ms));
    const w = Math.max(0.25, (hi - lo) / 30);
    const bins = new Map<number, number>();
    for (const v of ms) { const b = lo + Math.floor((v - lo) / w) * w + w / 2; bins.set(b, (bins.get(b) ?? 0) + 1); }
    return [...bins].map(([x, y]) => ({ x, y }));
  });

  let sent = $state(0);
  function toClip() {
    if (!rec) return;
    sent++;
    const id = `phone-${sent}`;
    addClip({ id, name: `Phone, ${axis === 'mag' ? '|a|' : axis + '-axis'} #${sent}${rec.simulated ? ' (simulated)' : ''}`, fs: fsU, x: Float64Array.from(sig), units: 'm/s²', recorded: true });
    request.filter = id;
    document.getElementById('filter-lab')?.scrollIntoView({ behavior: 'smooth' });
  }
  function download() {
    if (!rec) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([toCSV(rec)], { type: 'text/csv' }));
    a.download = `accelerometer-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const h = $derived(app.mode === 'lecture' ? 260 : 210);
</script>

<Section id="phone" num={11} kicker="Live lab" title="Smartphone accelerometer">
  <p class="self-only">
    Smartphones contain a MEMS accelerometer, a small proof mass on silicon springs, which the browser can read. After recording a
    vibration, determine the actual sample rate (it is not constant), the Nyquist frequency, the RMS level and the frequency content.
    Suitable sources are a running washing machine, a fan housing, a car dashboard, or walking with the phone in hand.
  </p>

  <div class="layout" class:mobile>
    {#if !mobile}
      <div class="card qr">
        <b>Open this lab on a phone</b>
        <div class="code" aria-label="QR code linking to this lab">{@html qr}</div>
        <span class="small muted url">{url}</span>
        <span class="small secondary">The browser asks for permission to use the motion sensors. Nothing is uploaded.</span>
      </div>
    {/if}
    <div class="card">
      <div class="controls">
        <Seg bind:value={duration} label="Record length" options={[5, 10, 20].map((v) => ({ value: v, label: `${v} s` }))} />
        <button class="primary" onclick={start} disabled={!!timer} data-testid="phone-start">{timer ? `Recording… ${elapsed.toFixed(1)} s (${liveCount} samples)` : 'Record accelerometer'}</button>
        <button onclick={simulate} data-testid="phone-sim">Use a simulated recording</button>
      </div>
      {#if timer}<div class="bar"><div style:width="{(elapsed / duration) * 100}%"></div></div>{/if}
      {#if status}<p class="small err" role="alert">{status}</p>{/if}
      {#if !rec}
        <p class="small muted">{mobile ? 'Place the phone on a vibrating surface, then start recording.' : 'Laptops usually have no accelerometer. Scan the code with a phone, or use the simulated recording (a phone on a table next to a fan).'}</p>
      {/if}
    </div>
  </div>

  {#if rec}
    <div class="card" style="margin-top: 1rem" data-testid="phone-analysis">
      <div class="statrow">
        <div class="stat"><span class="value num" data-testid="phone-fs">{fsMeas.toFixed(1)} Hz</span><span class="label">measured sample rate, {rec.t.length} samples in {rec.t[rec.t.length - 1].toFixed(1)} s</span></div>
        <div class="stat"><span class="value num">{(fsMeas / 2).toFixed(1)} Hz</span><span class="label">Nyquist frequency f_N = f_s/2</span></div>
        <div class="stat"><span class="value num">±{jitter.toFixed(2)} ms</span><span class="label">timing jitter (std of δt around {(1000 / fsMeas).toFixed(2)} ms)</span></div>
        <div class="stat"><span class="value num">{rms(sig).toFixed(3)} m/s²</span><span class="label">RMS{detrend === 'on' ? ' after removing the mean' : ''} = {(rms(sig) / 9.81).toFixed(4)} g</span></div>
      </div>
      <div class="controls" style="margin-top: 0.6rem">
        <Seg bind:value={axis} label="Axis" options={[{ value: 'x', label: 'x' }, { value: 'y', label: 'y' }, { value: 'z', label: 'z' }, { value: 'mag', label: '|a|' }]} />
        <Seg bind:value={detrend} label="Remove gravity" options={[{ value: 'on', label: 'remove mean (gravity)' }, { value: 'off', label: 'raw' }]} />
        <button onclick={download}>Download CSV</button>
        <button onclick={toClip}>Open in filter lab (section 7)</button>
      </div>
      <LineChart series={[{ y: sig, dx: 1 / fsU, color: 'var(--accent)', width: 1.2 }]} height={h} xLabel={`t (s), resampled to a uniform ${fsU} Hz`} yLabel="acceleration (m/s²)" ariaLabel="Acceleration time history" />
      <div class="grid-2">
        <div>
          <b class="small">Spectrum (Welch average)</b>
          {#if spec}
            <LineChart
              series={[{ x: spec.freq, y: spec.amp, color: 'var(--accent)', width: 1.5, fill: true }]}
              xDomain={[0, fsU / 2]}
              height={h - 20}
              xLabel="frequency (Hz)"
              yLabel="amplitude (m/s²)"
              markers={[{ x: peakF, label: `peak ${peakF.toFixed(1)} Hz`, color: 'var(--cls-2)', dash: true }]}
              ariaLabel="Acceleration spectrum"
            />
          {/if}
        </div>
        <div>
          <b class="small">Distribution of sample intervals</b>
          <StemChart stems={hist} xDomain={[hist.length ? Math.min(...hist.map((b) => b.x)) - 0.5 : 0, hist.length ? Math.max(...hist.map((b) => b.x)) + 0.5 : 1]} height={h - 20} xLabel="δt (ms)" yLabel="count" ariaLabel="Sample interval histogram" />
        </div>
      </div>
      {#if rec.simulated}
        <p class="small secondary">
          Simulated: a phone sampling at about 100 Hz on a table next to a fan, with a 20 Hz shaft imbalance and a 60 Hz blade-pass tone.
          The 60 Hz tone is above f<sub>N</sub> ≈ 50 Hz, so it appears aliased at |60 − 100| = <b>40 Hz</b>. Phone accelerometers
          generally lack an effective anti-aliasing filter, which limits how far a phone spectrum can be trusted.
        </p>
      {:else}
        <p class="small secondary">
          The phone delivered samples at about {fsMeas.toFixed(0)} Hz, so content above {(fsMeas / 2).toFixed(0)} Hz is either
          lost or aliased into the range shown. The spectrum peak at {peakF.toFixed(1)} Hz is {peakF * 60 > 100 ? `${(peakF * 60).toFixed(0)} rpm if it comes from something rotating` : 'a low frequency, typical of walking or swaying'}.
        </p>
      {/if}
    </div>
  {/if}
</Section>

<style>
  .layout { display: grid; grid-template-columns: minmax(200px, 260px) 1fr; gap: 1rem; align-items: start; }
  .layout.mobile { grid-template-columns: 1fr; }
  .layout > * { min-width: 0; }
  .qr { display: grid; gap: 0.4rem; justify-items: center; text-align: center; }
  .code { width: 180px; height: 180px; background: #fff; padding: 6px; border-radius: 8px; }
  .code :global(svg) { width: 100%; height: 100%; display: block; }
  .url { word-break: break-all; }
  .bar { height: 6px; background: var(--surface-2); border-radius: 3px; overflow: hidden; margin-top: 0.5rem; }
  .bar > div { height: 100%; background: var(--critical); }
  .err { color: var(--critical); }
  .statrow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.8rem; }
  @media (max-width: 760px) { .layout { grid-template-columns: 1fr; } .statrow { grid-template-columns: 1fr 1fr; } }
</style>
