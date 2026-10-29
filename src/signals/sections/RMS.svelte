<script lang="ts">
  import Section from '../../lib/ui/Section.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import Ref from '../../lib/ui/Ref.svelte';
  import Quiz from '../../lib/ui/Quiz.svelte';
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { gaussian, linspace, mean, rms, std } from '../../lib/dsp/signals';
  import { app } from '../../lib/state.svelte';

  let dc = $state(1.5);
  let amp = $state(1);
  let f = $state(1);
  let N = $state(16);
  let noiseOn = $state(false);
  let removeDC = $state(false);
  let wave = $state<'sine' | 'square' | 'spiky'>('sine');

  const T = 2; // record length t2 - t1
  const dense = linspace(2000, T / 2000);
  const shape = (tt: number) => {
    const p = 2 * Math.PI * f * tt;
    if (wave === 'square') return Math.sign(Math.sin(p)) || 1;
    if (wave === 'spiky') return Math.sin(p) ** 15; // impulsive: same peak as the sine, much lower RMS
    return Math.sin(p);
  };
  const nz = gaussian(2000, 0.25, 11);
  const yDense = $derived(dense.map((tt, i) => dc + amp * shape(tt) + (noiseOn ? nz[i] : 0) - (removeDC ? dc : 0)));
  const step = $derived(Math.floor(2000 / N));
  const samples = $derived(Array.from({ length: N }, (_, i) => yDense[i * step]));
  const sampleT = $derived(Array.from({ length: N }, (_, i) => dense[i * step]));

  const m = $derived(mean(samples));
  const r = $derived(rms(samples));
  const s = $derived(std(samples));
  const mTrue = $derived(mean(yDense));
  const rTrue = $derived(rms(yDense));
</script>

