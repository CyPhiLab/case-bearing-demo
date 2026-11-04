<script lang="ts">
  import Section from '../../lib/ui/Section.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import LiveStart from '../ui/LiveStart.svelte';
  import LiveChart from '../ui/LiveChart.svelte';
  import TiltError from '../viz/TiltError.svelte';
  import { cur, live } from '../lib/live.svelte';
  import { DEG } from '../lib/fusion';
  import { app } from '../../lib/state.svelte';

  const tilt = $derived.by(() => {
    void live.tick;
    const [ax, ay, az] = cur.a;
    return { beta: Math.atan2(ay, Math.hypot(ax, az)) / DEG, gamma: Math.atan2(-ax, az) / DEG };
  });
</script>

<Section id="tilt" num={2} kicker="One sensor" title="Tilt from the accelerometer">
  <p class="self-only">
    When the phone is still, the only force the accelerometer feels is the reaction to gravity, which points straight up. How that vector divides
    among the phone's axes gives the tilt. For tilting the top edge up or down (rotation about the x axis) and tilting sideways (about y):
  </p>
  <div class="eq self-only"><Tex display math={'\\beta = \\operatorname{atan2}\\!\\left(a_y,\\ \\sqrt{a_x^2 + a_z^2}\\right), \\qquad \\gamma = \\operatorname{atan2}(-a_x,\\ a_z)'} /></div>
  <p class="self-only">
    The accelerometer cannot tell gravity from any other acceleration. When the phone accelerates sideways, the measured vector tips, and the
    computed tilt is wrong although the phone has not rotated. The accelerometer also gives no information about rotation about the vertical
    (heading): turning a phone that lies flat on a table leaves the gravity vector unchanged.
  </p>
  <TiltError />

  <h3>Live: tilt from your phone's accelerometer</h3>
  <div class="card">
    <LiveStart />
    <div class="layout">
      <svg viewBox="-50 -50 100 100" class="level" role="img" aria-label="Bubble level">
        <circle r="46" class="ring" />
        <circle r="23" class="ring" />
        <line x1="-46" x2="46" y1="0" y2="0" class="ring" />
        <line y1="-46" y2="46" x1="0" x2="0" class="ring" />
        <circle cx={Math.max(-40, Math.min(40, -tilt.gamma))} cy={Math.max(-40, Math.min(40, -tilt.beta))} r="8" class="bubble" />
      </svg>
      <div class="right">
        <div class="stats">
          <div class="stat"><span class="value num" data-testid="tilt-beta">{tilt.beta.toFixed(1)}°</span><span class="label">β, tilt about x (top edge up/down)</span></div>
          <div class="stat"><span class="value num">{tilt.gamma.toFixed(1)}°</span><span class="label">γ, tilt about y (sideways)</span></div>
        </div>
        <LiveChart traces={[{ key: 'accTilt', color: 'var(--text-secondary)', width: 1.4 }]} yDomain={[-100, 100]} yLabel="tilt about x (°)" seconds={15} height={app.mode === 'lecture' ? 200 : 160} ariaLabel="Live accelerometer tilt" />
      </div>
    </div>
    <p class="small secondary">Hold the phone at an angle, then move it quickly back and forth without rotating it: the tilt jumps although the angle has not changed.</p>
  </div>

  <Predict question="You lay the phone flat on a table and slowly turn it to face a different direction. What happens to the accelerometer's tilt readings?">
    <p>Nothing. Gravity stays along the phone's z axis, so β and γ stay near zero. The accelerometer cannot measure heading; that needs the magnetometer.</p>
  </Predict>
</Section>

<style>
  .eq { overflow-x: auto; }
  .layout { display: grid; grid-template-columns: 140px minmax(0, 1fr); gap: 1rem; align-items: center; }
  .level { width: 140px; height: 140px; }
  .ring { fill: none; stroke: var(--axis); stroke-width: 1; }
  .bubble { fill: var(--cls-3); opacity: 0.85; }
  .stats { display: flex; flex-wrap: wrap; gap: 0.5rem 2rem; }
  @media (max-width: 640px) { .layout { grid-template-columns: minmax(0, 1fr); } .level { margin: 0 auto; display: block; } }
</style>
