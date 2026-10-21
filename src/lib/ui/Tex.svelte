<script lang="ts">
  import katex from 'katex';

  let { math, display = false }: { math: string; display?: boolean } = $props();
  const html = $derived(katex.renderToString(math, { displayMode: display, throwOnError: false }));
</script>

{@html html}
