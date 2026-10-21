<script lang="ts">
  import Section from '../lib/ui/Section.svelte';
  import Tex from '../lib/ui/Tex.svelte';
  import Predict from '../lib/ui/Predict.svelte';
  import Quiz from '../lib/ui/Quiz.svelte';
  import BearingAnim, { type DefectSite } from '../lib/viz/BearingAnim.svelte';
  import { BEARING, IMS_BEARING, faultFrequencies } from '../lib/bearing';

  const RIGS = [BEARING, IMS_BEARING];
  let rigIdx = $state(0);
  const geom = $derived(RIGS[rigIdx]);
  let defect = $state<DefectSite>('outer');
  let rpm = $state(BEARING.rpm);
  let slowmo = $state(60);
  let playing = $state(true);
  const ff = $derived(faultFrequencies(rpm, geom));
  function pickRig(i: number) {
    rigIdx = i;
    rpm = RIGS[i].rpm;
  }

  const SITES: { id: DefectSite; label: string }[] = [
    { id: 'none', label: 'Healthy' },
    { id: 'outer', label: 'Outer race' },
    { id: 'inner', label: 'Inner race' },
    { id: 'ball', label: 'Ball' },
  ];

  const rows = $derived([
    { key: 'shaft', name: 'Shaft speed', sym: 'f_r', hz: ff.shaft, site: '' },
    { key: 'ftf', name: 'Cage (FTF)', sym: '\\text{FTF}', hz: ff.ftf, site: '' },
    { key: 'bpfo', name: 'Ball pass, outer race', sym: '\\text{BPFO}', hz: ff.bpfo, site: 'outer' },
    { key: 'bpfi', name: 'Ball pass, inner race', sym: '\\text{BPFI}', hz: ff.bpfi, site: 'inner' },
    { key: 'bsf', name: 'Ball spin ×2', sym: '2\\,\\text{BSF}', hz: 2 * ff.bsf, site: 'ball' },
  ]);
</script>

