<script lang="ts">
  import Section from '../../lib/ui/Section.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import LiveStart from '../ui/LiveStart.svelte';
  import LiveChart from '../ui/LiveChart.svelte';
  import DeadReckoningSim from '../viz/DeadReckoning.svelte';
  import { buf, live, resetDeadReckoning } from '../lib/live.svelte';
  import { app } from '../../lib/state.svelte';

  const now = $derived.by(() => {
    void live.tick;
    const n = buf.pos.length;
    return n ? { pos: buf.pos[n - 1], vel: buf.vel[n - 1] } : null;
  });
</script>

<Section id="dead-reckoning" num={7} kicker="The limit" title="Dead reckoning">
  <p class="self-only">
    Since orientation can be tracked, it is tempting to go one step further: subtract gravity from the accelerometer, integrate once to get velocity
    and again to get position. This is <b>dead reckoning</b>. Errors grow much faster than in the gyro angle, because they are integrated twice. A
    constant accelerometer bias b gives a velocity error b·t and a position error
  </p>
  <div class="eq self-only"><Tex display math={'e_x(t) = \\tfrac{1}{2}\\, b\\, t^2'} /></div>
  <p class="self-only">
    A small tilt error has the same effect, since it leaves part of gravity in the "horizontal" acceleration: 0.1° of tilt error leaves
    g·sin 0.1° ≈ 0.017 m/s². Inertial navigation therefore relies on regular corrections from another sensor: GPS, wheel speed, cameras, or the
    fact that a foot is briefly at rest at each step.
  </p>
  <DeadReckoningSim />

  <h3>Live: position from your phone's accelerometer</h3>
  <div class="card">
    <LiveStart hint="Lay the phone flat on a table, then start." />
    <div class="controls" style="margin-bottom: 0.4rem">
      <button onclick={resetDeadReckoning} disabled={!live.running}>Reset position to zero</button>
      <span class="small secondary">
        {#if now}position <b class="num" data-testid="dr-pos">{(now.pos * 100).toFixed(0)} cm</b>, velocity <b class="num">{(now.vel * 100).toFixed(1)} cm/s</b>{/if}
        {#if live.running && !live.hasLinear}This browser does not report acceleration without gravity.{/if}
      </span>
    </div>
    <LiveChart traces={[{ key: 'pos', color: 'var(--accent)', width: 2, label: 'position along x (double integral)' }]} yDomain={[-2, 2]} yLabel="position (m)" height={app.mode === 'lecture' ? 240 : 200} ariaLabel="Live dead-reckoning position" />
    <LiveChart traces={[{ key: 'vel', color: 'var(--cls-2)', width: 1.6, label: 'velocity along x' }]} yDomain={[-1, 1]} yLabel="velocity (m/s)" height={app.mode === 'lecture' ? 180 : 150} ariaLabel="Live dead-reckoning velocity" />
    <p class="small secondary">
      Reset, then slide the phone 30 cm to the right along the table and back. The position follows roughly at first, but even with the phone at
      rest the estimate keeps moving, and within seconds it is off by more than the distance moved. This uses the phone's "acceleration without
      gravity", which the phone computes with its own fusion filter.
    </p>
  </div>

  <Predict question="A drone's accelerometer has a 1 mg bias. Using dead reckoning alone, how far off is its position after one minute?">
    <p>About 18 m: ½ × (0.001 × 9.81 m/s²) × (60 s)² ≈ 17.7 m. After ten minutes it would be about 1.8 km.</p>
  </Predict>
</Section>

<style>
  .eq { overflow-x: auto; }
</style>
