// Main-thread handle on the training worker. Each playground gets its own Trainer.
import type { DoneMessage, EpochMessage, Grid, TrainConfig, TrainData, WorkerMessage } from './trainTypes';

export interface TrainCallbacks {
  onEpoch?: (m: EpochMessage) => void;
  onDone?: (m: DoneMessage) => void;
  onError?: (message: string) => void;
}

export class Trainer {
  private worker: Worker | null = null;
  private runId = 0;
  private cb: TrainCallbacks = {};

  private ensure(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./train.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
        const m = e.data;
        if (m.id !== this.runId) return; // a stale run we already abandoned
        if (m.type === 'epoch') this.cb.onEpoch?.(m);
        else if (m.type === 'done') this.cb.onDone?.(m);
        else this.cb.onError?.(m.message);
      };
    }
    return this.worker;
  }

  train(config: TrainConfig, data: TrainData, cb: TrainCallbacks, grid?: Grid) {
    this.cb = cb;
    this.runId++;
    this.ensure().postMessage({ type: 'train', id: this.runId, config, data, grid });
  }

  /** Ask the current run to stop after its epoch; it still reports `done` with test results. */
  stop() {
    this.worker?.postMessage({ type: 'stop' });
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
  }
}

export const DEFAULT_CONFIG: TrainConfig = {
  model: 'mlp',
  hidden: [128, 64],
  activation: 'relu',
  lr: 0.003,
  epochs: 60,
  batchSize: 64,
  dropout: 0,
  l2: 0,
  seed: 42,
  sendWeights: true,
};
