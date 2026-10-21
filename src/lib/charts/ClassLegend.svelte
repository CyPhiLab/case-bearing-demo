<script lang="ts">
  import { CLASS_NAMES, CLASS_SHAPES, classVar, markerPath } from '../classes';

  let { extra = [], only }: { extra?: { label: string; svg: string }[]; only?: number[] } = $props();
</script>

<div class="legend" role="list" aria-label="legend">
  {#each CLASS_NAMES as name, i}
    {#if !only || only.includes(i)}
    <span role="listitem">
      <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true">
        <path
          d={markerPath(CLASS_SHAPES[i], 4.5)}
          fill={CLASS_SHAPES[i] === 'ring' ? 'var(--surface-1)' : classVar(i)}
          stroke={classVar(i)}
          stroke-width="1.6"
        />
      </svg>
      {name}
    </span>
    {/if}
  {/each}
  {#each extra as e}
    <span role="listitem">{@html e.svg}{e.label}</span>
  {/each}
</div>

<style>
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
  span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
</style>
