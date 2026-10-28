<script lang="ts">
  // Small pointer to the supplementary textbook (Figliola & Beasley, 6th ed., ch. 2).
  let { eq, fig, ex, sec }: { eq?: string; fig?: string; ex?: string; sec?: string } = $props();
  const label = $derived(eq ? `Eq. ${eq}` : fig ? `Fig. ${fig}` : ex ? `Example ${ex}` : `§${sec}`);
</script>

<span class="ref" title="Figliola & Beasley, Theory and Design for Mechanical Measurements, 6th ed.">F&amp;B {label}</span>

<style>
  .ref {
    display: inline-block;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--text-muted);
    border: 1px solid var(--grid);
    border-radius: 4px;
    padding: 0 0.35em;
    vertical-align: 0.15em;
    white-space: nowrap;
  }
</style>
