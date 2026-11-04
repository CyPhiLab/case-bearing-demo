<script lang="ts">
  // Start/stop control for the shared phone sensor stream. Every live figure shows one; they all control the same stream.
  import { onMount } from 'svelte';
  import { live, startSensors, stopSensors } from '../lib/live.svelte';

  let { hint = '' }: { hint?: string } = $props();
  let mobile = $state(true);
  onMount(() => {
    mobile = matchMedia('(pointer: coarse)').matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  });
</script>

<div class="live-start">
  {#if live.running}
    <span class="dot" aria-hidden="true"></span>
    <span class="small num" data-testid="live-status">Sensors on · {live.fs.toFixed(0)} Hz{live.hasGyro ? '' : ' · no gyroscope'}{live.hasHeading ? '' : ' · no compass'}</span>
    <button onclick={stopSensors}>Stop</button>
  {:else}
    <button class="primary" onclick={startSensors} data-testid="live-start">Start phone sensors</button>
    <span class="small muted">{mobile ? hint || 'Lay the phone flat, screen up, then start.' : 'Live data needs a phone: scan the code at the top of the page.'}</span>
  {/if}
</div>
{#if live.status}<p class="small err" role="alert">{live.status}</p>{/if}

<style>
  .live-start { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.7rem; margin-bottom: 0.5rem; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--critical); animation: pulse 1.2s infinite; }
  @keyframes pulse { 50% { opacity: 0.3; } }
  .err { color: var(--critical); }
</style>
