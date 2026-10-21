<script lang="ts">
  import { CLASS_SHORT } from '../classes';

  let { matrix, title = '' }: { matrix: number[][] | null; title?: string } = $props();

  const k = CLASS_SHORT.length;
  const rowSums = $derived(matrix?.map((r) => r.reduce((a, b) => a + b, 0)) ?? []);
</script>

<figure>
  {#if title}<figcaption>{title}</figcaption>{/if}
  <div class="wrap">
    <div class="ylab">Actual</div>
    <table aria-label="confusion matrix">
      <thead>
        <tr>
          <th></th>
          {#each CLASS_SHORT as c}<th scope="col">{c}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each { length: k } as _, i}
          <tr>
            <th scope="row">{CLASS_SHORT[i]}</th>
            {#each { length: k } as _, j}
              {@const v = matrix?.[i]?.[j] ?? null}
              {@const frac = v !== null && rowSums[i] ? v / rowSums[i] : 0}
              <td
                class:diag={i === j}
                class:off={i !== j && !!v}
                class:strong={frac > 0.55}
                style:--frac={frac}
                title={v === null ? '' : `${CLASS_SHORT[i]} predicted as ${CLASS_SHORT[j]}: ${v} of ${rowSums[i]}`}
              >
                {v ?? '–'}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <div class="xlab">Predicted</div>
</figure>

<style>
  figure { margin: 0; }
  figcaption { font-size: 0.85rem; font-weight: 600; margin-bottom: 0.3rem; }
  .wrap { display: flex; align-items: center; gap: 0.3rem; }
  .ylab, .xlab { font-size: 0.72rem; color: var(--text-muted); }
  .ylab { writing-mode: vertical-rl; transform: rotate(180deg); }
  .xlab { text-align: center; padding-left: 4.5rem; }
  table { border-collapse: separate; border-spacing: 2px; font-variant-numeric: tabular-nums; }
  th { font-size: 0.72rem; font-weight: 500; color: var(--text-secondary); padding: 0 0.3rem; }
  th[scope='row'] { text-align: right; }
  td {
    width: 3rem;
    height: 2.2rem;
    text-align: center;
    border-radius: 4px;
    font-size: 0.85rem;
    background: var(--surface-2);
    color: var(--text-muted);
  }
  td.diag {
    background: color-mix(in srgb, var(--accent) calc(var(--frac) * 85%), var(--surface-2));
    color: var(--text-primary);
    font-weight: 600;
  }
  td.strong { color: #fff; }
  td.off {
    background: color-mix(in srgb, var(--critical) calc(20% + var(--frac) * 65%), var(--surface-2));
    color: var(--text-primary);
    font-weight: 600;
  }
</style>
