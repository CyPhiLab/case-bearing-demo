// App-wide UI state shared between sections (so a recording picked in one section follows you).

export type Mode = 'self' | 'lecture';
export type Theme = 'auto' | 'light' | 'dark';

export const app = $state({
  mode: 'self' as Mode,
  theme: 'auto' as Theme,
  /** bumps whenever resolved colors change, so canvases know to repaint */
  paletteTick: 0,
  /** recording selected in the signal / windowing / feature sections */
  rec: 7,
  /** start sample of the highlighted analysis window */
  windowStart: 20480,
  /** feature highlighted in the feature explorer */
  feature: 6,
});

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function store(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* private mode: fine, just not remembered */
  }
}

export function initPreferences() {
  const params = new URLSearchParams(location.search);
  app.mode = (params.get('mode') as Mode) === 'lecture' ? 'lecture' : readStored('cwru-mode', ['self', 'lecture'], 'self');
  app.theme = readStored('cwru-theme', ['auto', 'light', 'dark'], 'auto');
  applyPreferences();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => app.paletteTick++);
}

export function applyPreferences() {
  const root = document.documentElement;
  root.dataset.mode = app.mode;
  if (app.theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = app.theme;
  store('cwru-mode', app.mode);
  store('cwru-theme', app.theme);
  app.paletteTick++;
}

/** Test accuracies from the playgrounds, collected for the final comparison. */
export const results = $state<Record<string, { acc: number; detail: string } | undefined>>({});
