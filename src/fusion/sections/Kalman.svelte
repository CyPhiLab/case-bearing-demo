<script lang="ts">
  import Section from '../../lib/ui/Section.svelte';
  import Predict from '../../lib/ui/Predict.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import LiveStart from '../ui/LiveStart.svelte';
  import LiveChart from '../ui/LiveChart.svelte';
  import KalmanSim from '../viz/KalmanSim.svelte';
  import { buf, cur, live, params, resetTilt } from '../lib/live.svelte';
  import { app } from '../../lib/state.svelte';

  let logR = $state(Math.log10(params.r));
  let logQb = $state(Math.log10(params.qBias));
  $effect(() => {
    params.r = 10 ** logR;
    params.qBias = 10 ** logQb;
  });
  const bias = $derived.by(() => {
    void live.tick;
    const n = buf.kalBias.length;
    return n ? buf.kalBias[n - 1] : NaN;
  });
  const gain = $derived.by(() => {
    void live.tick;
    return cur.kalGain;
  });
</script>

<Section id="kalman" num={5} kicker="Two sensors" title="The Kalman filter">
  <p class="self-only">
    The complementary filter uses a fixed weight α chosen by hand. A <b>Kalman filter</b> chooses the weight from the uncertainties. The idea
    starts with a simple fact: two independent estimates x₁ and x₂ of the same quantity, with variances σ₁² and σ₂², are best combined by weighting
    each with the inverse of its variance,
  </p>
  <div class="eq self-only"><Tex display math={'\\hat x = \\frac{\\sigma_2^2\\,x_1 + \\sigma_1^2\\,x_2}{\\sigma_1^2 + \\sigma_2^2} = x_1 + K\\,(x_2 - x_1), \\qquad K = \\frac{\\sigma_1^2}{\\sigma_1^2 + \\sigma_2^2}'} /></div>
  <p class="self-only">
    The Kalman filter applies this at every time step. It keeps an estimate of the state and its variance P. In the <b>predict</b> step it moves
    the angle by the gyro rate; the uncertainty grows by the process noise Q, because the gyro is imperfect. In the <b>update</b> step it compares
    the prediction with the accelerometer angle, whose variance is R, and corrects by the gain K = P/(P + R). When the prediction is uncertain the
    accelerometer gets more weight, and vice versa.
  </p>
  <p class="self-only">
    The filter used here also puts the gyro bias b into the state. Since a constant bias makes the predicted angle drift steadily away from the
    accelerometer, the filter can tell the bias apart from noise and learns its value:
  </p>
  <div class="eq self-only"><Tex display math={'\\text{predict: } \\theta_k^- = \\theta_{k-1} + (\\omega_k - b_{k-1})\\,\\delta t, \\quad P^- = F P F^{\\mathsf T} + Q \\qquad \\text{update: } K = \\frac{P^- H^{\\mathsf T}}{H P^- H^{\\mathsf T} + R}, \\quad \\begin{bmatrix}\\theta\\\\ b\\end{bmatrix}_k = \\begin{bmatrix}\\theta^-\\\\ b_{k-1}\\end{bmatrix} + K\\,(\\theta_{acc,k} - \\theta_k^-)'} /></div>
  <p class="self-only">
    with F = [[1, −δt], [0, 1]] and H = [1, 0]. The gain falls quickly from its initial value and settles at a steady level set by the ratio of Q to
    R. R and Q are the tuning knobs: they describe how much the filter trusts each sensor. Below, the true accelerometer noise and the variance the
    filter assumes can be set separately, which shows what happens when the assumption is wrong.
  </p>
  <KalmanSim />

  <h3>Live: Kalman filter on your phone</h3>
  <div class="card">
    <LiveStart />
    <div class="controls" style="margin-bottom: 0.4rem">
      <label class="control"><span>Measurement variance R <b>{params.r < 1 ? params.r.toFixed(2) : params.r.toFixed(0)} deg²</b></span><input type="range" min="-1" max="3" step="0.01" bind:value={logR} /></label>
      <label class="control"><span>Bias process noise Q_b <b>{params.qBias.toExponential(0)}</b></span><input type="range" min="-6" max="0" step="0.01" bind:value={logQb} /></label>
      <button onclick={resetTilt} disabled={!live.running}>Reset</button>
    </div>
    <LiveChart
      traces={[
        { key: 'accTilt', color: 'var(--axis)', width: 1.2, label: 'accelerometer' },
        { key: 'comp', color: 'var(--cls-3)', width: 1.6, label: 'complementary' },
        { key: 'kal', color: 'var(--accent)', width: 2.4, label: 'Kalman' },
      ]}
      yDomain={[-100, 100]}
      yLabel="tilt about x (°)"
      height={app.mode === 'lecture' ? 260 : 220}
      ariaLabel="Live Kalman filter"
    />
    <LiveChart traces={[{ key: 'kalBias', color: 'var(--cls-2)', width: 2, label: 'estimated gyro bias' }]} yDomain={[-3, 3]} yLabel="bias (°/s)" height={app.mode === 'lecture' ? 180 : 150} ariaLabel="Live gyro bias estimate" />
    <p class="small secondary">
      Estimated gyro bias <b class="num">{Number.isNaN(bias) ? '–' : `${bias.toFixed(2)} °/s`}</b>, current gain <b class="num">{gain.toFixed(4)}</b>. A phone's
      calibrated gyroscope has a bias close to zero, so the estimate should settle near zero when the phone is held still. The one-angle filters assume rotation about the x axis only: tilt the top edge up and down and keep the sides level.
    </p>
  </div>

  <Predict question="In the simulation, set the filter's R far below the true noise (the filter trusts the accelerometer too much). What happens during the shaking?">
    <p>
      The gain becomes large, so the estimate follows the accelerometer closely and the shaking passes straight through. With R much larger than the
      true noise, the estimate is smooth but slow to correct drift. A well-tuned Kalman filter matches R to the real noise.
    </p>
  </Predict>
</Section>

<style>
  .eq { overflow-x: auto; }
</style>
