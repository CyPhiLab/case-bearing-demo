<script lang="ts">
  import Section from '../../lib/ui/Section.svelte';
  import Tex from '../../lib/ui/Tex.svelte';
  import Ref from '../../lib/ui/Ref.svelte';
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { gaussian, linspace } from '../../lib/dsp/signals';
  import { ema } from '../../lib/dsp/filters';
  import { app } from '../../lib/state.svelte';

  type Kind = 'static' | 'simple' | 'complex' | 'step' | 'ramp' | 'pulse' | 'random';
  const KINDS: { k: Kind; group: string; name: string; tex: string }[] = [
    { k: 'static', group: 'Static', name: 'Static', tex: 'y(t) = A_0' },
    { k: 'simple', group: 'Dynamic · periodic', name: 'Simple periodic', tex: 'y(t) = A_0 + C\\sin(\\omega t + \\phi)' },
    { k: 'complex', group: 'Dynamic · periodic', name: 'Complex periodic', tex: 'y(t) = A_0 + \\sum_{n=1}^{\\infty} C_n \\sin(n\\omega t + \\phi_n)' },
    { k: 'step', group: 'Dynamic · aperiodic', name: 'Step', tex: 'y(t) = A_0\\,U(t)' },
    { k: 'ramp', group: 'Dynamic · aperiodic', name: 'Ramp', tex: 'y(t) = A_0\\,t \\quad 0 < t < t_f' },
    { k: 'pulse', group: 'Dynamic · aperiodic', name: 'Pulse', tex: 'y(t) = A_0 U(t) - A_0 U(t - t_1)' },
    { k: 'random', group: 'Nondeterministic', name: 'Nondeterministic', tex: 'y(t) \\approx A_0 + \\sum_{n=1}^{\\infty} C_n \\sin(n\\omega t + \\phi_n)' },
  ];
  let kind = $state<Kind>('complex');
  let A0 = $state(1);
  let C = $state(1);
  let f = $state(1);
  let phi = $state(0);
  let harmonics = $state(3);
  let t1 = $state(1);
  let seed = $state(1);

  const fs = 400;
  const t = linspace(1400, 1 / fs, -0.5);
  const U = (x: number) => (x >= 0 ? 1 : 0);
  const y = $derived.by(() => {
    const w = 2 * Math.PI * f;
    if (kind === 'random') {
      const n = gaussian(t.length, 1, seed);
      const smooth = ema(n, 12);
      return smooth.map((v) => A0 + 3 * C * v);
    }
    return t.map((tt) => {
      switch (kind) {
        case 'static': return A0;
        case 'simple': return A0 + C * Math.sin(w * tt + phi);
        case 'complex': {
          let s = A0;
          for (let n = 1; n <= harmonics; n++) s += (C / n) * Math.sin(n * w * tt + phi * n);
          return s;
        }
        case 'step': return A0 * U(tt);
        case 'ramp': return tt <= 0 ? 0 : A0 * Math.min(tt, t1);
        case 'pulse': return A0 * U(tt) - A0 * U(tt - t1);
      }
      return 0;
    });
  });
  const info = $derived(KINDS.find((k) => k.k === kind)!);

  // mystery game
  const MYSTERY: { kind: Kind; make: () => Float64Array; label: string }[] = [
    { kind: 'static', label: 'battery voltage over one minute', make: () => t.map(() => 9.02) },
    { kind: 'simple', label: 'wall outlet voltage, scaled', make: () => t.map((tt) => 1.2 * Math.sin(2 * Math.PI * 2 * tt)) },
    { kind: 'complex', label: 'a plucked string', make: () => t.map((tt) => Math.sin(2 * Math.PI * tt) + 0.33 * Math.sin(2 * Math.PI * 3 * tt) + 0.2 * Math.sin(2 * Math.PI * 5 * tt)) },
    { kind: 'step', label: 'a switch turning on', make: () => t.map((tt) => 5 * U(tt - 0.7)) },
    { kind: 'random', label: 'wind speed', make: () => ema(gaussian(t.length, 1, 42), 20).map((v) => 4 + 6 * v) },
    { kind: 'pulse', label: 'a camera flash', make: () => t.map((tt) => 3 * (U(tt - 1) - U(tt - 1.4))) },
  ];
  let round = $state(0);
  let guess = $state<Kind | null>(null);
  let score = $state(0);
  const mystery = $derived(MYSTERY[round % MYSTERY.length]);
  const mysteryY = $derived(mystery.make());
</script>

