<script lang="ts">
  import { onMount } from 'svelte';
  import { app, applyPreferences } from '../lib/state.svelte';
  import Intro from './sections/Intro.svelte';
  import Sensors from './sections/Sensors.svelte';
  import AccelTilt from './sections/AccelTilt.svelte';
  import Gyro from './sections/Gyro.svelte';
  import Complementary from './sections/Complementary.svelte';
  import Kalman from './sections/Kalman.svelte';
  import Orientation from './sections/Orientation.svelte';
  import DeadReckoning from './sections/DeadReckoning.svelte';
  import { stopSensors } from './lib/live.svelte';

  const SECTIONS = [
    { id: 'sensors', label: 'Sensors' },
    { id: 'tilt', label: 'Accelerometer tilt' },
    { id: 'gyro', label: 'Gyro angle' },
    { id: 'complementary', label: 'Complementary filter' },
    { id: 'kalman', label: 'Kalman filter' },
    { id: 'orientation', label: '3D orientation' },
    { id: 'dead-reckoning', label: 'Dead reckoning' },
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
    if (location.hash) setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView(), 300);
    return () => {
      obs.disconnect();
      stopSensors();
    };
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
      <rect x="10" y="3" width="12" height="26" rx="3" fill="none" stroke="var(--accent)" stroke-width="3" />
      <path d="M4 12 A12 12 0 0 1 4 20 M28 12 A12 12 0 0 0 28 20" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" />
    </svg>
    <span>Sensor Fusion Lab</span>
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
      <button aria-pressed={app.mode === 'self'} onclick={() => setMode('self')} title="Full text and prompts">Self-paced</button>
      <button aria-pressed={app.mode === 'lecture'} onclick={() => setMode('lecture')} title="Big type, visuals only. PageDown/PageUp or ←/→ step through sections">Lecture</button>
    </div>
    <button class="icon" onclick={cycleTheme} title="Theme: {app.theme}" aria-label="Theme: {app.theme}">
      {app.theme === 'dark' ? '☾' : app.theme === 'light' ? '☀' : '◐'}
    </button>
  </div>
</header>

<main>
  <Intro />
  <Sensors />
  <AccelTilt />
  <Gyro />
  <Complementary />
  <Kalman />
  <Orientation />
  <DeadReckoning />
</main>

<footer>
  <div>
    Sensor-fusion notes for the measurements course. The live figures use the accelerometer, gyroscope and compass of a phone through the
    browser's motion and orientation events.
  </div>
  <div class="muted">Everything runs in your browser. Sensor data never leaves your device.</div>
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
