<script lang="ts">
  import { onMount } from 'svelte';
  import { app, applyPreferences } from './lib/state.svelte';
  import { loadDataset, type Dataset } from './lib/data';
  import Intro from './sections/Intro.svelte';
  import Rig from './sections/Rig.svelte';
  import Signal from './sections/Signal.svelte';
  import Windows from './sections/Windows.svelte';
  import Features from './sections/Features.svelte';
  import PCA from './sections/PCA.svelte';
  import Logistic from './sections/Logistic.svelte';
  import MLP from './sections/MLP.svelte';
  import CNN from './sections/CNN.svelte';
  import Diagnose from './sections/Diagnose.svelte';

  const SECTIONS = [
    { id: 'rig', label: 'The bearing' },
    { id: 'signal', label: 'Look & listen' },
    { id: 'windows', label: 'Windows' },
    { id: 'features', label: 'Features' },
    { id: 'pca', label: 'PCA' },
    { id: 'logistic', label: 'Logistic reg.' },
    { id: 'mlp', label: 'Neural net' },
    { id: 'cnn', label: 'CNN' },
    { id: 'diagnose', label: 'Diagnose' },
  ];

  let dataset = $state<Dataset | null>(null);
  let loadError = $state('');
  let active = $state('');

  onMount(() => {
    loadDataset()
      .then((d) => (dataset = d))
      .catch((e) => (loadError = String(e)));

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) active = e.target.id;
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    const watch = () => document.querySelectorAll('section.section').forEach((s) => obs.observe(s));
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(document.querySelector('main')!, { childList: true, subtree: true });
    return () => {
      obs.disconnect();
      mo.disconnect();
    };
  });

  function step(dir: 1 | -1) {
    const ids = ['top', ...SECTIONS.map((s) => s.id)];
    const tops = ids.map((id) => document.getElementById(id)?.getBoundingClientRect().top ?? 0);
    // first section whose top is meaningfully below / above the header line
    const idx = dir === 1 ? tops.findIndex((t) => t > 80) : tops.findLastIndex((t) => t < -10);
    const target = ids[Math.max(0, idx === -1 ? (dir === 1 ? ids.length - 1 : 0) : idx)];
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
  }

  function onkeydown(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t.closest('input, select, textarea, [contenteditable]')) return;
    // presentation clickers send PageDown / PageUp
    if (e.key === 'PageDown' || (app.mode === 'lecture' && e.key === 'ArrowRight')) {
      e.preventDefault();
      step(1);
    } else if (e.key === 'PageUp' || (app.mode === 'lecture' && e.key === 'ArrowLeft')) {
      e.preventDefault();
      step(-1);
    }
  }

  function setMode(m: typeof app.mode) {
    app.mode = m;
    applyPreferences();
  }
  function cycleTheme() {
    app.theme = app.theme === 'auto' ? 'light' : app.theme === 'light' ? 'dark' : 'auto';
    applyPreferences();
  }
</script>

<svelte:window {onkeydown} />

<header class="topbar">
  <a class="brand" href="#top">
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill="none" stroke="var(--accent)" stroke-width="3" />
      <circle cx="16" cy="16" r="6" fill="none" stroke="var(--accent)" stroke-width="3" />
      <circle cx="16" cy="6.5" r="3" fill="var(--cls-2)" />
    </svg>
    <span>Listening to Bearings</span>
  </a>
  <nav aria-label="sections">
    {#each SECTIONS as s, i}
      <a href="#{s.id}" class:active={active === s.id} aria-current={active === s.id ? 'true' : undefined}>
        <span class="n">{i + 1}</span><span class="l">{s.label}</span>
      </a>
    {/each}
  </nav>
  <div class="toggles">
    <div class="seg" role="group" aria-label="Mode">
      <button aria-pressed={app.mode === 'self'} onclick={() => setMode('self')} title="Full text, prompts and check questions">Self-paced</button>
      <button aria-pressed={app.mode === 'lecture'} onclick={() => setMode('lecture')} title="Big type, visuals only. PageDown/PageUp or ←/→ step through sections">Lecture</button>
    </div>
    <button class="icon" onclick={cycleTheme} title="Theme: {app.theme}" aria-label="Theme: {app.theme}">
      {app.theme === 'dark' ? '☾' : app.theme === 'light' ? '☀' : '◐'}
    </button>
  </div>
</header>

<main>
  <Intro />
  <Rig />
  {#if dataset}
    <Signal ds={dataset} />
    <Windows ds={dataset} />
    <Features ds={dataset} />
    <PCA ds={dataset} />
    <Logistic ds={dataset} />
    <MLP ds={dataset} />
    <CNN ds={dataset} />
    <Diagnose ds={dataset} />
  {:else if loadError}
    <p class="loading">Couldn't load the vibration data: {loadError}</p>
  {:else}
    <p class="loading">Loading 10 vibration recordings…</p>
  {/if}
</main>

<footer>
  <div>
    Data: <a href="https://engineering.case.edu/bearingdatacenter">Case Western Reserve University Bearing Data Center</a>
    (via <a href="https://github.com/srigas/CWRU_Bearing_NumPy">CWRU_Bearing_NumPy</a>). Feature set adapted from
    <a href="https://github.com/LGDiMaggio/CWRU-bearing-fault-classification-ML">L. G. Di Maggio</a>.
  </div>
  <div class="muted">
    Built for Prof. Zach Patterson's measurements course. Everything runs in your browser, and nothing is sent anywhere.
  </div>
</footer>

<style>
  .topbar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.45rem 1rem;
    background: color-mix(in srgb, var(--page) 88%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--grid);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    color: var(--text-primary);
    text-decoration: none;
    white-space: nowrap;
    font-size: 0.95rem;
  }
  nav {
    display: flex;
    gap: 0.15rem;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  nav a {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.78rem;
    white-space: nowrap;
  }
  nav a:hover { background: var(--surface-2); }
  nav a.active { background: var(--accent-soft); color: var(--accent-ink); font-weight: 600; }
  nav .n {
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--text-muted);
  }
  nav a.active .n { color: var(--accent-ink); }
  .toggles { display: flex; gap: 0.4rem; align-items: center; }
  .seg { display: flex; }
  .seg button { border-radius: 0; font-size: 0.78rem; padding: 0.25em 0.6em; }
  .seg button:first-child { border-radius: 8px 0 0 8px; }
  .seg button:last-child { border-radius: 0 8px 8px 0; margin-left: -1px; }
  .icon { padding: 0.2em 0.55em; }
  .loading { text-align: center; padding: 4rem 1rem; color: var(--text-muted); }
  footer {
    max-width: var(--content);
    margin: 3rem auto 0;
    padding: 2rem 1.25rem 3rem;
    border-top: 1px solid var(--grid);
    font-size: 0.8rem;
    color: var(--text-secondary);
    display: grid;
    gap: 0.4rem;
  }
  @media (max-width: 1100px) {
    nav .l { display: none; }
    nav a.active .l { display: inline; }
  }
  @media (max-width: 640px) {
    .brand span { display: none; }
    .topbar { gap: 0.5rem; padding: 0.4rem 0.6rem; }
  }
</style>
