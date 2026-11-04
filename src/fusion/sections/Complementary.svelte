<script lang="ts">
  import Section from '../../lib/ui/Section.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import LiveStart from '../ui/LiveStart.svelte';
  import LiveChart from '../ui/LiveChart.svelte';
  import CompResponse from '../viz/CompResponse.svelte';
  import ComplementaryFilter from '../viz/ComplementaryFilter.svelte';
  import { live, params, resetTilt } from '../lib/live.svelte';
  import { complementaryCrossover } from '../lib/fusion';
  import { app } from '../../lib/state.svelte';
</script>

<Section id="complementary" num={4} kicker="Two sensors" title="The complementary filter">
  <p class="self-only">
    The accelerometer angle is right on average but noisy and disturbed by motion. The gyro angle is smooth but wanders off over time. The
    <b>complementary filter</b> combines them in one line. At each step it moves the previous estimate by the gyro rate, then pulls the result a
    little toward the accelerometer angle:
  </p>
  <div class="eq self-only"><Tex display math={'\\hat\\theta_k = \\alpha\\,\\bigl(\\hat\\theta_{k-1} + \\omega_k\\,\\delta t\\bigr) + (1-\\alpha)\\,\\theta_{acc,k}'} /></div>
  <p class="self-only">
    With α close to 1 (typically 0.95–0.99), each accelerometer reading has only a small influence, so its noise is averaged out, while any slow
    drift of the gyro angle is steadily pulled back. In terms of the filters of the Signals lecture, the accelerometer angle passes through a
    first-order low-pass filter and the gyro angle through a high-pass filter with the same crossover frequency. Their gains add up to one, so the
    true angle passes through unchanged: hence "complementary".
  </p>
  <CompResponse />
  <p class="self-only">
    Below the crossover frequency the estimate follows the accelerometer, above it the gyro. Slow drift lives at very low frequencies, so it is
    removed; vibration and sudden accelerations are fast, so they are ignored. In the simulation below, try α close to 1 (the gyro drift leaks
    in) and α near 0.8 (the accelerometer noise and the shaking leak in).
  </p>
  <ComplementaryFilter />

  <h3>Live: complementary filter on your phone</h3>
  <div class="card">
    <LiveStart />
    <div class="controls" style="margin-bottom: 0.4rem">
      <label class="control"><span>Filter weight α <b>{params.alpha.toFixed(3)}</b> (crossover {complementaryCrossover(params.alpha, 1 / Math.max(20, live.fs || 100)).toFixed(2)} Hz)</span><input type="range" min="0.8" max="0.999" step="0.001" bind:value={params.alpha} /></label>
      <button onclick={resetTilt} disabled={!live.running}>Reset</button>
    </div>
    <LiveChart
      traces={[
        { key: 'accTilt', color: 'var(--axis)', width: 1.2, label: 'accelerometer' },
        { key: 'gyroTilt', color: 'var(--cls-2)', width: 1.6, label: 'integrated gyro' },
        { key: 'comp', color: 'var(--accent)', width: 2.4, label: 'complementary filter' },
      ]}
      yDomain={[-100, 100]}
      yLabel="tilt about x (°)"
      height={app.mode === 'lecture' ? 280 : 240}
      ariaLabel="Live complementary filter"
    />
    <p class="small secondary">Shake the phone while holding it at an angle: the blue estimate stays steady. Leave it still: it stays with the accelerometer while the gyro angle drifts away. The one-angle filters assume rotation about the x axis only: tilt the top edge up and down and keep the sides level.</p>
  </div>

  <Predict question="At 100 Hz sampling, what α gives a crossover of about 0.5 Hz (a time constant of about 0.3 s)?">
    <p>
      About 0.97. From f<sub>c</sub> = (1 − α)/(2π α δt) with δt = 0.01 s: 1 − α ≈ 2π · 0.5 · 0.01 ≈ 0.031. Check it on the frequency-response figure.
    </p>
  </Predict>
</Section>

<style>
  .eq { overflow-x: auto; }
</style>
