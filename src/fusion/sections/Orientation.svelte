<script lang="ts">
  import Section from '../../lib/ui/Section.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import LiveStart from '../ui/LiveStart.svelte';
  import Phone3D from '../ui/Phone3D.svelte';
  import OrientationExplorer from '../viz/OrientationExplorer.svelte';
  import { cur, live, params, resetOrientation } from '../lib/live.svelte';
  import { qAngleBetween, qToEuler, type Quat } from '../lib/fusion';

  let logBeta = $state(Math.log10(params.beta));
  $effect(() => {
    params.beta = 10 ** logBeta;
  });
  const snap = $derived.by(() => {
    void live.tick;
    return { gyro: cur.qGyro, mad: cur.qMad, madc: cur.qMadC, browser: cur.qBrowser };
  });
  const rows = $derived.by(() => {
    const list: { name: string; q: Quat | null }[] = [
      { name: 'Gyro only', q: snap.gyro },
      { name: 'Madgwick (accelerometer + gyro)', q: snap.mad },
      { name: `Madgwick${params.useCompass ? ' + compass' : ''}`, q: snap.madc },
      { name: "Phone's own estimate", q: snap.browser },
    ];
    return list.map((r) => ({ ...r, e: r.q ? qToEuler(r.q) : null, d: r.q && snap.browser ? qAngleBetween(r.q, snap.browser) : NaN }));
  });
</script>

<Section id="orientation" num={6} kicker="Three sensors" title="Orientation in 3D">
  <p class="self-only">
    So far only one tilt angle has been tracked. A phone can turn about any axis, and in 3D the order of rotations matters: tilting then turning
    ends in a different orientation than turning then tilting. Three angles (such as heading α, tilt β and sideways tilt γ) describe any
    orientation, but they behave badly when the middle angle reaches ±90°, where the other two rotate about the same axis (gimbal lock). Fusion
    filters therefore use a <b>quaternion</b>, four numbers that encode a single rotation by an angle θ about an axis n:
  </p>
  <div class="eq self-only"><Tex display math={'q = \\left[\\cos\\tfrac{\\theta}{2},\\ n_x\\sin\\tfrac{\\theta}{2},\\ n_y\\sin\\tfrac{\\theta}{2},\\ n_z\\sin\\tfrac{\\theta}{2}\\right], \\qquad \\dot q = \\tfrac{1}{2}\\, q \\otimes [0,\\ \\omega_x,\\ \\omega_y,\\ \\omega_z]'} /></div>
  <p class="self-only">
    The second equation integrates the gyro rates into the orientation, the 3D version of θ = ∫ω dt. It has no singularity, and normalizing q
    after each step keeps it a valid rotation.
  </p>
  <OrientationExplorer />

  <h3>The Madgwick filter and the compass</h3>
  <p class="self-only">
    The <b>Madgwick filter</b> is a complementary filter for quaternions. Each step integrates the gyro rate, then nudges the orientation so that
    the direction of gravity it predicts in the phone's frame moves toward the direction the accelerometer measures. The nudge is a step of size β
    along the gradient of the mismatch; β plays the role of 1 − α. This corrects roll and pitch, but not heading, because gravity carries no
    information about heading. For that the filter needs the magnetometer: here the heading is pulled toward the compass heading at a slow rate,
    which is a complementary filter on the heading alone.
  </p>
  <p class="self-only small secondary">
    Browsers do not give web pages the raw magnetometer readings, only the compass heading the phone computes from them. This page uses that
    heading as its magnetometer measurement, and also shows the phone's own fused orientation for comparison.
  </p>

  <div class="card">
    <LiveStart hint="Lay the phone flat, screen up, top edge pointing away from you, then start." />
    <div class="controls">
      <label class="control"><span>Madgwick gain β <b>{params.beta.toFixed(3)}</b></span><input type="range" min="-3" max="0" step="0.01" bind:value={logBeta} /></label>
      <label class="check"><input type="checkbox" bind:checked={params.useCompass} /> correct the heading with the compass</label>
      <label class="control"><span>Compass gain <b>{params.compassGain.toFixed(2)} /s</b></span><input type="range" min="0.05" max="3" step="0.05" bind:value={params.compassGain} disabled={!params.useCompass} /></label>
      <button onclick={resetOrientation} disabled={!live.running}>Reset all to the accelerometer</button>
    </div>
    <div class="phones">
      <Phone3D q={snap.gyro} label="Gyro only" testid="phone-gyro" />
      <Phone3D q={snap.mad} label="Accelerometer + gyro" testid="phone-mad" />
      <Phone3D q={snap.madc} label={params.useCompass ? '+ compass' : 'Accelerometer + gyro (no compass)'} testid="phone-madc" />
      <Phone3D q={snap.browser} label="Phone's own estimate" testid="phone-browser" />
    </div>
    <div class="tablewrap">
      <table class="small num">
        <thead><tr><th>Estimate</th><th>heading α</th><th>tilt β</th><th>tilt γ</th><th>difference from the phone's estimate</th></tr></thead>
        <tbody>
          {#each rows as r}
            <tr>
              <td>{r.name}</td>
              <td>{r.e ? `${r.e.alpha.toFixed(0)}°` : '–'}</td>
              <td>{r.e ? `${r.e.beta.toFixed(1)}°` : '–'}</td>
              <td>{r.e ? `${r.e.gamma.toFixed(1)}°` : '–'}</td>
              <td>{Number.isNaN(r.d) ? '–' : `${r.d.toFixed(1)}°`}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="small secondary">
      Turn and tilt the phone. All four follow fast motion. Over a minute or two the gyro-only estimate drifts in every direction, the accelerometer
      + gyro estimate keeps the right tilt but its heading wanders, and with the compass the heading stays put. Bring a magnet or a steel tool close
      to the phone to see the compass-corrected heading swing although the phone has not turned.
    </p>
  </div>

  <Predict question="Which of the four estimates can be fooled by holding a magnet next to the phone, and which can be fooled by shaking it?">
    <p>
      A magnet disturbs the estimates that use the compass: the compass-corrected Madgwick filter and the phone's own estimate. Shaking disturbs the
      ones that use the accelerometer, but only briefly if the gain is small. The gyro-only estimate is fooled by neither; it just drifts.
    </p>
  </Predict>
</Section>

<style>
  .eq { overflow-x: auto; }
  .check { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--text-secondary); }
  .phones { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.5rem; margin: 0.6rem 0; }
  .tablewrap { overflow-x: auto; }
  table { border-collapse: collapse; min-width: 560px; }
  th, td { padding: 0.2rem 0.9rem 0.2rem 0; text-align: left; }
  th { font-weight: 600; color: var(--text-secondary); }
</style>
