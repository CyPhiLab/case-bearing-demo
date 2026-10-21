<script lang="ts">
  // Feature-map heatmap: rows = channels (filters), columns = time. One-hue sequential ramp.
  import { app } from '../state.svelte';

  interface Props {
    data: number[][]; // [time][channel]
    height?: number;
    label?: string;
  }
  let { data, height = 120, label = '' }: Props = $props();
  let canvas: HTMLCanvasElement;
  let width = $state(400);

  $effect(() => {
    void app.paletteTick;
    if (!canvas || !data.length) return;
    const T = data.length, C = data[0].length;
    // normalize each channel by its own peak so every filter's timing is visible
    const max = new Float64Array(C).fill(1e-9);
    for (const row of data) for (let c = 0; c < C; c++) max[c] = Math.max(max[c], row[c]);
    const css = getComputedStyle(canvas);
    const hex = (name: string) => {
      const c = css.getPropertyValue(name).trim();
      return [1, 3, 5].map((o) => parseInt(c.slice(o, o + 2), 16));
    };
    const lo = hex('--surface-2'), hi = hex('--accent-ink');
    const img = new ImageData(T, C);
    for (let t = 0; t < T; t++)
      for (let c = 0; c < C; c++) {
        const u = Math.max(0, data[t][c]) / max[c];
        const o = (c * T + t) * 4;
        img.data[o] = lo[0] + (hi[0] - lo[0]) * u;
        img.data[o + 1] = lo[1] + (hi[1] - lo[1]) * u;
        img.data[o + 2] = lo[2] + (hi[2] - lo[2]) * u;
        img.data[o + 3] = 255;
      }
    const tmp = document.createElement('canvas');
    tmp.width = T;
    tmp.height = C;
    tmp.getContext('2d')!.putImageData(img, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
  });
</script>

<div class="host" bind:clientWidth={width} role="img" aria-label={label}>
  <canvas bind:this={canvas} style:height="{height}px"></canvas>
</div>

<style>
  .host { width: 100%; min-width: 0; }
  canvas { display: block; width: 100%; border-radius: 4px; }
</style>
