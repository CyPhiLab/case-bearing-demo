<script lang="ts">
  // Hear aliasing: resample a sweep (or your own recording) at a lower rate, with and without an anti-aliasing filter.
  import Seg from '../../lib/ui/Seg.svelte';
  import Spectrogram from './Spectrogram.svelte';
  import { clips } from '../lib/clips.svelte';
  import { downsample, stft } from '../../lib/dsp/signals';
  import { play, stop } from '../../lib/audio';
  import { app } from '../../lib/state.svelte';

  const options = $derived(clips.filter((c) => c.fs >= 8000));
  let clipId = $state('chirp');
  const clip = $derived(options.find((c) => c.id === clipId) ?? options[0]);
  let factor = $state(4);
  let aa = $state(false);
  const y = $derived(downsample(clip.x, clip.fs, factor, aa));
  const fsNew = $derived(clip.fs / factor);
  const nfft = 512;
  const sOrig = $derived(stft(clip.x, clip.fs, nfft, nfft / 2));
  const nNew = $derived(2 ** Math.round(Math.log2(nfft / factor)));
  const sNew = $derived(stft(y, fsNew, nNew, nNew / 2));
  let playing = $state<string | null>(null);
  function go(which: 'orig' | 'new') {
    if (playing === which) { stop(); playing = null; return; }
    playing = which;
    const sig = which === 'orig' ? clip.x : y;
    let pk = 0;
    for (const v of sig) pk = Math.max(pk, Math.abs(v));
    play(sig, { fs: which === 'orig' ? clip.fs : fsNew, slow: 1, gain: 0.7 / (pk || 1), from: 0, onended: () => (playing = null) });
  }
  const h = $derived(app.mode === 'lecture' ? 240 : 190);
</script>

<div class="card">
  <div class="controls">
    {#if options.length > 1}
      <label class="control"><span>Sound</span>
        <select bind:value={clipId}>{#each options as c}<option value={c.id}>{c.name}</option>{/each}</select>
      </label>
    {/if}
    <Seg bind:value={factor} label="Keep every n-th sample" options={[1, 2, 4, 5].map((v) => ({ value: v, label: v === 1 ? `${clip.fs / 1000} kHz (original)` : `${(clip.fs / v / 1000).toFixed(1)} kHz` }))} />
    <label class="check"><input type="checkbox" bind:checked={aa} /> anti-aliasing low-pass first</label>
  </div>
  <div class="grid-2">
    <div>
      <div class="head"><b class="small">Original, f<sub>s</sub> = {clip.fs} Hz</b> <button onclick={() => go('orig')}>{playing === 'orig' ? '■ Stop' : '▶ Play'}</button></div>
      <Spectrogram frames={sOrig.frames} df={sOrig.df} dt={sOrig.dt} fmax={clip.fs / 2} height={h} ariaLabel="Spectrogram of the original" />
    </div>
    <div>
      <div class="head"><b class="small">Resampled, f<sub>s</sub> = {fsNew.toFixed(0)} Hz{aa ? ', filtered' : ''}</b> <button onclick={() => go('new')}>{playing === 'new' ? '■ Stop' : '▶ Play'}</button></div>
      <Spectrogram
        frames={sNew.frames}
        df={sNew.df}
        dt={sNew.dt}
        fmax={clip.fs / 2}
        height={h}
        hlines={factor > 1 ? [{ y: fsNew / 2, label: `new f_N = ${(fsNew / 2).toFixed(0)} Hz` }] : []}
        ariaLabel="Spectrogram after resampling"
      />
    </div>
  </div>
  <p class="small secondary">
    {#if factor === 1}
      Choose a lower sample rate. The sweep rises steadily to 6 kHz.
    {:else if !aa}
      Above the new Nyquist line, the sweep doesn't disappear. It <b>folds back down</b>, so you hear the pitch rise, fall and rise
      again. Once it's sampled, you can't tell those aliased tones from real ones.
    {:else}
      With an anti-aliasing filter applied <i>before</i> sampling, everything above the new f<sub>N</sub> is removed, so the sweep
      fades out instead of folding back. That's why every DAQ and sound card has an analog low-pass in front of its ADC.
    {/if}
  </p>
</div>

<style>
  .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem; }
  .check { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--text-secondary); }
</style>
