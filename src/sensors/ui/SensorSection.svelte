<script lang="ts">
  // One sensor: header, a short description beside its spec card, the figures, and the lecture's video links.
  import type { Snippet } from 'svelte';
  import Section from '../../lib/ui/Section.svelte';
  import SpecCard, { type Spec } from './SpecCard.svelte';
  import Videos from './Videos.svelte';
  import { SENSORS, VIDEOS, groupLabel, sensorNum } from '../lib/registry';

  interface Props {
    id: string;
    title?: string;
    spec?: Spec;
    intro: Snippet;
    children: Snippet;
  }
  let { id, title, spec, intro, children }: Props = $props();
  const info = $derived(SENSORS.find((s) => s.id === id)!);
  const kicker = $derived(info.slide ? `${groupLabel(info.group)} · slide ${info.slide}` : groupLabel(info.group));
</script>

<Section {id} num={sensorNum(id)} {kicker} title={title ?? info.name}>
  <div class="lead" class:nospec={!spec}>
    <div class="prose self-only">{@render intro()}</div>
    {#if spec}<SpecCard {spec} />{/if}
  </div>
  {@render children()}
  {#if VIDEOS[id]}<Videos items={VIDEOS[id]} />{/if}
</Section>

<style>
  .lead { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 340px); gap: 1.2rem; margin-bottom: 1.2rem; align-items: start; }
  .lead.nospec { grid-template-columns: minmax(0, 1fr); }
  .prose :global(p:last-child) { margin-bottom: 0; }
  :global(:root[data-mode='lecture']) .lead { grid-template-columns: minmax(0, 1fr); }
  @media (max-width: 860px) { .lead { grid-template-columns: minmax(0, 1fr); } }
</style>
