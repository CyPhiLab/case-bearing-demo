<script lang="ts">
  // A phone drawn in 3D from an orientation quaternion (device → world, world x east, y north, z up). The camera looks
  // north from the south, from above, so a phone lying flat with its top to the north appears as seen from behind.
  import { qToMatrix, type Quat } from '../lib/fusion';

  let { q, label = '', size = 170, testid = '' }: { q: Quat | null; label?: string; size?: number; testid?: string } = $props();
  const E = (35 * Math.PI) / 180; // camera elevation
  const U = [0, Math.sin(E), Math.cos(E)]; // screen up
  const C = [0, -Math.cos(E), Math.sin(E)]; // toward the camera
  const H = [3.6, 7.4, 0.5]; // half-size of the phone (cm)
  const S = 8.5; // px per cm in a 170 px view

  const FACES: { n: [number, number, number]; kind: string }[] = [
    { n: [0, 0, 1], kind: 'screen' },
    { n: [0, 0, -1], kind: 'back' },
    { n: [1, 0, 0], kind: 'side' },
    { n: [-1, 0, 0], kind: 'side' },
    { n: [0, 1, 0], kind: 'top' },
    { n: [0, -1, 0], kind: 'side' },
  ];
  // the four corners of the face with outward normal n
  function corners(n: number[]): number[][] {
    const ax = n.findIndex((v) => v !== 0);
    const [i, j] = [0, 1, 2].filter((k) => k !== ax);
    const out: number[][] = [];
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = [0, 0, 0];
      p[ax] = n[ax] * H[ax];
      p[i] = a * H[i];
      p[j] = b * H[j];
      out.push(p);
    }
    return out;
  }
  const mul = (R: number[][], v: number[]) => [0, 1, 2].map((r) => R[r][0] * v[0] + R[r][1] * v[1] + R[r][2] * v[2]);
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const proj = (p: number[]) => [dot(p, [1, 0, 0]) * S, -dot(p, U) * S];
  const L = [-0.3, -0.5, 0.8];

  const faces = $derived.by(() => {
    if (!q) return [];
    const R = qToMatrix(q);
    return FACES.map((f) => {
      const nw = mul(R, f.n);
      return { ...f, vis: dot(nw, C), light: 0.55 + 0.45 * Math.max(0, dot(nw, L) / Math.hypot(...L)), pts: corners(f.n).map((p) => proj(mul(R, p))) };
    })
      .filter((f) => f.vis > 0.01)
      .sort((a, b) => a.vis - b.vis);
  });
  // a notch near the top of the screen shows which way is up
  const notch = $derived.by(() => {
    if (!q) return null;
    const R = qToMatrix(q);
    if (dot(mul(R, [0, 0, 1]), C) <= 0.01) return null;
    const c = proj(mul(R, [0, H[1] - 0.9, H[2] + 0.01]));
    const a = proj(mul(R, [-1.2, H[1] - 0.9, H[2] + 0.01]));
    const b = proj(mul(R, [1.2, H[1] - 0.9, H[2] + 0.01]));
    return { c, a, b };
  });
  const north = [proj([0, -6, -9]), proj([0, 6, -9])];
</script>

<figure class="phone3d" data-testid={testid || undefined}>
  <svg viewBox="-85 -85 170 170" width={size} height={size} role="img" aria-label={label || 'Phone orientation'}>
    <line x1={north[0][0]} y1={north[0][1]} x2={north[1][0]} y2={north[1][1]} class="n" marker-end="url(#narrow)" />
    <text x={north[1][0] + 4} y={north[1][1]} class="nl">N</text>
    {#each faces as f}
      <polygon points={f.pts.map((p) => p.join(',')).join(' ')} class={f.kind} style:filter="brightness({f.light.toFixed(2)})" />
    {/each}
    {#if notch}<line x1={notch.a[0]} y1={notch.a[1]} x2={notch.b[0]} y2={notch.b[1]} class="notch" />{/if}
    {#if !q}<text x="0" y="4" text-anchor="middle" class="nl">no data</text>{/if}
    <defs><marker id="narrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--text-muted)" /></marker></defs>
  </svg>
  {#if label}<figcaption class="small">{label}</figcaption>{/if}
</figure>

<style>
  .phone3d { margin: 0; display: grid; justify-items: center; gap: 0.2rem; }
  .screen { fill: #1d2a3a; stroke: var(--text-muted); stroke-width: 0.8; }
  .back { fill: var(--cls-2); stroke: var(--text-muted); stroke-width: 0.8; }
  .side { fill: var(--surface-3); stroke: var(--text-muted); stroke-width: 0.8; }
  .top { fill: var(--accent); stroke: var(--text-muted); stroke-width: 0.8; }
  .notch { stroke: #8fb8ee; stroke-width: 3; stroke-linecap: round; }
  .n { stroke: var(--text-muted); stroke-width: 1.2; stroke-dasharray: 3 2; }
  .nl { font-size: 9px; fill: var(--text-muted); }
  figcaption { text-align: center; color: var(--text-secondary); }
</style>
