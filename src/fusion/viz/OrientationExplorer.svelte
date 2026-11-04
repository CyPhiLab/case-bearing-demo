<script lang="ts">
  // Orientation from three angles (W3C order: α about z, then β about the new x, then γ about the new y) and the
  // equivalent quaternion. At β = ±90° the first and last rotations act about the same axis: gimbal lock.
  import Phone3D from '../ui/Phone3D.svelte';
  import { qFromEuler } from '../lib/fusion';

  let a = $state(30);
  let b = $state(40);
  let g = $state(-20);
  const q = $derived(qFromEuler(a, b, g));
  const angle = $derived(2 * Math.acos(Math.min(1, Math.abs(q[0]))) * (180 / Math.PI));
  const axis = $derived.by(() => {
    const s = Math.hypot(q[1], q[2], q[3]) || 1;
    return [q[1] / s, q[2] / s, q[3] / s];
  });
  const locked = $derived(Math.abs(Math.abs(b) - 90) < 4);
</script>

<div class="card">
  <div class="layout">
    <Phone3D {q} size={190} label="phone" />
    <div class="right">
      <div class="controls">
        <label class="control"><span>α, heading (about z) <b>{a}°</b></span><input type="range" min="0" max="359" step="1" bind:value={a} /></label>
        <label class="control"><span>β, front–back tilt (about x) <b>{b}°</b></span><input type="range" min="-90" max="90" step="1" bind:value={b} /></label>
        <label class="control"><span>γ, sideways tilt (about y) <b>{g}°</b></span><input type="range" min="-90" max="90" step="1" bind:value={g} /></label>
      </div>
      <p class="small num quat">q = [{q.map((v) => v.toFixed(3)).join(', ')}]</p>
      <p class="small secondary">
        The same orientation as a single rotation of <b class="num">{angle.toFixed(1)}°</b> about the axis
        (<span class="num">{axis.map((v) => v.toFixed(2)).join(', ')}</span>), with q = [cos(θ/2), sin(θ/2)·n].
        {#if locked}<b class="warn">At β = ±90° the α and γ sliders turn the phone about the same axis: one degree of freedom is lost (gimbal lock).</b>{/if}
      </p>
    </div>
  </div>
</div>

<style>
  .layout { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 1rem; align-items: center; }
  .quat { font-family: var(--mono); margin: 0.6rem 0 0.2rem; }
  .warn { color: var(--critical); }
  @media (max-width: 640px) { .layout { grid-template-columns: minmax(0, 1fr); } }
</style>
