<script lang="ts">
  // Live waterfall: one new column every 1/60 s from an STFT window of `nfft` samples.
  import { onDestroy } from 'svelte';
  import { fft, hanning } from '../../lib/dsp/fft';
  import { themeColormap } from '../lib/colormap';
  import type { Ring } from '../lib/live';
  import { app } from '../../lib/state.svelte';

  interface Props { ring: Ring | null; nfft: number; fmax: number; floorDb: number; height?: number }
  let { ring, nfft, fmax, floorDb, height = 220 }: Props = $props();
  const PX_PER_S = 60;
  const ML = 52, MB = 26, MT = 8;
  let width = $state(600);
  let canvas: HTMLCanvasElement;
  let pos = 0;
  let raf = 0;
  let lastRing: Ring | null = null;
  let cmap = themeColormap();
  $effect(() => { void app.paletteTick; cmap = themeColormap(); });

  const H = $derived(height - MB - MT);
  const W = $derived(Math.max(10, width - ML));

  function column(ctx: CanvasRenderingContext2D, r: Ring, start: number, win: Float64Array, wsum: number, img: ImageData) {
    const re = new Float64Array(nfft), im = new Float64Array(nfft);
    const seg = r.range(start, nfft);
    for (let i = 0; i < nfft; i++) re[i] = seg[i] * win[i];
    fft(re, im);
    const df = r.fs / nfft;
    for (let y = 0; y < H; y++) {
      const f0 = ((H - 1 - y) / H) * fmax, f1 = ((H - y) / H) * fmax;
      let m = 0;
      for (let k = Math.floor(f0 / df); k <= Math.max(Math.floor(f0 / df), Math.floor(f1 / df)) && k < nfft / 2; k++) m = Math.max(m, Math.hypot(re[k], im[k]));
      const db = 20 * Math.log10((2 * m) / wsum + 1e-12);
      const [cr, cg, cb] = cmap((db - floorDb) / 70);
      const p = y * 4;
      img.data[p] = cr; img.data[p + 1] = cg; img.data[p + 2] = cb; img.data[p + 3] = 255;
    }
    ctx.drawImage(canvas, -1, 0);
    ctx.putImageData(img, W - 1, 0);
  }

  function tick() {
    raf = requestAnimationFrame(tick);
    const ctx = canvas?.getContext('2d');
    if (!ctx || !ring) return;
    if (ring !== lastRing) { lastRing = ring; pos = ring.total; }
    const hop = Math.round(ring.fs / PX_PER_S);
    if (ring.total - pos > ring.buf.length - nfft) pos = ring.total - nfft - hop * 4; // fell behind: skip ahead
    const win = hanning(nfft);
    let wsum = 0;
    for (const v of win) wsum += v;
    const img = ctx.createImageData(1, H);
    let cols = 0;
    while (pos + nfft <= ring.total && cols < 30) {
      column(ctx, ring, pos, win, wsum, img);
      pos += hop;
      cols++;
    }
  }
  $effect(() => {
    // clear when the geometry changes
    void W; void H; void fmax;
    const ctx = canvas?.getContext('2d');
    if (ctx) { ctx.fillStyle = getComputedStyle(canvas).getPropertyValue('--surface-1') || '#fff'; ctx.fillRect(0, 0, W, H); }
  });
  $effect(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });
  onDestroy(() => cancelAnimationFrame(raf));
  const yt = $derived(Array.from({ length: 6 }, (_, i) => (fmax * i) / 5));
  const xt = $derived(Array.from({ length: Math.floor(W / PX_PER_S / 2) + 1 }, (_, i) => i * 2));
</script>

<div class="host" bind:clientWidth={width} style:height="{height}px">
  <canvas bind:this={canvas} width={W} height={H} style:left="{ML}px" style:top="{MT}px" aria-label="Live spectrogram"></canvas>
  <svg {width} {height} aria-hidden="true">
    {#each yt as f}
      <text x={ML - 6} y={MT + H - (f / fmax) * H} dy="0.32em" text-anchor="end" class="tk">{f >= 1000 ? `${+(f / 1000).toFixed(1)}k` : f.toFixed(0)}</text>
    {/each}
    {#each xt as s}
      <text x={ML + W - s * PX_PER_S} y={MT + H + 16} text-anchor={s === 0 ? 'end' : 'middle'} class="tk">{s === 0 ? 'now' : `−${s} s`}</text>
    {/each}
    <text transform="translate(12,{H / 2}) rotate(-90)" text-anchor="middle" class="al">frequency (Hz)</text>
  </svg>
</div>

<style>
  .host { position: relative; width: 100%; min-width: 0; }
  canvas, svg { position: absolute; left: 0; }
  svg { top: 0; }
  svg { pointer-events: none; }
  .tk { font-size: var(--chart-font); fill: var(--text-muted); font-variant-numeric: tabular-nums; }
  .al { font-size: var(--chart-label); fill: var(--text-secondary); }
</style>
