<script lang="ts">
  let { items }: { items: { title: string; url: string }[] } = $props();
</script>

<div class="videos self-only">
  <span class="h">From the lecture</span>
  <ul>
    {#each items as v}
      <li><a href={v.url} target="_blank" rel="noopener noreferrer">{v.title}</a></li>
    {/each}
  </ul>
</div>

<style>
  .videos { margin-top: 1.4rem; font-size: 0.88rem; display: flex; flex-wrap: wrap; gap: 0.2rem 0.8rem; align-items: baseline; }
  .h { font-weight: 600; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; }
  ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 0.2rem 1rem; }
  li::before { content: '▶'; font-size: 0.65em; color: var(--accent); margin-right: 0.4em; vertical-align: 0.15em; }
  a { color: var(--accent-ink); }
</style>
