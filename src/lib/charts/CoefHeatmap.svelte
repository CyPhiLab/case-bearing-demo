<script lang="ts">
  // Logistic-regression weights: one row per feature, one column per class (diverging blue-gray-red).
  import { CLASS_SHORT, classVar } from '../classes';

  let { weights, names }: { weights: number[][]; names: string[] } = $props();
  const maxAbs = $derived(Math.max(1e-9, ...weights.flat().map(Math.abs)));

  function color(v: number) {
    const t = Math.min(1, Math.abs(v) / maxAbs);
    const pole = v < 0 ? 'var(--div-neg)' : 'var(--div-pos)';
    return `color-mix(in srgb, ${pole} ${Math.round(t * 100)}%, var(--div-mid))`;
  }
</script>

<div class="wrap">
  <table aria-label="Logistic regression coefficients">
    <thead>
      <tr>
        <th></th>
        {#each CLASS_SHORT as c, k}<th scope="col" style:color={classVar(k)}>{c}</th>{/each}
      </tr>
    </thead>
    <tbody>
      {#each names as name, j}
        <tr>
          <th scope="row">{name}</th>
          {#each weights[j] as w}
            <td style:background={color(w)} class:strong={Math.abs(w) / maxAbs > 0.6} title="{name}: {w.toFixed(3)}">{w.toFixed(1)}</td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
  <div class="scale small muted">
    <span class="sw" style:background="var(--div-neg)"></span> pushes <i>away</i> from the class
    <span class="sw" style:background="var(--div-mid)"></span> no effect
    <span class="sw" style:background="var(--div-pos)"></span> pushes <i>toward</i> the class
  </div>
</div>

<style>
  .wrap { overflow-x: auto; }
  table { border-collapse: separate; border-spacing: 2px; font-size: 0.78rem; font-variant-numeric: tabular-nums; }
  th { font-weight: 500; color: var(--text-secondary); padding: 0 0.4rem; white-space: nowrap; }
  thead th { font-weight: 700; font-size: 0.75rem; }
  th[scope='row'] { text-align: right; }
  td { width: 3.4rem; height: 1.35rem; text-align: center; border-radius: 3px; color: var(--text-primary); }
  td.strong { color: #fff; font-weight: 600; }
  .scale { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem 0.5rem; margin-top: 0.4rem; }
  .sw { display: inline-block; width: 14px; height: 10px; border-radius: 2px; }
</style>
