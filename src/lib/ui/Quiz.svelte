<script lang="ts">
  // A single multiple-choice check question with instant feedback.
  interface Props {
    question: string;
    options: string[];
    answer: number;
    explain: string;
  }
  let { question, options, answer, explain }: Props = $props();
  let picked = $state<number | null>(null);
</script>

<fieldset class="quiz self-only">
  <legend><span class="tag">Check</span> {question}</legend>
  {#each options as o, i}
    <label class:right={picked !== null && i === answer} class:wrong={picked === i && i !== answer}>
      <input type="radio" name={question} value={i} onchange={() => (picked = i)} />
      {o}
    </label>
  {/each}
  {#if picked !== null}
    <p class="feedback" role="status">
      <b>{picked === answer ? '✓ Correct.' : '✗ Not quite.'}</b>
      {explain}
    </p>
  {/if}
</fieldset>

<style>
  .quiz {
    border: 1px solid var(--grid);
    border-radius: var(--radius);
    padding: 0.8rem 1rem;
    margin: 1rem 0;
    background: var(--surface-1);
    max-width: 80ch;
  }
  legend { font-weight: 600; padding: 0 0.3rem; }
  .tag {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #fff;
    background: var(--accent);
    padding: 0.1em 0.5em;
    border-radius: 4px;
    margin-right: 0.3rem;
    vertical-align: 0.15em;
  }
  label {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    padding: 0.3rem 0.5rem;
    border-radius: 6px;
    cursor: pointer;
  }
  label:hover { background: var(--surface-2); }
  label.right { background: color-mix(in srgb, var(--good) 14%, transparent); }
  label.wrong { background: color-mix(in srgb, var(--critical) 12%, transparent); }
  .feedback { margin: 0.5rem 0 0; color: var(--text-secondary); }
</style>
