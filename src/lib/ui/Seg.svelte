<script lang="ts" generics="T extends string | number">
  // Segmented button group (a styled radio group).
  interface Props {
    options: { value: T; label: string; title?: string }[];
    value: T;
    label?: string;
    onchange?: (v: T) => void;
  }
  let { options, value = $bindable(), label = '', onchange }: Props = $props();
</script>

<div class="seg" role="radiogroup" aria-label={label}>
  {#each options as o}
    <button
      role="radio"
      aria-checked={value === o.value}
      title={o.title}
      onclick={() => {
        value = o.value;
        onchange?.(o.value);
      }}>{o.label}</button
    >
  {/each}
</div>

<style>
  .seg { display: flex; flex-wrap: wrap; }
  .seg button { border-radius: 0; margin-left: -1px; font-size: 0.82rem; padding: 0.28em 0.65em; }
  .seg button:first-child { border-radius: 8px 0 0 8px; margin-left: 0; }
  .seg button:last-child { border-radius: 0 8px 8px 0; }
  .seg button[aria-checked='true'] { background: var(--accent-soft); border-color: var(--accent); font-weight: 600; position: relative; }
</style>
