<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    id: string;
    num: number;
    title: string;
    kicker: string;
    lecture?: string; // which lecture this builds on
    children: Snippet;
  }
  let { id, num, title, kicker, lecture, children }: Props = $props();
</script>

<section {id} class="section" aria-labelledby="{id}-title">
  <header>
    <div class="eyebrow">
      <span class="num">{String(num).padStart(2, '0')}</span>
      {kicker}
      {#if lecture}<span class="chip self-only">Builds on: {lecture}</span>{/if}
    </div>
    <h2 id="{id}-title">{title}</h2>
  </header>
  {@render children()}
</section>

<style>
  .section {
    max-width: var(--content);
    margin: 0 auto;
    padding: 4.5rem 1.25rem 2rem;
    border-top: 1px solid var(--grid);
  }
  header { margin-bottom: 1.2rem; }
  .eyebrow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--accent-ink);
    margin-bottom: 0.4rem;
  }
  .eyebrow .chip { text-transform: none; letter-spacing: 0; font-weight: 500; white-space: normal; }
  .num {
    font-family: var(--mono);
    background: var(--accent-soft);
    color: var(--accent-ink);
    border-radius: 6px;
    padding: 0.05em 0.45em;
  }
  @media (max-width: 640px) {
    .section { padding: 3rem 1rem 1.5rem; }
    h2 { font-size: 1.6rem; }
  }
</style>