<Section id="classes" num={2} kicker="Signal types" title="Static and dynamic signals">
  <p class="self-only">
    A <b>static</b> signal doesn't change during the time you care about, like the diameter of a shaft or a battery voltage over a minute. A
    <b>dynamic</b> signal varies in time. It can be <b>deterministic</b> (periodic, or a predictable step, ramp or pulse) or
    <b>nondeterministic</b> (random, describable only by its statistics). In practice, signal processing is almost all about dynamic
    signals. <Ref sec="2.2" /> <Ref fig="2.5" />
  </p>

  <div class="layout">
    <div class="card list" role="listbox" aria-label="Waveform classes">
      {#each KINDS as k, i}
        {#if i === 0 || KINDS[i - 1].group !== k.group}<div class="grp">{k.group}</div>{/if}
        <button role="option" aria-selected={kind === k.k} class:on={kind === k.k} onclick={() => (kind = k.k)}>{k.name}</button>
      {/each}
      <div class="small muted" style="margin-top: 0.5rem">From Table 2.1 <Ref sec="2.2" /></div>
    </div>
    <div class="card">
      <div class="formula"><Tex math={info.tex} display /></div>
      <LineChart
        series={[{ y, xStart: t[0], dx: 1 / fs, color: 'var(--accent)', width: 2 }]}
        xDomain={[-0.5, 3]}
        height={app.mode === 'lecture' ? 300 : 240}
        xLabel="t (s)"
        yLabel="y(t)"
        markers={[{ x: 0, color: 'var(--axis)' }]}
        ariaLabel="{info.name} waveform"
      />
      <div class="controls">
        <label class="control"><span>A₀ <b>{A0.toFixed(1)}</b></span><input type="range" min="-2" max="3" step="0.1" bind:value={A0} /></label>
        {#if kind === 'simple' || kind === 'complex' || kind === 'random'}
          <label class="control"><span>C <b>{C.toFixed(1)}</b></span><input type="range" min="0" max="2" step="0.1" bind:value={C} /></label>
        {/if}
        {#if kind === 'simple' || kind === 'complex'}
          <label class="control"><span>f = ω/2π <b>{f.toFixed(1)} Hz</b></span><input type="range" min="0.2" max="4" step="0.1" bind:value={f} /></label>
          <label class="control"><span>φ <b>{phi.toFixed(2)} rad</b></span><input type="range" min="0" max="6.28" step="0.01" bind:value={phi} /></label>
        {/if}
        {#if kind === 'complex'}
          <label class="control"><span>Harmonics <b>{harmonics}</b></span><input type="range" min="1" max="10" step="1" bind:value={harmonics} /></label>
        {/if}
        {#if kind === 'ramp' || kind === 'pulse'}
          <label class="control"><span>{kind === 'ramp' ? 't_f' : 't₁ (pulse width)'} <b>{t1.toFixed(1)} s</b></span><input type="range" min="0.1" max="2.5" step="0.1" bind:value={t1} /></label>
        {/if}
        {#if kind === 'random'}
          <button onclick={() => seed++}>New random record</button>
          <span class="small secondary">Each record is different. You can only predict its <i>statistics</i> (mean, RMS, spectrum).</span>
        {/if}
      </div>
    </div>
  </div>

  <div class="card game" style="margin-top: 1rem">
    <h3>Classify the signal <span class="muted small">round {round + 1}</span></h3>
    <LineChart series={[{ y: mysteryY, xStart: t[0], dx: 1 / fs, color: 'var(--text-secondary)', width: 2 }]} xDomain={[-0.5, 3]} height={150} xLabel="t (s)" hover={false} ariaLabel="Mystery signal" />
    <div class="choices">
      {#each KINDS as k}
        <button
          disabled={guess !== null}
          class:right={guess !== null && k.k === mystery.kind}
          class:wrong={guess === k.k && k.k !== mystery.kind}
          onclick={() => {
            guess = k.k;
            if (k.k === mystery.kind) score++;
          }}>{k.name}</button
        >
      {/each}
    </div>
    {#if guess !== null}
      <p class="small" role="status">
        {guess === mystery.kind ? '✓' : '✗'} It's <b>{KINDS.find((k) => k.k === mystery.kind)!.name.toLowerCase()}</b>: {mystery.label}. Score {score}/{round + 1}.
        <button onclick={() => { round++; guess = null; }}>Next →</button>
      </p>
    {/if}
  </div>
</Section>

<style>
  .layout { display: grid; grid-template-columns: minmax(180px, 230px) 1fr; gap: 1rem; align-items: start; }
  .layout > * { min-width: 0; }
  .list { display: grid; gap: 0.15rem; }
  .grp { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); font-weight: 600; margin-top: 0.5rem; }
  .list button { text-align: left; border: 0; background: none; padding: 0.3rem 0.5rem; border-radius: 6px; }
  .list button.on { background: var(--accent-soft); font-weight: 600; }
  .formula { overflow-x: auto; font-size: 1.05rem; }
  .choices { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem; }
  .choices button.right { background: color-mix(in srgb, var(--good) 20%, var(--surface-1)); border-color: var(--good); opacity: 1; }
  .choices button.wrong { background: color-mix(in srgb, var(--critical) 15%, var(--surface-1)); border-color: var(--critical); opacity: 1; }
  .game h3 { margin-bottom: 0.3rem; }
  @media (max-width: 760px) { .layout { grid-template-columns: 1fr; } .list { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); } .grp { grid-column: 1 / -1; } }
</style>
