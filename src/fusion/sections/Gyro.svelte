<script lang="ts">
  import Section from '../../lib/ui/Section.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import LiveStart from '../ui/LiveStart.svelte';
  import LiveChart from '../ui/LiveChart.svelte';
  import GyroDrift from '../viz/GyroDrift.svelte';
  import { buf, live, resetTilt } from '../lib/live.svelte';
  import { app } from '../../lib/state.svelte';

  const gap = $derived.by(() => {
    void live.tick;
    const n = buf.t.length;
    return n ? buf.gyroTilt[n - 1] - buf.accTilt[n - 1] : NaN;
  });
</script>

<Section id="gyro" num={3} kicker="One sensor" title="Angle from the gyroscope">
  <p class="self-only">
    The gyroscope measures the rate of rotation ω. The angle is found by adding up the small rotations in each time step, a numerical integral:
  </p>
  <div class="eq self-only"><Tex display math={'\\theta_k = \\theta_{k-1} + \\omega_k\\,\\delta t \\quad\\approx\\quad \\theta(t) = \\theta_0 + \\int_0^t \\omega\\,dt'} /></div>
  <p class="self-only">
    Because it measures rotation directly, the gyroscope is not fooled by linear acceleration or vibration, and its angle is smooth. But
    integration adds up errors too. A small constant offset in the rate (the <b>bias</b>) turns into an angle error that grows steadily with time,
    and noise turns into an error that wanders like a random walk. The starting angle θ₀ must also come from somewhere else.
  </p>
  <GyroDrift />

  <h3>Live: integrated gyro vs accelerometer tilt</h3>
  <div class="card">
    <LiveStart />
    <div class="controls" style="margin-bottom: 0.4rem">
      <button onclick={resetTilt} disabled={!live.running}>Reset the gyro angle to the accelerometer</button>
      <span class="small secondary">difference now: <b class="num">{Number.isNaN(gap) ? '–' : `${gap.toFixed(1)}°`}</b></span>
    </div>
    <LiveChart
      traces={[
        { key: 'accTilt', color: 'var(--axis)', width: 1.2, label: 'accelerometer tilt' },
        { key: 'gyroTilt', color: 'var(--cls-2)', width: 2, label: 'integrated gyro' },
      ]}
      yDomain={[-100, 100]}
      yLabel="tilt about x (°)"
      height={app.mode === 'lecture' ? 260 : 220}
      ariaLabel="Live integrated gyro angle"
    />
    <p class="small secondary">
      Tilt the phone forward and back and shake it. The gyro angle stays smooth while the accelerometer angle jumps. Then leave the phone still for a minute and
      watch the two separate. Phones calibrate their gyroscopes continuously, so the drift is smaller than in the simulation above, but
      integrating unevenly timed, rounded readings still makes it creep. The one-angle filters assume rotation about the x axis only: tilt the top edge up and down and keep the sides level.
    </p>
  </div>

  <Predict question="With the noise set to zero, the bias doubled from 0.5 to 1 °/s, and the recording twice as long (120 s), how much larger is the final angle error?">
    <p>Four times: the error from a bias is b·t, and both b and t have doubled (0.5 × 60 = 30° becomes 1 × 120 = 120°).</p>
  </Predict>
</Section>

<style>
  .eq { overflow-x: auto; }
</style>
