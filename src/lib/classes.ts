// Visual identity of the four bearing conditions. Color is never the only cue: each class
// also has its own marker shape, and legends/labels always name the class.

export const CLASS_NAMES = ['Normal', 'Ball', 'Inner Race', 'Outer Race'];
export const CLASS_SHORT = ['Normal', 'Ball', 'Inner', 'Outer'];
export const CLASS_VARS = ['--cls-0', '--cls-1', '--cls-2', '--cls-3'];
export const classVar = (i: number) => `var(${CLASS_VARS[i]})`;

export type Shape = 'ring' | 'circle' | 'triangle' | 'square';
export const CLASS_SHAPES: Shape[] = ['ring', 'circle', 'triangle', 'square'];

/** Resolve CSS custom properties to concrete colors (canvas can't use var()). */
export function cssColor(name: string, el: Element = document.documentElement): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || '#888';
}

export function classColors(): string[] {
  return CLASS_VARS.map((v) => cssColor(v));
}

export function drawMarker(ctx: CanvasRenderingContext2D, shape: Shape, x: number, y: number, r: number) {
  ctx.beginPath();
  if (shape === 'circle' || shape === 'ring') ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (shape === 'square') ctx.rect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8);
  else {
    ctx.moveTo(x, y - r * 1.15);
    ctx.lineTo(x + r * 1.05, y + r * 0.8);
    ctx.lineTo(x - r * 1.05, y + r * 0.8);
    ctx.closePath();
  }
}

/** SVG path for a marker centred at 0,0. */
export function markerPath(shape: Shape, r: number): string {
  if (shape === 'circle' || shape === 'ring') return `M${-r},0a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;
  if (shape === 'square') return `M${-r * 0.9},${-r * 0.9}h${r * 1.8}v${r * 1.8}h${-r * 1.8}z`;
  return `M0,${-r * 1.15}L${r * 1.05},${r * 0.8}L${-r * 1.05},${r * 0.8}z`;
}
