<script lang="ts">
  import { onMount } from 'svelte';
  import QRCode from 'qrcode';

  const TOPICS = [
    { id: 'sensors', t: 'The sensors in a phone', d: 'Accelerometer, gyroscope and magnetometer, and what each gets wrong' },
    { id: 'tilt', t: 'Tilt from the accelerometer', d: 'Gravity gives the tilt, but only when the phone is not accelerating' },
    { id: 'gyro', t: 'Angle from the gyroscope', d: 'Integrating the rotation rate, and why the angle drifts' },
    { id: 'complementary', t: 'Complementary filter', d: 'A low-pass and a high-pass filter that add up to one' },
    { id: 'kalman', t: 'Kalman filter', d: 'Weighting by uncertainty and estimating the gyro bias' },
    { id: 'orientation', t: '3D orientation', d: 'Quaternions, the Madgwick filter and the compass' },
    { id: 'dead-reckoning', t: 'Dead reckoning', d: 'Why integrating acceleration twice does not give position' },
  ];
  let qr = $state('');
  let url = $state('');
  let mobile = $state(true);
  onMount(async () => {
    mobile = matchMedia('(pointer: coarse)').matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    url = `${location.origin}${location.pathname}`;
    qr = await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#000000', light: '#ffffff' } });
  });
</script>

<div id="top" class="hero">
  <div class="kicker">Measurements · Sensor fusion</div>
  <h1>Sensor fusion with a phone</h1>
  <div class="lead">
    <div>
      <p class="lede">
        No single sensor in a phone measures orientation well. The accelerometer knows which way is down but is fooled by motion, the gyroscope
        follows fast turns but drifts, and the magnetometer finds north but is disturbed by nearby steel. Sensor fusion combines them so that each
        covers the others' weaknesses. This page builds up the idea step by step, from one tilt angle to full 3D orientation, using the sensors in
        your own phone.
      </p>
      <ol class="topics">
        {#each TOPICS as tp, i}
          <li><a href="#{tp.id}"><span class="n">{i + 1}</span><span><span class="tt">{tp.t}</span><span class="d">{tp.d}</span></span></a></li>
        {/each}
      </ol>
    </div>
    {#if !mobile}
      <div class="card qr">
        <b>Open this page on a phone</b>
        <div class="code" aria-label="QR code linking to this page">{@html qr}</div>
        <span class="small muted url">{url}</span>
        <span class="small secondary">The live figures need a phone's motion sensors. The browser asks for permission; nothing is uploaded.</span>
      </div>
    {/if}
  </div>
  <div class="how self-only">
    <div>
      <b>How to use this page.</b> Each section has a figure with simulated data and a live figure that uses the phone. Press
      <i>Start phone sensors</i> once; every live figure on the page then uses the same data. Purple <span class="tag p">Predict</span> boxes ask
      you to commit to a guess before revealing the answer.
    </div>
    <div class="muted small">
      For teaching, switch to <b>Lecture</b> mode (top right) for big type and visuals only. PageDown/PageUp steps through the sections.
    </div>
  </div>
</div>

<style>
  .hero { max-width: var(--content); margin: 0 auto; padding: 4rem 1.25rem 3rem; }
  .kicker { font-size: 0.8rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent-ink); margin-bottom: 0.6rem; }
  h1 { font-size: clamp(2.1rem, 5vw, 3.6rem); letter-spacing: -0.02em; margin-bottom: 1rem; }
  .lead { display: grid; grid-template-columns: minmax(0, 1fr) 240px; gap: 1.5rem; align-items: start; }
  .lede { font-size: 1.15rem; color: var(--text-secondary); max-width: 68ch; }
  .topics { list-style: none; padding: 0; margin: 2rem 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 0.5rem; }
  .topics a { display: flex; gap: 0.5rem; align-items: baseline; padding: 0.55rem 0.75rem; border-radius: var(--radius); background: var(--surface-1); border: 1px solid var(--grid); color: var(--text-primary); text-decoration: none; font-weight: 600; font-size: 0.92rem; height: 100%; box-sizing: border-box; }
  .topics a:hover { border-color: var(--accent); }
  .tt { display: block; }
  .d { display: block; font-weight: 400; font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.1rem; }
  .n { font-family: var(--mono); font-size: 0.75rem; color: var(--accent-ink); }
  .qr { display: grid; gap: 0.4rem; justify-items: center; text-align: center; }
  .code { width: 180px; height: 180px; background: #fff; padding: 6px; border-radius: 8px; }
  .code :global(svg) { width: 100%; height: 100%; display: block; }
  .url { word-break: break-all; }
  .how { display: grid; gap: 0.4rem; padding: 0.9rem 1rem; border-radius: var(--radius); background: var(--surface-2); font-size: 0.9rem; max-width: 92ch; }
  .tag { font-size: 0.68rem; text-transform: uppercase; color: #fff; padding: 0.05em 0.45em; border-radius: 4px; letter-spacing: 0.05em; }
  .tag.p { background: var(--focus); }
  @media (max-width: 760px) { .lead { grid-template-columns: minmax(0, 1fr); } }
</style>
