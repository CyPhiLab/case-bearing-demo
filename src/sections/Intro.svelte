<script lang="ts">
  const STEPS = [
    { id: 'rig', title: 'Physics', text: 'Why a damaged bearing vibrates' },
    { id: 'signal', title: 'Measurement', text: '12,000 samples/s from an accelerometer' },
    { id: 'windows', title: 'Windows', text: 'Slice 10 s into ~100 examples' },
    { id: 'features', title: 'Features', text: '2048 numbers → 18 numbers' },
    { id: 'logistic', title: 'Models', text: 'Logistic regression → MLP → CNN' },
    { id: 'diagnose', title: 'Diagnosis', text: 'Normal, ball, inner or outer race?' },
  ];
</script>

<div id="top" class="hero">
  <div class="kicker">Case study · Neural networks unit</div>
  <h1>Can a neural network <em>hear</em> a broken bearing?</h1>
  <p class="lede">
    Rolling-element bearings hold up nearly every rotating machine: motors, pumps, wind turbines, your car's wheels. When one
    starts to fail, it vibrates in a very particular way. Here we'll use real measurements recorded in a lab right here at Case to go
    from <b>raw accelerometer data</b> to a <b>machine-learning diagnosis</b>, one step at a time.
  </p>
  <p class="lede small-lede">
    Along the way, two more real datasets show where lab results break down: a bearing that wore out on its own over a week (NASA/IMS),
    and machined vs. real fatigue damage (Paderborn University).
  </p>

  <ol class="pipeline" aria-label="Pipeline overview">
    {#each STEPS as s, i}
      <li>
        <a href="#{s.id}">
          <span class="step">{i + 1}</span>
          <span class="t">{s.title}</span>
          <span class="d">{s.text}</span>
        </a>
      </li>
    {/each}
  </ol>

  <div class="how self-only">
    <div>
      <b>How to use this page.</b> Everything is interactive: drag sliders, click points, press play. Purple
      <span class="tag p">Predict</span> boxes ask you to commit to a guess before you look, and blue
      <span class="tag c">Check</span> boxes are quick self-tests.
    </div>
    <div class="muted small">
      Teaching from this page? Switch to <b>Lecture</b> mode (top right) for big type and visuals only. PageDown/PageUp (or a
      presentation clicker) steps through the sections. You can also link straight to it with <code>?mode=lecture</code>.
    </div>
  </div>
</div>

<style>
  .hero {
    max-width: var(--content);
    margin: 0 auto;
    padding: 4rem 1.25rem 3rem;
  }
  .kicker {
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent-ink);
    margin-bottom: 0.6rem;
  }
  h1 {
    font-size: clamp(2.1rem, 5vw, 3.6rem);
    letter-spacing: -0.02em;
    max-width: 18ch;
    margin-bottom: 1rem;
  }
  h1 em { font-style: normal; color: var(--cls-2); }
  .lede { font-size: 1.15rem; color: var(--text-secondary); max-width: 64ch; }
  .small-lede { font-size: 1rem; }
  .pipeline {
    list-style: none;
    padding: 0;
    margin: 2rem 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.6rem;
    counter-reset: step;
  }
  .pipeline a {
    display: grid;
    gap: 0.15rem;
    height: 100%;
    padding: 0.8rem 0.9rem;
    border-radius: var(--radius);
    background: var(--surface-1);
    border: 1px solid var(--grid);
    text-decoration: none;
    color: var(--text-primary);
    position: relative;
    transition: border-color 0.15s, transform 0.15s;
  }
  .pipeline a:hover { border-color: var(--accent); transform: translateY(-2px); }
  .pipeline li:not(:last-child) a::after {
    content: '→';
    position: absolute;
    right: -0.55rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    font-size: 0.9rem;
    z-index: 1;
  }
  @media (max-width: 640px) {
    .pipeline li a::after { display: none; }
  }
  .step { font-family: var(--mono); font-size: 0.75rem; color: var(--accent-ink); }
  .t { font-weight: 700; }
  .d { font-size: 0.8rem; color: var(--text-secondary); }
  .how {
    display: grid;
    gap: 0.4rem;
    padding: 0.9rem 1rem;
    border-radius: var(--radius);
    background: var(--surface-2);
    font-size: 0.9rem;
    max-width: 90ch;
  }
  .tag { font-size: 0.68rem; text-transform: uppercase; color: #fff; padding: 0.05em 0.45em; border-radius: 4px; letter-spacing: 0.05em; }
  .tag.p { background: var(--focus); }
  .tag.c { background: var(--accent); }
  :global(:root[data-mode='lecture']) .hero { padding-top: 3rem; }
</style>