<Section id="rms" num={4} kicker="Signal statistics" title="Mean and RMS values">
  <p class="self-only">
    The <b>mean</b> (average, or DC offset) describes the static part of a signal. It says nothing about how much the signal
    <i>varies</i>. A sine averages to zero over a full period, yet it carries energy. For the dynamic (AC) content we use the
    <b>root-mean-square</b>, which comes straight from power: a current I(t) dissipates the same energy in a resistor as a constant
    current I<sub>rms</sub>. <Ref sec="2.3" />
  </p>

  <div class="eqs">
    <div class="eq"><Tex display math={'\\bar y = \\frac{1}{t_2-t_1}\\int_{t_1}^{t_2} y\\,dt \\;\\approx\\; \\frac{1}{N}\\sum_{i=0}^{N-1} y_i'} /> <Ref eq="2.1, 2.5" /></div>
    <div class="eq"><Tex display math={'y_{\\text{rms}} = \\sqrt{\\frac{1}{t_2-t_1}\\int_{t_1}^{t_2} y^2\\,dt} \\;\\approx\\; \\sqrt{\\frac{1}{N}\\sum_{i=0}^{N-1} y_i^2}'} /> <Ref eq="2.4, 2.6" /></div>
    <div class="eq"><Tex display math={'P = I^2R \\;\\Rightarrow\\; \\bar P = I_{\\text{rms}}^2 R'} /></div>
  </div>

  <div class="card">
    <div class="controls">
      <div class="control">
        Waveform
        <div class="seg">
          {#each [['sine', 'Sine'], ['square', 'Square'], ['spiky', 'Impulsive']] as [k, l]}
            <button aria-pressed={wave === k} onclick={() => (wave = k as typeof wave)}>{l}</button>
          {/each}
        </div>
      </div>
      <label class="control"><span>DC offset A₀ <b>{dc.toFixed(2)} V</b></span><input type="range" min="-1.5" max="2.5" step="0.05" bind:value={dc} /></label>
      <label class="control"><span>AC amplitude C <b>{amp.toFixed(2)} V</b></span><input type="range" min="0" max="1.5" step="0.05" bind:value={amp} /></label>
      <label class="control"><span>Frequency <b>{f.toFixed(2)} Hz</b></span><input type="range" min="0.25" max="3" step="0.05" bind:value={f} /></label>
      <label class="control"><span>Samples N <b>{N}</b> (δt = {(T / N).toFixed(3)} s)</span><input type="range" min="4" max="200" step="1" bind:value={N} /></label>
      <label class="check"><input type="checkbox" bind:checked={noiseOn} /> add noise</label>
      <label class="check"><input type="checkbox" bind:checked={removeDC} /> subtract the DC offset</label>
    </div>
    <div class="cols">
      <LineChart
        series={[{ y: yDense, dx: T / 2000, color: 'var(--axis)', width: 1.5, label: 'y(t)' }]}
                xDomain={[0, T]}
        yDomain={[-3.5, 4.5]}
        height={app.mode === 'lecture' ? 300 : 250}
        xLabel="t (s)"
        yLabel="y (V)"
        ariaLabel="Signal with mean and RMS levels"
      >
        {#snippet overlay({ x, y })}
          {#each samples as v, i}
            <line x1={x(sampleT[i])} x2={x(sampleT[i])} y1={y(0)} y2={y(v)} class="stem" />
            <circle cx={x(sampleT[i])} cy={y(v)} r="3" class="dot" />
          {/each}
          <line x1={x(0)} x2={x(T)} y1={y(m)} y2={y(m)} class="lvl mean" />
          <text x={x(T) - 4} y={y(m) - 4} text-anchor="end" class="lbl mean">mean ȳ</text>
          <line x1={x(0)} x2={x(T)} y1={y(r)} y2={y(r)} class="lvl rms" />
          <text x={x(T) - 4} y={y(r) - 4} text-anchor="end" class="lbl rms">y_rms</text>
        {/snippet}
      </LineChart>
      <div class="stats">
        <div class="stat"><span class="value num mean">{m.toFixed(3)}</span><span class="label">mean ȳ from N samples (exact: {mTrue.toFixed(3)})</span></div>
        <div class="stat"><span class="value num rms">{r.toFixed(3)}</span><span class="label">y_rms from N samples (exact: {rTrue.toFixed(3)})</span></div>
        <div class="stat"><span class="value num">{s.toFixed(3)}</span><span class="label">AC part: RMS after removing the mean (σ)</span></div>
        <div class="identity num">
          <Tex math={`y_{\\text{rms}}^2 = \\bar y^2 + \\sigma^2:\\; ${(r * r).toFixed(3)} = ${(m * m).toFixed(3)} + ${(s * s).toFixed(3)}`} />
        </div>
        <p class="small secondary">Power in a 1 Ω resistor: <b class="num">{(r * r).toFixed(3)} W</b>, of which the DC part is <span class="num">{(m * m).toFixed(3)} W</span>.</p>
      </div>
    </div>
  </div>

  <p class="self-only small secondary">
    Set the DC offset to 0. The mean goes to ≈0, but the RMS stays at C/√2 ≈ {(amp / Math.SQRT2).toFixed(3)} for a sine. With the "Impulsive" waveform at the same amplitude, the RMS is much lower although the peaks are equally high. For this reason
    vibration analysts also track the <i>crest factor</i>, peak ÷ RMS. With few samples (small N), both estimates vary: this is the error of the
    discrete approximation.
  </p>

  <Quiz
    question="Book Example 2.1: a current I(t) = 10 sin t is averaged over 0 to 2π. What are its mean and its RMS?"
    options={['0 A and 0 A', '0 A and √50 ≈ 7.07 A', '20/π A and √50 A', '10 A and 10 A']}
    answer={1}
    explain="The positive and negative halves cancel in the mean, but squaring makes both halves count: I_rms = 10/√2 = √50 A over 0–π or 0–2π alike. The resistor dissipates the same energy in both half-cycles."
  />
</Section>

<style>
  .eqs { display: flex; flex-wrap: wrap; gap: 0 2rem; margin-bottom: 0.6rem; }
  .eq { display: flex; align-items: center; gap: 0.4rem; overflow-x: auto; max-width: 100%; }
  .seg { display: flex; }
  .seg button { border-radius: 0; margin-left: -1px; font-size: 0.82rem; }
  .seg button:first-child { border-radius: 8px 0 0 8px; margin-left: 0; }
  .seg button:last-child { border-radius: 0 8px 8px 0; }
  .check { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--text-secondary); }
  .cols { display: grid; grid-template-columns: 1fr minmax(220px, 300px); gap: 1rem; margin-top: 0.6rem; align-items: start; }
  .cols > * { min-width: 0; }
  .stats { display: grid; gap: 0.6rem; }
  .stem { stroke: var(--accent); stroke-width: 1; opacity: 0.5; }
  .dot { fill: var(--accent); }
  .lvl { stroke-width: 2; stroke-dasharray: 6 4; }
  .lvl.mean, .value.mean { stroke: var(--cls-2); color: var(--cls-2); }
  .lvl.rms, .value.rms { stroke: var(--focus); color: var(--focus); }
  .lbl { font-size: var(--chart-font); font-weight: 700; paint-order: stroke; stroke: var(--surface-1); stroke-width: 3px; }
  .lbl.mean { fill: var(--cls-2); }
  .lbl.rms { fill: var(--focus); }
  .identity { font-size: 0.9rem; overflow-x: auto; }
  @media (max-width: 800px) { .cols { grid-template-columns: 1fr; } }
</style>
