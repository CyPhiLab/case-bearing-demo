<script lang="ts">
  import { onMount } from 'svelte';
  import { app, applyPreferences } from '../lib/state.svelte';
  import Intro from './sections/Intro.svelte';
  import WhatIsSignal from './sections/WhatIsSignal.svelte';
  import Classes from './sections/Classes.svelte';
  import Noise from './sections/Noise.svelte';
  import RMS from './sections/RMS.svelte';
  import Fourier from './sections/Fourier.svelte';
  import Sampling from './sections/Sampling.svelte';
  import Filters from './sections/Filters.svelte';
  import Convolution from './sections/Convolution.svelte';
  import Averaging from './sections/Averaging.svelte';
  import MicLab from './sections/MicLab.svelte';
  import PhoneLab from './sections/PhoneLab.svelte';

  const SECTIONS = [
    { id: 'signal', label: 'What is a signal' },
    { id: 'classes', label: 'Waveforms' },
    { id: 'noise', label: 'Noise' },
    { id: 'rms', label: 'Mean & RMS' },
    { id: 'fourier', label: 'Fourier' },
    { id: 'sampling', label: 'Sampling' },
    { id: 'filters', label: 'Filters' },
    { id: 'convolution', label: 'Convolution' },
    { id: 'averaging', label: 'Averaging' },
    { id: 'mic', label: 'Mic lab' },
    { id: 'phone', label: 'Phone lab' },
  ];

  let active = $state('');
  onMount(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) active = e.target.id;
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    document.querySelectorAll('section.section').forEach((s) => obs.observe(s));
    // the phone lab is the landing spot when a QR code is scanned
    if (location.hash) setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView(), 300);
    return () => obs.disconnect();
  });

  function step(dir: 1 | -1) {
    const ids = ['top', ...SECTIONS.map((s) => s.id)];
    const tops = ids.map((id) => document.getElementById(id)?.getBoundingClientRect().top ?? 0);
    const idx = dir === 1 ? tops.findIndex((t) => t > 80) : tops.findLastIndex((t) => t < -10);
    const target = ids[Math.max(0, idx === -1 ? (dir === 1 ? ids.length - 1 : 0) : idx)];
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
  }

  function onkeydown(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t.closest('input, select, textarea, [contenteditable]')) return;
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
      <path d="M2 16 C6 4, 10 4, 14 16 S22 28, 26 16 S30 10, 30 16" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" />
    </svg>
    <span>Signals Lab</span>
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
  <WhatIsSignal />
  <Classes />
  <Noise />
  <RMS />
  <Fourier />
  <Sampling />
  <Filters />
  <Convolution />
  <Averaging />
  <MicLab />
  <PhoneLab />
</main>

<footer>
  <div>
    Companion to the <i>Signals &amp; Data</i> lecture. Supplementary reading: R. S. Figliola &amp; D. E. Beasley, <i>Theory and Design for
    Mechanical Measurements</i>, 6th ed., Ch. 2 ("Static and Dynamic Characteristics of Signals"). Equation numbers refer to that chapter.
  </div>
  <div class="muted">
    Everything runs in your browser. Microphone and motion data never leave your device.
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
  .brand { display: flex; align-items: center; gap: 0.5rem; font-weight: 700; color: var(--text-primary); text-decoration: none; white-space: nowrap; font-size: 0.95rem; }
  nav { display: flex; gap: 0.15rem; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; }
  nav a { display: flex; align-items: center; gap: 0.3rem; padding: 0.25rem 0.5rem; border-radius: 6px; color: var(--text-secondary); text-decoration: none; font-size: 0.78rem; white-space: nowrap; }
  nav a:hover { background: var(--surface-2); }
  nav a.active { background: var(--accent-soft); color: var(--accent-ink); font-weight: 600; }
  nav .n { font-family: var(--mono); font-size: 0.7rem; color: var(--text-muted); }
  nav a.active .n { color: var(--accent-ink); }
  .toggles { display: flex; gap: 0.4rem; align-items: center; }
  .seg { display: flex; }
  .seg button { border-radius: 0; font-size: 0.78rem; padding: 0.25em 0.6em; }
  .seg button:first-child { border-radius: 8px 0 0 8px; }
  .seg button:last-child { border-radius: 0 8px 8px 0; margin-left: -1px; }
  .icon { padding: 0.2em 0.55em; }
  footer { max-width: var(--content); margin: 3rem auto 0; padding: 2rem 1.25rem 3rem; border-top: 1px solid var(--grid); font-size: 0.8rem; color: var(--text-secondary); display: grid; gap: 0.4rem; }
  @media (max-width: 1200px) {
    nav .l { display: none; }
    nav a.active .l { display: inline; }
  }
  @media (max-width: 640px) {
    .brand span { display: none; }
    .topbar { gap: 0.5rem; padding: 0.4rem 0.6rem; }
  }
</style>
