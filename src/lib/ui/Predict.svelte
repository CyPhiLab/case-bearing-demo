<script lang="ts">
  import type { Snippet } from 'svelte';

  // "Predict, then reveal": a self-paced prompt that asks students to commit to a guess first.
  let { question, children }: { question: string; children: Snippet } = $props();
  let open = $state(false);
</script>

<aside class="predict self-only">
  <div class="q"><span class="tag">Predict</span> {question}</div>
  {#if open}
    <div class="a">{@render children()}</div>
  {:else}
    <button onclick={() => (open = true)}>I've made my guess. Reveal</button>
  {/if}
</aside>

<style>
  .predict {
    border: 1px dashed var(--focus);
    border-radius: var(--radius);
    padding: 0.8rem 1rem;
    margin: 1rem 0;
    background: color-mix(in srgb, var(--focus) 5%, var(--surface-1));
    max-width: 80ch;
  }
  .q { font-weight: 600; margin-bottom: 0.5rem; }
  .tag {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #fff;
    background: var(--focus);
    padding: 0.1em 0.5em;
    border-radius: 4px;
    margin-right: 0.3rem;
    vertical-align: 0.15em;
  }
  .a { color: var(--text-secondary); }
  .a :global(p:last-child) { margin-bottom: 0; }
</style>
