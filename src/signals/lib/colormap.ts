// Sequential colormap for spectrograms, built from theme tokens so it reads in light and dark:
// background (quiet) → accent blue → strongest-contrast ink (loud).
import * as d3 from 'd3';

export function themeColormap(): (v: number) => [number, number, number] {
  const css = getComputedStyle(document.documentElement);
  const c = (name: string) => css.getPropertyValue(name).trim();
  const interp = d3.piecewise(d3.interpolateLab, [c('--surface-1'), c('--accent'), c('--text-primary')]);
  const lut: [number, number, number][] = Array.from({ length: 256 }, (_, i) => {
    const rgb = d3.rgb(interp(i / 255));
    return [rgb.r, rgb.g, rgb.b];
  });
  return (v) => lut[Math.max(0, Math.min(255, Math.round(v * 255)))];
}
