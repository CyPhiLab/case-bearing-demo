<script lang="ts">
  // Paderborn: the same fault location made two ways, machined vs. real wear, side by side.
  import { onMount } from 'svelte';
  import LineChart from '../charts/LineChart.svelte';
  import { loadDataset, type Dataset } from '../data';
  import { envelopeSpectrum } from '../dsp/fft';
  import { PU_BEARING, faultFrequencies } from '../bearing';
  import { classVar } from '../classes';
  import * as audio from '../audio';
  import { app } from '../state.svelte';

  let ds = $state<Dataset | null>(null);
  let err = $state('');
  let location = $state<'Outer Race' | 'Inner Race'>('Outer Race');
  let pick = $state<Record<string, number>>({});
  let playingId = $state<string | null>(null);
  onMount(() => {
    loadDataset('pu/').then((d) => (ds = d)).catch((e) => (err = String(e)));
    return () => audio.stop();
  });

  const ff = faultFrequencies(PU_BEARING.rpm, PU_BEARING);
  const groups = $derived(
    ds
      ? (['machined', 'real'] as const).map((damage) => ({
          damage,
          recs: ds!.recordings.map((r, i) => ({ r, i })).filter(({ r }) => r.damage === damage && r.cls === location),
        }))
      : [],
  );
  const healthy = $derived(ds ? ds.recordings.findIndex((r) => r.damage === 'none') : -1);
  const chosen = (damage: string) => {
    const g = groups.find((x) => x.damage === damage)!;
    return g.recs[Math.min(pick[`${location}/${damage}`] ?? 0, g.recs.length - 1)];
  };
  const env = (sig: Float64Array) => {
    const e = envelopeSpectrum(sig.subarray(0, 32768), ds!.fs, [2000, 5800]);
    const n = e.freq.findIndex((f) => f > 420);
    return { x: e.freq.subarray(1, n), y: e.amp.subarray(1, n) };
  };
    const target = $derived(location === 'Outer Race' ? { f: ff.bpfo, name: 'BPFO' } : { f: ff.bpfi, name: 'BPFI' });
  // one shared y-axis for both panels, so machined and real damage can be compared in amplitude
  const envs = $derived(Object.fromEntries(groups.map((g) => [g.damage, env(chosen(g.damage).r.signal)])));
  const waveRange = $derived.by((): [number, number] => {
    let m = 0;
    for (const g of groups) {
      const s = chosen(g.damage).r.signal;
      for (let i = 0; i < Math.min(s.length, Math.round(0.1 * ds!.fs)); i++) m = Math.max(m, Math.abs(s[i]));
    }
    return [-1.05 * m, 1.05 * m];
  });
  const envMax = $derived(Math.max(...Object.values(envs).map((e) => Math.max(...e.y))) * 1.08);

  function listen(id: string, sig: Float64Array, rms: number) {
    if (playingId === id) {
      audio.stop();
      playingId = null;
      return;
    }
    audio.play(sig, { fs: ds!.fs, slow: 1, gain: 0.12 / rms, from: 0, onended: () => (playingId = null) });
    playingId = id;
  }
</script>

{#if err}
  <p class="small" style="color: var(--critical)">Couldn't load the Paderborn data: {err}</p>
{:else if !ds}
  <p class="muted small">Loading the Paderborn recordings…</p>
{:else}
  <div class="controls">
    <div class="control">
      Fault location
      <div class="seg" role="group" aria-label="Fault location">
        {#each ['Outer Race', 'Inner Race'] as const as loc}
          <button aria-pressed={location === loc} onclick={() => (location = loc)}>{loc}</button>
        {/each}
      </div>
    </div>
  </div>
  <div class="grid-2" style="margin-top: 0.6rem">
    {#each groups as g}
      {@const c = chosen(g.damage)}
      <div class="col" class:real={g.damage === 'real'}>
        <div class="col-head">
          <h4>{g.damage === 'machined' ? 'Machined damage' : 'Real damage from a life test'}</h4>
          <select
            value={pick[`${location}/${g.damage}`] ?? 0}
            onchange={(e) => (pick = { ...pick, [`${location}/${g.damage}`]: +e.currentTarget.value })}
            aria-label="Bearing"
          >
            {#each g.recs as { r }, j}<option value={j}>{r.id}: {r.method}</option>{/each}
          </select>
          <button onclick={() => listen(c.r.id, c.r.signal, c.r.rms)}>{playingId === c.r.id ? '■' : '▶'} Listen</button>
        </div>
        <LineChart
          series={[{ y: c.r.signal, dx: 1000 / ds.fs, color: classVar(c.r.clsIndex), width: 1 }]}
                    xDomain={[0, 100]}
          yDomain={waveRange}
          height={app.mode === 'lecture' ? 170 : 140}
          xLabel="time (ms)"
          hover={false}
          ariaLabel="{c.r.id} waveform"
        />
        <LineChart
                    series={[{ ...envs[g.damage], color: classVar(c.r.clsIndex), width: 1.3 }]}
          xDomain={[0, 420]}
          yDomain={[0, envMax]}
          height={app.mode === 'lecture' ? 190 : 160}
          xLabel="envelope spectrum (Hz)"
          markers={[
            { x: ff.shaft, label: 'f_r', color: 'var(--text-muted)' },
            { x: target.f, label: target.name, color: classVar(c.r.clsIndex) },
            { x: 2 * target.f, label: '2×', color: classVar(c.r.clsIndex), dash: true },
          ]}
          ariaLabel="{c.r.id} envelope spectrum"
        />
      </div>
    {/each}
  </div>
  {#if healthy >= 0}
    <p class="small muted">
      For reference, the healthy bearing {ds.recordings[healthy].id} has RMS {ds.recordings[healthy].rms.toFixed(2)}, while these damaged ones
      range from {Math.min(...groups.flatMap((g) => g.recs.map(({ r }) => r.rms))).toFixed(2)} to
      {Math.max(...groups.flatMap((g) => g.recs.map(({ r }) => r.rms))).toFixed(2)} (sensor units).
    </p>
  {/if}
{/if}

<style>
  .seg { display: flex; }
  .seg button { border-radius: 0; font-size: 0.85rem; }
  .seg button:first-child { border-radius: 8px 0 0 8px; }
  .seg button:last-child { border-radius: 0 8px 8px 0; margin-left: -1px; }
  .col { background: var(--surface-2); border-radius: 8px; padding: 0.6rem 0.7rem; }
  .col-head { display: flex; flex-wrap: wrap; gap: 0.4rem 0.6rem; align-items: center; margin-bottom: 0.3rem; }
  .col-head h4 { margin: 0; flex: 1 1 100%; font-size: 0.95rem; }
  .col.real h4 { color: var(--critical); }
</style>
