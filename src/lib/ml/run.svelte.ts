// Reactive wrapper around one training run, for the playground UIs.
import { Trainer } from './trainer';
import type { DoneMessage, Grid, TrainConfig, TrainData } from './trainTypes';

export class TrainingRun {
  status = $state<'idle' | 'training' | 'done' | 'error'>('idle');
  epochs = $state<{ epoch: number; loss: number; valLoss: number; acc: number; valAcc: number }[]>([]);
  weights = $state<number[][][] | null>(null);
  grid = $state<number[][] | null>(null);
  result = $state<DoneMessage | null>(null);
  error = $state('');
  private trainer = new Trainer();

  start(config: TrainConfig, data: TrainData, grid?: Grid) {
    this.status = 'training';
    this.epochs = [];
    this.result = null;
    this.error = '';
    this.trainer.train(
      config,
      data,
      {
        onEpoch: (m) => {
          this.epochs.push({ epoch: m.epoch, loss: m.loss, valLoss: m.valLoss, acc: m.acc, valAcc: m.valAcc });
          if (m.weights) this.weights = m.weights;
          if (m.grid) this.grid = m.grid;
        },
        onDone: (m) => {
          this.result = m;
          this.weights = m.weights;
          if (m.grid) this.grid = m.grid;
          this.status = 'done';
        },
        onError: (msg) => {
          this.error = msg;
          this.status = 'error';
        },
      },
      grid,
    );
  }

  stop() {
    this.trainer.stop();
  }

  dispose() {
    this.trainer.dispose();
  }
}
