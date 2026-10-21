<script lang="ts">
  import type { Dataset } from '../data';
  import { CLASS_SHAPES, classVar, markerPath } from '../classes';

  let { ds, value = $bindable() }: { ds: Dataset; value: number } = $props();

  const groups = $derived(
    ds.classes.map((c, ci) => ({
      cls: c,
      ci,
      recs: ds.recordings.map((r, i) => ({ r, i })).filter(({ r }) => r.clsIndex === ci),
    })),
  );
</script>

<div class="picker" role="radiogroup" aria-label="Recording">
  {#each groups as g}
    <div class="group">
      <span class="glabel">
        <svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true">
          <path d={markerPath(CLASS_SHAPES[g.ci], 4)} fill={CLASS_SHAPES[g.ci] === 'ring' ? 'none' : classVar(g.ci)} stroke={classVar(g.ci)} stroke-width="1.5" />
        </svg>
        {g.cls}
      </span>
      <div class="btns">
        {#each g.recs as { r, i }}
          <button
            role="radio"
            aria-checked={value === i}
            style:--c={classVar(g.ci)}
            onclick={() => (value = i)}
            title={r.source}
          >
            {r.size ? `${r.size} mil` : 'Healthy'}
          </button>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .picker { display: flex; flex-wrap: wrap; gap: 0.5rem 1.2rem; }
  .group { display: grid; gap: 0.2rem; }
  .glabel { display: flex; align-items: center; gap: 0.3rem; font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; }
  .btns { display: flex; }
  .btns button { border-radius: 0; margin-left: -1px; font-size: 0.82rem; padding: 0.25em 0.65em; }
  .btns button:first-child { border-radius: 8px 0 0 8px; margin-left: 0; }
  .btns button:last-child { border-radius: 0 8px 8px 0; }
  .btns button:only-child { border-radius: 8px; }
  .btns button[aria-checked='true'] {
    background: color-mix(in srgb, var(--c) 18%, var(--surface-1));
    border-color: var(--c);
    font-weight: 600;
    position: relative;
  }
</style>
