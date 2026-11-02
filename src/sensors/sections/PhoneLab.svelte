<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import QRCode from 'qrcode';
  import SensorSection from '../ui/SensorSection.svelte';
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { motionSupported, requestMotionPermission, resample } from '../../signals/lib/motion';
  import { ImuRecorder, imuCSV, requestOrientationPermission, simulateImu, tiltX, tiltY, unwrapDeg, type ImuRecord } from '../lib/orientation';
  import { complementaryFilter, integrate } from '../lib/physics';
  import { mean } from '../../lib/dsp/signals';
  import { app } from '../../lib/state.svelte';

  let mobile = $state(false);
  let qr = $state('');
  let url = $state('');
  onMount(async () => {
    mobile = matchMedia('(pointer: coarse)').matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    url = `${location.origin}${location.pathname}#phone`;
    qr = await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#000000', light: '#ffffff' } });
  });

  const MAX = 30; // s
  let rec = $state<ImuRecord | null>(null);
  let recorder: ImuRecorder | null = null;
  let timer = $state<ReturnType<typeof setInterval> | null>(null);
  let elapsed = $state(0);
  let status = $state('');
  let live = $state<ReturnType<ImuRecorder['last']>>(null);
  let liveCount = $state(0);

  async function start() {
    status = '';
    if (!motionSupported()) {
      status = 'This browser has no motion sensor API. Use a phone, or the simulated recording.';
      return;
    }
    const ok = await requestMotionPermission();
    await requestOrientationPermission();
    if (!ok) {
      status = 'Motion access was denied. On iPhone: Settings → Safari → Motion & Orientation Access.';
      return;
    }
    recorder = new ImuRecorder();
    recorder.start();
    const t0 = performance.now();
    elapsed = 0;
    timer = setInterval(() => {
      elapsed = (performance.now() - t0) / 1000;
      liveCount = recorder!.count;
      live = recorder!.last();
      if (elapsed > 1.5 && liveCount === 0) {
        finish();
        status = 'No motion events were received. The device may have no motion sensors, or the page must be opened over https.';
        return;
      }
      if (elapsed >= MAX) finish();
    }, 100);
  }
  function finish() {
    if (timer) clearInterval(timer);
    timer = null;
    if (!recorder) return;
    const r = recorder.stop();
    recorder = null;
    live = null;
    if (r.t.length > 30) rec = r;
  }
  onDestroy(() => {
    if (timer) clearInterval(timer);
    recorder?.stop();
  });
  function simulate() {
    rec = simulateImu();
    status = '';
  }
  function download() {
    if (!rec) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([imuCSV(rec)], { type: 'text/csv' }));
    a.download = `imu-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---- analysis ----
  let alpha = $state(0.98);
  const fsMeas = $derived(rec ? (rec.t.length - 1) / (rec.t[rec.t.length - 1] - rec.t[0]) : 0);
  const fsU = $derived(Math.max(1, Math.round(fsMeas)));
  const hasGyro = $derived(!!rec && rec.gx.some((v) => !Number.isNaN(v)));
  const hasHeading = $derived(!!rec && rec.heading.some((v) => !Number.isNaN(v)));
  const an = $derived.by(() => {
    if (!rec) return null;
    const r = rec;
    const ay = resample(r.t, r.ay, fsU), az = resample(r.t, r.az, fsU);
    let acc = unwrapDeg(ay.map((v, i) => tiltX(v, az[i])));
    const n0 = Math.max(1, Math.round(0.3 * fsU));
    const a0 = mean(acc.slice(0, n0));
    acc = acc.map((v) => v - a0);
    const dt = 1 / fsU;
    if (!hasGyro) return { acc, gyro: null, fused: null, bias: NaN, n: acc.length, dt, flipped: false };
    const gx = resample(r.t, r.gx.map((v) => (Number.isNaN(v) ? 0 : v)), fsU);
    // browsers disagree on the sign of the accelerometer axes; align the accelerometer angle with the gyro
    let c = 0;
    for (let i = 1; i < acc.length; i++) c += (acc[i] - acc[i - 1]) * gx[i];
    const flipped = c < 0;
    if (flipped) acc = acc.map((v) => -v);
    const gyro = integrate(gx, dt);
    const fused = complementaryFilter(gx, acc, dt, alpha, 0);
    const bias = mean(gx.slice(0, Math.max(1, Math.round(1 * fsU))));
    return { acc, gyro, fused, bias, n: acc.length, dt, flipped };
  });
  const head = $derived(rec && hasHeading ? resample(rec.t, unwrapDeg(rec.heading.map((v, i, a) => (Number.isNaN(v) ? (a.find((x) => !Number.isNaN(x)) ?? 0) : v))), fsU) : null);
  const headRange = $derived.by((): [number, number] => {
    if (!head) return [0, 360];
    const m = mean(head);
    return [m - 120, m + 120];
  });
  const h = $derived(app.mode === 'lecture' ? 260 : 220);

  const spec = {
    measures: 'Acceleration, rotation rate and magnetic field, each along three axes',
    principle: 'MEMS accelerometer and gyroscope, Hall or magnetoresistive magnetometer, in one or two chips',
    output: 'Browser motion and orientation events',
    range: 'Typically ±8 g, ±2000 °/s, ±4900 µT',
    sensitivity: 'Varies by phone; the browser may round values',
    bandwidth: 'Events at ~60–200 Hz, unevenly spaced',
    watch: 'Uneven sampling, gyro bias, magnets and steel near the phone, different axis conventions between browsers',
  };
</script>

<SensorSection id="phone" title="Phone sensor lab" {spec}>
  {#snippet intro()}
    <p>
      A smartphone contains an IMU: a three-axis accelerometer, a three-axis gyroscope and a three-axis magnetometer. This lab records all three
      through the browser. Hold the phone still for the first second (so the gyro bias can be estimated), then tilt it forward and back, shake it, and
      bring a magnet or a steel tool close to it. The analysis compares the tilt from the accelerometer, the integrated gyro and their fusion, and
      shows the compass heading.
    </p>
  {/snippet}

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
        {#if timer}
          <button class="primary" onclick={finish} data-testid="imu-stop">Stop and analyze ({elapsed.toFixed(1)} s, {liveCount} samples)</button>
        {:else}
          <button class="primary" onclick={start} data-testid="imu-start">Start recording</button>
        {/if}
        <button onclick={simulate} data-testid="imu-sim">Use a simulated recording</button>
      </div>
      {#if timer}<div class="bar"><div style:width="{(elapsed / MAX) * 100}%"></div></div>{/if}
      {#if status}<p class="small err" role="alert">{status}</p>{/if}
      {#if live}
        {@const tx = tiltX(live.ay, live.az)}
        {@const ty = tiltY(live.ax, live.ay, live.az)}
        <div class="live" data-testid="imu-live">
          <svg viewBox="-50 -50 100 100" class="level" aria-label="Bubble level">
            <circle r="46" class="ring" />
            <circle r="12" class="ring" />
            <circle cx={Math.max(-38, Math.min(38, -ty))} cy={Math.max(-38, Math.min(38, tx))} r="8" class="bubble" />
          </svg>
          <svg viewBox="-50 -50 100 100" class="level" aria-label="Compass">
            <circle r="46" class="ring" />
            <text y="-34" text-anchor="middle" class="n">N</text>
            {#if !Number.isNaN(live.heading)}
              <g transform="rotate({-live.heading})"><path d="M0,-40 L5,0 L0,6 L-5,0 Z" class="needle" /></g>
            {/if}
          </svg>
          <div class="nums small num">
            <div>tilt x <b>{tx.toFixed(1)}°</b>, tilt y <b>{ty.toFixed(1)}°</b></div>
            <div>gyro <b>{Number.isNaN(live.gx) ? '–' : `${live.gx.toFixed(1)}, ${live.gy.toFixed(1)}, ${live.gz.toFixed(1)}`}</b> °/s</div>
            <div>heading <b data-testid="imu-heading">{Number.isNaN(live.heading) ? 'not available' : `${live.heading.toFixed(0)}°`}</b></div>
          </div>
        </div>
      {:else if !rec}
        <p class="small muted">
          {mobile ? 'Press start, hold the phone still for a second, then move it.' : 'Laptops usually have no motion sensors. Scan the code with a phone, or use the simulated recording.'}
        </p>
      {/if}
    </div>
  </div>

  {#if rec && an}
    <div class="card" style="margin-top: 1rem" data-testid="imu-analysis">
      <div class="statrow">
        <div class="stat"><span class="value num">{fsMeas.toFixed(1)} Hz</span><span class="label">sample rate, {rec.t.length} samples in {rec.t[rec.t.length - 1].toFixed(1)} s</span></div>
        <div class="stat"><span class="value num">{Number.isNaN(an.bias) ? '–' : `${an.bias.toFixed(2)} °/s`}</span><span class="label">gyro x reading during the first second (bias, if the phone was still)</span></div>
        {#if an.gyro}
          <div class="stat"><span class="value num">{(an.gyro[an.n - 1] - an.acc[an.n - 1]).toFixed(1)}°</span><span class="label">integrated gyro minus accelerometer tilt at the end</span></div>
        {/if}
      </div>
      <div class="controls" style="margin-top: 0.6rem">
        {#if an.gyro}
          <label class="control"><span>Complementary filter α <b>{alpha.toFixed(3)}</b></span><input type="range" min="0.8" max="0.999" step="0.001" bind:value={alpha} /></label>
        {/if}
        <button onclick={download}>Download CSV</button>
      </div>
      <LineChart
        series={[
          { y: an.acc, dx: an.dt, color: 'var(--axis)', width: 1, label: 'accelerometer tilt' },
          ...(an.gyro ? [{ y: an.gyro, dx: an.dt, color: 'var(--cls-2)', width: 1.8, label: 'integrated gyro' }] : []),
          ...(an.fused ? [{ y: an.fused, dx: an.dt, color: 'var(--accent)', width: 2.2, label: 'complementary filter' }] : []),
        ]}
        height={h}
        yDomain={[-90, 90]}
        xLabel="time (s)"
        yLabel="tilt about the x axis (°)"
        legend
        ariaLabel="Tilt estimates from the phone"
      />
      {#if head}
        <LineChart
          series={[{ y: head, dx: an.dt, color: 'var(--cls-3)', width: 1.8, label: 'compass heading' }]}
          height={h - 30}
          yDomain={headRange}
          xLabel="time (s)"
          yLabel="heading (°)"
          ariaLabel="Compass heading"
        />
      {:else}
        <p class="small muted">This browser does not report a compass heading (Firefox and some desktop browsers do not).</p>
      {/if}
      <p class="small secondary">
        {#if rec.simulated}
          Simulated: the phone is tilted at 2, 5 and 13 s, shaken between 9 and 12 s, and a magnet is held near it between 14 and 17 s. The gyro has
          a 0.8 °/s bias, so the integrated gyro drifts by about 16° over 20 s. The shaking corrupts the accelerometer tilt but hardly affects the
          fused estimate. The magnet swings the compass by about 70° although the phone did not turn.
        {:else}
          The integrated gyro drifts away from the accelerometer tilt; the fused estimate follows the gyro during fast motion and the accelerometer
          over the long run. If you brought a magnet or a steel tool near the phone, the heading changed although the phone did not turn.
        {/if}
        {#if an.flipped}The accelerometer angle was sign-flipped to match the gyro, since browsers differ in their axis conventions.{/if}
      </p>
    </div>
  {/if}
</SensorSection>

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
  .live { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; margin-top: 0.8rem; }
  .level { width: 110px; height: 110px; }
  .ring { fill: none; stroke: var(--axis); stroke-width: 1.5; }
  .bubble { fill: var(--cls-3); opacity: 0.8; }
  .needle { fill: var(--critical); }
  .n { font-size: 10px; font-weight: 700; fill: var(--text-secondary); }
  .nums { display: grid; gap: 0.2rem; }
  .statrow { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.8rem; }
  @media (max-width: 760px) { .layout { grid-template-columns: 1fr; } .statrow { grid-template-columns: 1fr; } }
</style>
