<script lang="ts">
  // Static spectrogram (STFT magnitude in dB) on LineChart axes: time → x, frequency → y.
  import LineChart from '../../lib/charts/LineChart.svelte';
  import { themeColormap } from '../lib/colormap';
  import { app } from '../../lib/state.svelte';

  interface Props {
    frames: Float32Array[];
    df: number;
    dt: number;
    fmax?: number;
    range?: [number, number];
    height?: number;
    ariaLabel?: string;
    markers?: { x: number; label?: string; color?: string; dash?: boolean }[];
    hlines?: { y: number; label: string; color?: string }[];
  }
  let { frames, df, dt, fmax, range = [-80, 0], height = 220, ariaLabel = 'spectrogram', markers = [], hlines = [] }: Props = $props();
  const nb = $derived(frames[0]?.length ?? 1);
  const top = $derived(fmax ?? nb * df);
  const shownBins = $derived(Math.min(nb, Math.ceil(top / df)));

  const url = $derived.by(() => {
    void app.paletteTick;
    if (!frames.length || typeof document === 'undefined') return '';
    const cmap = themeColormap();
    const W = frames.length, H = shownBins;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(W, H);
    const [lo, hi] = range;
    for (let i = 0; i < W; i++)
      for (let k = 0; k < H; k++) {
        const [r, g, b] = cmap((frames[i][k] - lo) / (hi - lo));
        const p = ((H - 1 - k) * W + i) * 4;
        img.data[p] = r; img.data[p + 1] = g; img.data[p + 2] = b; img.data[p + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL();
  });
</script>

<LineChart
  series={[]}
  xDomain={[0, frames.length * dt]}
  yDomain={[0, top]}
  {height}
  xLabel="time (s)"
  yLabel="frequency (Hz)"
  yFormat={(v) => (top >= 2000 ? `${v / 1000}k` : String(v))}
  hover={false}
  {ariaLabel}
>
  {#snippet overlay({ x, y, w, h })}
    {#if url}<image href={url} x="0" y={y(shownBins * df)} width={w} height={h - y(shownBins * df)} preserveAspectRatio="none" />{/if}
    {#each markers as m}
      <line x1={x(m.x)} x2={x(m.x)} y1="0" y2={h} stroke={m.color ?? 'var(--critical)'} stroke-dasharray={m.dash ? '5 4' : undefined} stroke-width="1.5" />
      {#if m.label}<text x={x(m.x) + 4} y="12" class="hl" fill={m.color ?? 'var(--critical)'}>{m.label}</text>{/if}
    {/each}
    {#each hlines as l}
      <line x1="0" x2={w} y1={y(l.y)} y2={y(l.y)} stroke={l.color ?? 'var(--critical)'} stroke-dasharray="5 4" stroke-width="1.5" />
      <text x={w - 4} y={y(l.y) - 4} text-anchor="end" class="hl" fill={l.color ?? 'var(--critical)'}>{l.label}</text>
    {/each}
  {/snippet}
</LineChart>

<style>
  .hl { font-size: var(--chart-font); font-weight: 600; paint-order: stroke; stroke: var(--surface-1); stroke-width: 3px; }
</style>