<Section id="rig" num={1} kicker="The physics" title="A tiny pit makes a big, regular noise">
  <p class="self-only">
    The CWRU test rig is a 2 hp motor driving a dynamometer through a torque sensor. Engineers used electro-discharge machining
    to cut a tiny pit, 0.007 to 0.021 inches across, into the <b>drive-end bearing</b> (an {BEARING.model}). An accelerometer on
    the motor housing then recorded what that bearing sounded like. Every time a ball rolls over the pit, it delivers a sharp
    <b>impact</b> that rings the housing like a bell.
  </p>

  <div class="card">
    <div class="controls">
      <div class="control">
        Rig
        <div class="seg" role="group" aria-label="Test rig">
          <button aria-pressed={rigIdx === 0} onclick={() => pickRig(0)} title={BEARING.rig}>CWRU · {BEARING.model}</button>
          <button aria-pressed={rigIdx === 1} onclick={() => pickRig(1)} title={IMS_BEARING.rig}>NASA/IMS · {IMS_BEARING.model}</button>
        </div>
      </div>
      <div class="control">
        Defect location
        <div class="seg" role="group" aria-label="Defect location">
          {#each SITES as s}
            <button aria-pressed={defect === s.id} onclick={() => (defect = s.id)}>{s.label}</button>
          {/each}
        </div>
      </div>
      <label class="control">
        <span>Shaft speed <b>{rpm} rpm</b></span>
        <input type="range" min="300" max="3600" step="1" bind:value={rpm} />
      </label>
      <label class="control">
        <span>Slow motion <b>{slowmo}×</b></span>
        <input type="range" min="10" max="300" step="5" bind:value={slowmo} />
      </label>
      <button onclick={() => (playing = !playing)}>{playing ? '❚❚ Pause' : '▶ Play'}</button>
    </div>
    <div style="margin-top: 1rem">
      <BearingAnim {rpm} {defect} {slowmo} {playing} geometry={geom} />
    </div>
    {#if rigIdx === 1}
      <p class="small secondary rig-note">
        <b>A second, very different experiment.</b> The CWRU rig has pits <i>machined</i> into its bearings on purpose. On the NASA/IMS
        rig (University of Cincinnati), four of these large roller bearings ran at 2000 rpm under a 6000 lb load, around the clock, until
        one of them <i>wore out on its own</i> after about 7 days. Nobody knew in advance which bearing would fail, or how. You'll see its
        data in sections 2, 4 and 9.
      </p>
    {/if}
  </div>

  <Predict question="The outer race doesn't move, but the inner race spins with the shaft. Which defect do you think the balls hit more often each second?">
    <p>
      The <b>inner race</b>. Balls roll past an inner-race pit faster because the pit is rotating toward them. At 1772 rpm that's about
      {ff.bpfi.toFixed(0)} strikes/s, versus {ff.bpfo.toFixed(0)}/s on the outer race. The inner-race pit also swings in and out
      of the load zone once per revolution, so its impacts grow and fade. Watch the strike amplitude in the trace.
    </p>
  </Predict>

  <div class="grid-2" style="margin-top: 1rem">
    <div class="card">
      <h3>Every fault has its own frequency</h3>
      <p class="small secondary">
        From the {geom.model}'s geometry ({geom.balls} {geom.element}s, {geom.element} diameter d = {geom.ballDiameter}″, pitch diameter D =
        {geom.pitchDiameter}″{geom.contactAngle ? `, contact angle φ = ${((geom.contactAngle * 180) / Math.PI).toFixed(2)}°` : ''}), you can
        predict exactly how often each kind of defect gets struck.
      </p>
      <table class="ff">
        <thead><tr><th>Frequency</th><th></th><th class="r">Hz</th><th class="r">× shaft</th></tr></thead>
        <tbody>
          {#each rows as r}
            <tr class:hit={r.site && r.site === defect}>
              <td>{r.name}</td>
              <td><Tex math={r.sym} /></td>
              <td class="r num">{r.hz.toFixed(1)}</td>
              <td class="r num muted">{(r.hz / ff.shaft).toFixed(3)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <div class="card self-only">
      <h3>Where these come from</h3>
      <div class="eqs">
        <Tex display math={'\\text{BPFO} = \\frac{n f_r}{2}\\left(1 - \\frac{d}{D}\\cos\\phi\\right)'} />
        <Tex display math={'\\text{BPFI} = \\frac{n f_r}{2}\\left(1 + \\frac{d}{D}\\cos\\phi\\right)'} />
        <Tex display math={'\\text{BSF} = \\frac{D f_r}{2d}\\left(1 - \\left(\\frac{d}{D}\\cos\\phi\\right)^2\\right)'} />
      </div>
      <p class="small secondary">
        Here n = number of balls, f<sub>r</sub> = shaft frequency, and φ = contact angle (0 for this deep-groove bearing). A defect on
        a ball touches <i>both</i> races once per spin, so it shows up at 2×BSF. These are the "fingerprints" we'll look for in the real
        data.
      </p>
    </div>
  </div>

  <div class="card chain" style="margin-top: 1rem">
    <h3>The measurement chain</h3>
    <ol class="flow">
      <li><b>Accelerometer</b><span>Mounted on the motor housing at 12 o'clock, drive end</span></li>
      <li><b>Signal conditioning</b><span>Amplifies the sensor charge and outputs a voltage proportional to acceleration (g)</span></li>
      <li><b>DAQ</b><span>Samples at 12,000 Hz with 16-bit resolution</span></li>
      <li><b>Nyquist limit</b><span>Content up to 6 kHz is captured faithfully</span></li>
    </ol>
  </div>

  <Quiz
    question="Our data is sampled at 12 kHz. Which of these could we NOT measure faithfully?"
    options={['The ~160 Hz inner-race strike rate', 'A 3 kHz structural resonance excited by each strike', 'An 8 kHz resonance', 'The 29.5 Hz shaft rotation']}
    answer={2}
    explain="Anything above the Nyquist frequency (fs/2 = 6 kHz) aliases. It folds back and masquerades as a lower frequency. The impact rate (~100–160 Hz) and a 3 kHz resonance are both comfortably below 6 kHz."
  />
</Section>

<style>
  .seg { display: flex; flex-wrap: wrap; }
  .seg button { border-radius: 0; margin-left: -1px; }
  .seg button:first-child { border-radius: 8px 0 0 8px; margin-left: 0; }
  .seg button:last-child { border-radius: 0 8px 8px 0; }
  .rig-note { margin: 0.8rem 0 0; max-width: 90ch; }
  .ff { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  .ff th { text-align: left; font-size: 0.75rem; color: var(--text-muted); font-weight: 500; border-bottom: 1px solid var(--grid); padding: 0.3rem 0.4rem; }
  .ff td { padding: 0.35rem 0.4rem; border-bottom: 1px solid var(--grid); }
  .ff .r { text-align: right; }
  .ff tr.hit td { background: color-mix(in srgb, var(--cls-2) 14%, transparent); font-weight: 600; }
  .eqs { font-size: 0.95rem; overflow-x: auto; }
  .flow {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 0.6rem;
  }
  .flow li {
    display: grid;
    gap: 0.2rem;
    padding: 0.6rem 0.8rem;
    background: var(--surface-2);
    border-radius: 8px;
    font-size: 0.9rem;
    position: relative;
  }
  .flow span { font-size: 0.8rem; color: var(--text-secondary); }
</style>
