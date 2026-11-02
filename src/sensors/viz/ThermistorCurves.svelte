<script lang="ts">
  // Sensitivity vs range: an NTC thermistor changes its resistance by ~4 %/°C, a platinum RTD by ~0.4 %/°C.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { pt100, thermistorBeta, typeK } from '../lib/physics';
  import { app } from '../../lib/state.svelte';

  let T = $state(25);
  const Ts = Array.from({ length: 400 }, (_, i) => -50 + (i / 399) * 350);
  const ntcT = Ts.filter((t) => t >= -40 && t <= 150);
  const ntcRel = ntcT.map((t) => thermistorBeta(t) / thermistorBeta(25));
  const rtdRel = Ts.map((t) => pt100(t) / pt100(25));
  const sNtc = ntcT.map((t) => (3950 / (t + 273.15) ** 2) * 100);
  const sRtd = Ts.map((t) => ((pt100(t + 0.5) - pt100(t - 0.5)) / pt100(t)) * 100);
  const here = $derived({
    ntc: thermistorBeta(T),
    dntc: (thermistorBeta(T + 0.5) - thermistorBeta(T - 0.5)),
    rtd: pt100(T),
    drtd: pt100(T + 0.5) - pt100(T - 0.5),
    tc: (typeK(T + 0.5) - typeK(T - 0.5)) * 1000,
  });
</script>

<div class="card">
  <div class="controls">
    <label class="control"><span>Temperature <b>{T} °C</b></span><input type="range" min="-40" max="150" step="1" bind:value={T} /></label>
  </div>
  <div class="grid-2">
    <LineChart
      series={[
        { x: ntcT, y: ntcRel, color: 'var(--cls-2)', width: 2.2, label: '10 kΩ NTC thermistor' },
        { x: Ts, y: rtdRel, color: 'var(--accent)', width: 2.2, label: 'Pt100 RTD' },
      ]}
      logY
      xDomain={[-50, 300]}
      yDomain={[0.01, 100]}
      height={app.mode === 'lecture' ? 230 : 200}
      xLabel="temperature (°C)"
      yLabel="R / R(25 °C)"
      legend
      markers={[{ x: T, color: 'var(--text-muted)', dash: true }]}
      ariaLabel="Relative resistance vs temperature"
    />
    <LineChart
      series={[
        { x: ntcT, y: sNtc, color: 'var(--cls-2)', width: 2.2, label: 'NTC' },
        { x: Ts, y: sRtd, color: 'var(--accent)', width: 2.2, label: 'Pt100' },
      ]}
      xDomain={[-50, 300]}
      yDomain={[0, 7]}
      height={app.mode === 'lecture' ? 230 : 200}
      xLabel="temperature (°C)"
      yLabel="|dR/dT| / R (% per °C)"
      legend
      markers={[{ x: T, color: 'var(--text-muted)', dash: true }]}
      ariaLabel="Relative sensitivity"
    />
  </div>
  <table class="small num">
    <thead><tr><th>At {T} °C</th><th>value</th><th>change per °C</th></tr></thead>
    <tbody>
      <tr><td>10 kΩ NTC</td><td>{(here.ntc / 1000).toFixed(2)} kΩ</td><td>{here.dntc.toFixed(0)} Ω ({((here.dntc / here.ntc) * 100).toFixed(2)} %)</td></tr>
      <tr><td>Pt100 RTD</td><td>{here.rtd.toFixed(2)} Ω</td><td>+{here.drtd.toFixed(3)} Ω ({((here.drtd / here.rtd) * 100).toFixed(2)} %)</td></tr>
      <tr><td>Type K thermocouple</td><td>–</td><td>+{here.tc.toFixed(1)} µV</td></tr>
    </tbody>
  </table>
</div>

<style>
  table { border-collapse: collapse; margin-top: 0.6rem; }
  th, td { padding: 0.15rem 1rem 0.15rem 0; text-align: left; }
  th { font-weight: 600; color: var(--text-secondary); }
</style>
