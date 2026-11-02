<script lang="ts" module>
  export interface Spec {
    measures: string;
    principle: string;
    output: string;
    range: string;
    sensitivity: string;
    bandwidth: string;
    watch: string; // common error sources
  }
</script>

<script lang="ts">
  let { spec }: { spec: Spec } = $props();
  const ROWS: [keyof Spec, string][] = [
    ['measures', 'Measures'],
    ['principle', 'Principle'],
    ['output', 'Output'],
    ['range', 'Typical range'],
    ['sensitivity', 'Typical sensitivity'],
    ['bandwidth', 'Bandwidth'],
    ['watch', 'Watch out for'],
  ];
</script>

<aside class="spec" aria-label="Typical specifications">
  <div class="h">Spec card <span class="muted">typical values</span></div>
  <dl>
    {#each ROWS as [k, label]}
      <dt>{label}</dt>
      <dd>{spec[k]}</dd>
    {/each}
  </dl>
</aside>

<style>
  .spec { background: var(--surface-2); border-radius: var(--radius); padding: 0.75rem 0.9rem; font-size: 0.84rem; align-self: start; }
  .h { font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent-ink); margin-bottom: 0.45rem; }
  .h .muted { text-transform: none; letter-spacing: 0; font-weight: 500; margin-left: 0.3rem; }
  dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 0.25rem 0.75rem; margin: 0; }
  dt { font-weight: 600; color: var(--text-primary); }
  dd { margin: 0; color: var(--text-secondary); }
  :global(:root[data-mode='lecture']) dl { grid-template-columns: max-content minmax(0, 1fr) max-content minmax(0, 1fr); }
  @media (max-width: 760px) {
    :global(:root[data-mode='lecture']) dl { grid-template-columns: max-content minmax(0, 1fr); }
  }
  @media (max-width: 420px) {
    dl { grid-template-columns: 1fr; }
    dd { margin-bottom: 0.3rem; }
    :global(:root[data-mode='lecture']) dl { grid-template-columns: 1fr; }
  }
</style>
