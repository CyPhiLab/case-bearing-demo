<script lang="ts">
  import Section from '../../lib/ui/Section.svelte';
  import LiveStart from '../ui/LiveStart.svelte';
  import LiveChart from '../ui/LiveChart.svelte';
  import { live } from '../lib/live.svelte';
  import { app } from '../../lib/state.svelte';
  const h = $derived(app.mode === 'lecture' ? 200 : 160);
</script>

<Section id="sensors" num={1} kicker="Background" title="The sensors in a phone">
  <p class="self-only">
    A phone contains an inertial measurement unit (IMU) with three sensors, each measuring along three perpendicular axes fixed to the phone: x to
    the right, y toward the top of the screen, and z out of the screen.
  </p>
  <dl class="defs self-only">
    <dt>Accelerometer</dt>
    <dd>
      A proof mass on silicon springs. It measures the force needed to accelerate the phone, which includes the reaction to gravity: lying flat
      and still, it reads about 9.81 m/s² along z. From the direction of gravity it gives tilt, but any extra acceleration of the phone corrupts it.
    </dd>
    <dt>Gyroscope</dt>
    <dd>
      A vibrating proof mass that responds to rotation through the Coriolis force. It measures angular velocity in degrees per second. It is
      accurate over short times and unaffected by acceleration, but it gives only rates; angles must be found by integration, which drifts.
    </dd>
    <dt>Magnetometer</dt>
    <dd>
      Measures the magnetic field. The Earth's field gives the direction of magnetic north, so it fixes the heading, which neither of the other two
      can. Magnets, steel and electric currents nearby disturb it.
    </dd>
  </dl>
  <div class="tablewrap self-only">
    <table class="small">
      <thead><tr><th></th><th>Accelerometer</th><th>Gyroscope</th><th>Magnetometer</th></tr></thead>
      <tbody>
        <tr><td>Gives</td><td>tilt (roll and pitch)</td><td>change in orientation</td><td>heading</td></tr>
        <tr><td>Good at</td><td>long-term, absolute</td><td>short-term, smooth, fast</td><td>long-term, absolute</td></tr>
        <tr><td>Fails with</td><td>motion and vibration</td><td>drift over time</td><td>nearby magnets and steel</td></tr>
      </tbody>
    </table>
  </div>
  <p class="self-only">
    The strengths and weaknesses are complementary. Fusion uses the gyroscope for what happens quickly and the accelerometer and magnetometer to
    correct the slow drift.
  </p>

  <div class="card">
    <LiveStart />
    <div class="grid-3">
      <div>
        <b class="small">Accelerometer (m/s²)</b>
        <LiveChart
          traces={[
            { key: 'ax', color: 'var(--cls-2)', label: 'x' },
            { key: 'ay', color: 'var(--cls-3)', label: 'y' },
            { key: 'az', color: 'var(--accent)', label: 'z' },
          ]}
          yDomain={[-20, 20]}
          yLabel="m/s²"
          seconds={10}
          height={h}
          ariaLabel="Live accelerometer"
        />
      </div>
      <div>
        <b class="small">Gyroscope (°/s)</b>
        <LiveChart
          traces={[
            { key: 'gx', color: 'var(--cls-2)', label: 'x' },
            { key: 'gy', color: 'var(--cls-3)', label: 'y' },
            { key: 'gz', color: 'var(--accent)', label: 'z' },
          ]}
          yDomain={[-300, 300]}
          yLabel="°/s"
          seconds={10}
          height={h}
          ariaLabel="Live gyroscope"
        />
      </div>
      <div>
        <b class="small">Compass heading (°)</b>
        <LiveChart traces={[{ key: 'heading', color: 'var(--focus)', width: 2 }]} yDomain={[0, 360]} yLabel="° from north" seconds={10} height={h} ariaLabel="Live compass heading" />
      </div>
    </div>
    <p class="small secondary">
      Lying still, the accelerometer reads about 9.8 m/s² on z and the gyroscope reads close to zero. Turn the phone and watch the gyroscope; tilt
      it and the gravity reading moves between the axes.
      {#if live.running && !live.hasHeading}This browser does not report a compass heading.{/if}
      {#if live.axesDecided && live.axes === 'legacy'}This browser reports the rotation rates in an older axis order (beta, gamma, alpha for x, y, z); the page detected this from your tilting and corrected it.{/if}
      {#if live.flipped}This browser reports accelerations with the opposite sign to the specification, so the page has flipped them.{/if}
    </p>
  </div>
</Section>

<style>
  .tablewrap { overflow-x: auto; margin: 0.5rem 0 1rem; }
  table { border-collapse: collapse; min-width: 480px; }
  th, td { padding: 0.3rem 0.8rem 0.3rem 0; text-align: left; border-bottom: 1px solid var(--grid); }
  th { font-weight: 600; }
  td:first-child { font-weight: 600; color: var(--text-secondary); }
</style>
