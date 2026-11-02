<script lang="ts">
  import { GROUPS, SENSORS, groupLabel } from '../lib/registry';

  const CHAIN = [
    { t: 'Measurand', d: 'the physical quantity: strain, acceleration, temperature…' },
    { t: 'Sensing element', d: 'something that responds to it: a foil grid, a proof mass, a junction of two metals' },
    { t: 'Transduction', d: 'the response becomes an electrical quantity: ΔR, ΔC, a voltage, a frequency' },
    { t: 'Signal conditioning', d: 'bridge, amplifier, filter, analog-to-digital converter' },
    { t: 'Output', d: 'a number, with units, and an uncertainty' },
  ];
  const ordered = GROUPS.flatMap((g) => SENSORS.filter((s) => s.group === g.id));
</script>

<div id="top" class="hero">
  <div class="kicker">Measurements · Types of Sensors</div>
  <h1>Types of sensors</h1>
  <p class="lede">
    Interactive notes for the Types of Sensors lecture. A sensor converts a physical quantity into a signal that can be recorded. For each sensor
    in the lecture, this page shows how the conversion works, what the output looks like, and the effects that most often spoil the measurement.
    The last section uses the accelerometer, gyroscope and compass in a phone.
  </p>

  <ol class="chain" aria-label="Measurement chain">
    {#each CHAIN as c, i}
      <li>
        <span class="ct">{c.t}</span>
        <span class="cd self-only">{c.d}</span>
      </li>
      {#if i < CHAIN.length - 1}<li class="arrow" aria-hidden="true">→</li>{/if}
    {/each}
  </ol>

  <div class="self-only">
    <p class="body">
      Each sensor has a <b>spec card</b> with typical values. The terms are the ones found on a datasheet:
    </p>
    <dl class="defs">
      <dt>Range</dt>
      <dd>The span of input values the sensor is designed to measure.</dd>
      <dt>Sensitivity</dt>
      <dd>The change in output per unit change in input, the slope of the calibration curve (for example mV/V per µε, or µV/°C).</dd>
      <dt>Resolution</dt>
      <dd>The smallest change in input that produces a detectable change in output, usually set by noise or by the converter.</dd>
      <dt>Bandwidth</dt>
      <dd>The range of frequencies over which the sensor follows the input with acceptable amplitude and phase error.</dd>
      <dt>Cross-sensitivity</dt>
      <dd>Response to a quantity other than the one being measured. Temperature is the most common one.</dd>
    </dl>
  </div>

  <ol class="topics">
    {#each ordered as s}
      <li>
        <a href="#{s.id}">
          <span class="g">{groupLabel(s.group)}{s.slide ? ` · slide ${s.slide}` : ''}</span>
          <span class="tt">{s.name}</span>
          <span class="d">{s.d}</span>
        </a>
      </li>
    {/each}
  </ol>

  <div class="how self-only">
    <div>
      <b>How to use this page.</b> All figures are interactive. Purple <span class="tag p">Predict</span> boxes ask you to commit to a guess before
      revealing the answer. Links to the videos shown in the lecture are at the end of each sensor.
    </div>
    <div class="muted small">
      For teaching, switch to <b>Lecture</b> mode (top right) for big type and visuals only. PageDown/PageUp (or a presentation clicker) steps
      through the sensors. You can also link to it directly with <code>?mode=lecture</code>.
    </div>
  </div>
</div>

<style>
  .hero { max-width: var(--content); margin: 0 auto; padding: 4rem 1.25rem 3rem; }
  .kicker { font-size: 0.8rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent-ink); margin-bottom: 0.6rem; }
  h1 { font-size: clamp(2.1rem, 5vw, 3.6rem); letter-spacing: -0.02em; margin-bottom: 1rem; }
  .lede { font-size: 1.15rem; color: var(--text-secondary); max-width: 68ch; }
  .body { max-width: 80ch; }
  .chain { list-style: none; padding: 0; margin: 1.6rem 0; display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: stretch; }
  .chain li:not(.arrow) { flex: 1 1 150px; background: var(--surface-1); border: 1px solid var(--grid); border-radius: var(--radius); padding: 0.55rem 0.7rem; display: grid; gap: 0.15rem; align-content: start; }
  .chain .arrow { align-self: center; color: var(--text-muted); font-size: 1.1rem; }
  .ct { font-weight: 700; font-size: 0.92rem; }
  .cd { font-size: 0.8rem; color: var(--text-secondary); }
  .topics { list-style: none; padding: 0; margin: 2rem 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.5rem; }
  .topics a { display: grid; gap: 0.1rem; padding: 0.55rem 0.75rem; border-radius: var(--radius); background: var(--surface-1); border: 1px solid var(--grid); color: var(--text-primary); text-decoration: none; height: 100%; box-sizing: border-box; }
  .topics a:hover { border-color: var(--accent); }
  .g { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent-ink); }
  .tt { font-weight: 600; font-size: 0.95rem; }
  .d { font-weight: 400; font-size: 0.8rem; color: var(--text-secondary); }
  .how { display: grid; gap: 0.4rem; padding: 0.9rem 1rem; border-radius: var(--radius); background: var(--surface-2); font-size: 0.9rem; max-width: 92ch; }
  .tag { font-size: 0.68rem; text-transform: uppercase; color: #fff; padding: 0.05em 0.45em; border-radius: 4px; letter-spacing: 0.05em; }
  .tag.p { background: var(--focus); }
  @media (max-width: 640px) { .chain .arrow { display: none; } }
</style>
