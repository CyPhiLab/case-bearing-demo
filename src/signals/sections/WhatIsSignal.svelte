<script lang="ts">
  import { onMount } from 'svelte';
  import Section from '../../lib/ui/Section.svelte';
  import Seg from '../../lib/ui/Seg.svelte';
  import Quiz from '../../lib/ui/Quiz.svelte';

  // Each example follows the same chain: physical variation → transducer → electronic signal → processing → output
  type Stage = { name: string; what: string; glyph: 'wave' | 'box' | 'volts' | 'dots' | 'radio' | 'display' };
  const CHAINS: Record<string, { title: string; stages: Stage[] }> = {
    phone: {
      title: 'Phone call (slide 2)',
      stages: [
        { name: 'Voice', what: 'Air pressure fluctuations: the physical signal', glyph: 'wave' },
        { name: 'Microphone', what: 'Transducer: pressure → voltage', glyph: 'box' },
        { name: 'Electronic signal', what: 'A voltage I(t), V(t) that mirrors the pressure', glyph: 'volts' },
        { name: 'Processors', what: 'Amplify, filter, digitize, compress', glyph: 'dots' },
        { name: 'Transmitter → receiver', what: 'Carried by an electromagnetic wave', glyph: 'radio' },
        { name: 'Speaker → ear', what: 'Transducer back to pressure', glyph: 'wave' },
      ],
    },
    laptop: {
      title: 'Laptop microphone',
      stages: [
        { name: 'Room sound', what: 'Pressure variations (measured in section 10)', glyph: 'wave' },
        { name: 'MEMS microphone', what: 'Transducer: a tiny diaphragm changes a capacitance', glyph: 'box' },
        { name: 'Analog voltage', what: 'Continuous in time and in amplitude', glyph: 'volts' },
        { name: 'Sound card ADC', what: 'Samples ~48,000 times per second, 16–24 bits', glyph: 'dots' },
        { name: 'Browser', what: 'Numbers y_i, one every δt = 1/48,000 s', glyph: 'dots' },
        { name: 'Display', what: 'Waveform, spectrum, spectrogram', glyph: 'display' },
      ],
    },
    machine: {
      title: 'Vibration on a machine',
      stages: [
        { name: 'Vibration', what: 'Acceleration of a bearing housing', glyph: 'wave' },
        { name: 'Accelerometer', what: 'Transducer: a piezo crystal makes charge ∝ acceleration', glyph: 'box' },
        { name: 'Charge amplifier', what: 'Charge → voltage (signal conditioning)', glyph: 'volts' },
        { name: 'DAQ', what: 'Anti-alias filter + ADC, e.g. 12 kHz, 16-bit', glyph: 'dots' },
        { name: 'Network', what: 'Data sent to a monitoring server', glyph: 'radio' },
        { name: 'Analyst / algorithm', what: 'RMS trend, spectrum, alarm', glyph: 'display' },
      ],
    },
    thermo: {
      title: 'Room thermometer',
      stages: [
        { name: 'Temperature', what: 'Changes over minutes to hours: nearly static', glyph: 'wave' },
        { name: 'Thermistor', what: 'Transducer: resistance changes with temperature', glyph: 'box' },
        { name: 'Bridge voltage', what: 'A small voltage proportional to ΔR', glyph: 'volts' },
        { name: 'ADC', what: 'One sample per second is plenty', glyph: 'dots' },
        { name: 'Wi-Fi', what: 'Sent to a phone app', glyph: 'radio' },
        { name: 'Display', what: '21.4 °C', glyph: 'display' },
      ],
    },
  };
  let which = $state<keyof typeof CHAINS>('phone');
  const chain = $derived(CHAINS[which]);
  let t = $state(0);
  onMount(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const tick = (now: number) => {
      t = now / 1000;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  const W = 120, H = 56;
  function glyphPath(g: Stage['glyph'], phase: number): string {
    const pts: string[] = [];
    if (g === 'wave' || g === 'volts' || g === 'radio') {
      const f = g === 'radio' ? 6 : 2;
      for (let i = 0; i <= 60; i++) {
        const x = (i / 60) * W;
        const env = g === 'radio' ? Math.sin((Math.PI * i) / 60) : 1;
        const y = H / 2 - 18 * env * Math.sin((2 * Math.PI * f * i) / 60 - phase) * (g === 'volts' ? 0.8 : 1);
        pts.push(`${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`);
      }
      return pts.join('');
    }
    return '';
  }
</script>

<Section id="signal" num={1} kicker="Signals" title="What is a signal?">
  <blockquote class="def">
    "The process and the result of transmission of data over some media accomplished by embedding some variation."
  </blockquote>
  <p class="self-only">
    In measurements, the variation is a physical quantity (pressure, acceleration, temperature) that a <b>transducer</b> turns into an
    <b>electronic signal</b>. It is then processed, possibly transmitted, and finally displayed or converted back into a physical quantity. The
    same chain applies whatever the measured quantity.
  </p>
  <dl class="defs self-only">
    <dt>Transducer</dt><dd>A device that converts one physical quantity into another, usually into a voltage: a microphone, an accelerometer, a thermocouple.</dd>
    <dt>Signal conditioning</dt><dd>Amplification, filtering and other processing that prepares the transducer output for recording.</dd>
    <dt>Analog signal</dt><dd>Continuous in time and in amplitude, like the voltage from a microphone.</dd>
    <dt>Discrete-time signal</dt><dd>Values known only at sampling instants t = iδt, but with any amplitude.</dd>
    <dt>Digital signal</dt><dd>Discrete in time and in amplitude: what an analog-to-digital converter (ADC) produces, and what a computer stores. Sections 6 and 7 deal with what is lost in this conversion.</dd>
  </dl>

  <div class="card">
    <Seg
      bind:value={which}
      label="Example measurement chain"
      options={Object.entries(CHAINS).map(([k, c]) => ({ value: k as keyof typeof CHAINS, label: c.title }))}
    />
    <ol class="chain">
      {#each chain.stages as s, i}
        <li style:--d="{i * 0.12}s">
          <svg viewBox="0 0 {W} {H}" class="glyph" aria-hidden="true">
            {#if s.glyph === 'box'}
              <rect x="34" y="8" width="52" height="40" rx="6" class="box" />
              <path d="M44 28 h32" class="sig" />
            {:else if s.glyph === 'dots'}
              {#each { length: 16 } as _, k}
                {@const x = 6 + k * 7.2}
                {@const y = H / 2 - 18 * Math.sin((2 * Math.PI * 2 * k) / 16 - t * 3)}
                <line x1={x} x2={x} y1={H / 2} y2={Math.round(y / 4) * 4} class="stem" />
                <circle cx={x} cy={Math.round(y / 4) * 4} r="2.2" class="dot" />
              {/each}
            {:else if s.glyph === 'display'}
              <rect x="14" y="6" width="92" height="44" rx="5" class="box" />
              <path d={glyphPath('wave', t * 3)} transform="translate(20,10) scale(0.67,0.65)" class="sig" />
            {:else}
              <path d={glyphPath(s.glyph, t * 3 + i)} class="sig" class:em={s.glyph === 'radio'} />
            {/if}
          </svg>
          <b>{s.name}</b>
          <span>{s.what}</span>
        </li>
      {/each}
    </ol>
  </div>

  <div class="apps self-only">
    <b>Applications:</b>
    <span class="chip">Image processing: an image is a 2-D signal</span>
    <span class="chip">Biology: ECG, EEG, neural spikes</span>
    <span class="chip">Seismography: ground motion</span>
    <span class="chip">Measurements: every sensor</span>
  </div>

  <Quiz
    question="In the 'vibration on a machine' chain, which stage is the transducer?"
    options={['The DAQ', 'The accelerometer', 'The charge amplifier', 'The analyst']}
    answer={1}
    explain="A transducer converts one physical form of energy into another. The accelerometer turns mechanical acceleration into electrical charge. Everything after that is signal conditioning and processing."
  />
</Section>

<style>
  .def { margin: 0 0 1rem; padding: 0.6rem 1rem; border-left: 4px solid var(--accent); background: var(--surface-1); font-size: 1.15rem; max-width: 70ch; font-style: italic; }
  .chain { list-style: none; padding: 0; margin: 1rem 0 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.6rem; }
  .chain li { display: grid; gap: 0.2rem; padding: 0.6rem; background: var(--surface-2); border-radius: 8px; position: relative; animation: pop 0.4s var(--d) both; }
  .chain li:not(:last-child)::after { content: '→'; position: absolute; right: -0.55rem; top: 30px; color: var(--text-muted); }
  .chain b { font-size: 0.92rem; }
  .chain span { font-size: 0.78rem; color: var(--text-secondary); }
  .glyph { width: 100%; height: 56px; }
  .sig { fill: none; stroke: var(--accent); stroke-width: 2; }
  .sig.em { stroke: var(--focus); }
  .box { fill: var(--surface-1); stroke: var(--axis); stroke-width: 1.5; }
  .stem { stroke: var(--axis); }
  .dot { fill: var(--accent); }
  .apps { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; margin-top: 1rem; font-size: 0.9rem; }
  @keyframes pop { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .chain li { animation: none; } }
  @media (max-width: 640px) { .chain li:not(:last-child)::after { display: none; } }
</style>
